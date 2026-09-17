import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse, type NextRequest } from "next/server";

import { hoyEnLima } from "@/lib/fechas";
import { esquemaModelo } from "@/lib/extraccion/esquema-modelo";
import { parsearRespuestas } from "@/lib/extraccion/esquema";
import { fusionarCapturas } from "@/lib/extraccion/fusionar";
import { validarJornada } from "@/lib/extraccion/validar";
import { LIMITES, PROMPT_EXTRACCION, detectarTipoReal } from "@/lib/extraccion/prompt";
import { codigosYaRegistrados, reglaVigente } from "@/lib/db/jornadas";
import { perfilActual, puedeCargarJornadas } from "@/lib/supabase/servidor";
import { comprobarLimite } from "@/lib/limites";
import { pagoDelTramo } from "@/lib/pagos/reglas";

/**
 * Extracción de las capturas (§4).
 *
 * Una llamada al modelo **por imagen**, en paralelo. La fusión, la
 * deduplicación y las validaciones NO las hace el modelo: las hace código
 * determinista, que es reproducible y está cubierto por pruebas.
 *
 * La clave de Anthropic solo existe aquí, en servidor. El cliente nunca la ve.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const MODELO = process.env.ANTHROPIC_MODELO ?? "claude-opus-5";

export async function POST(request: NextRequest) {
  /* --- 1. Quién llama, y si puede (§7, §12) --- */
  const perfil = await perfilActual();
  if (!perfil) {
    return NextResponse.json({ error: "No hay sesión." }, { status: 401 });
  }
  const hoy = hoyEnLima();
  if (!puedeCargarJornadas(perfil, hoy)) {
    return NextResponse.json(
      {
        error: perfil.activo
          ? "Tu suscripción venció. Puedes consultar y exportar tu historial, pero no cargar días nuevos."
          : "Tu cuenta está desactivada. Habla con el administrador.",
      },
      { status: 403 },
    );
  }

  /* --- 2. Límite de gasto por usuario (§7) --- */
  const limite = await comprobarLimite(perfil.id);
  if (!limite.permitido) {
    return NextResponse.json({ error: limite.mensaje }, { status: 429 });
  }

  /* --- 3. Entrada: tipo real por magic bytes, no por extensión (§7) --- */
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer la carga." }, { status: 400 });
  }

  const archivos = formulario.getAll("imagenes").filter((v): v is File => v instanceof File);
  if (archivos.length === 0) {
    return NextResponse.json({ error: "No llegó ninguna imagen." }, { status: 400 });
  }
  if (archivos.length > LIMITES.imagenesPorCarga) {
    return NextResponse.json(
      { error: `Máximo ${LIMITES.imagenesPorCarga} imágenes por carga.` },
      { status: 400 },
    );
  }

  const imagenes: { tipo: string; base64: string }[] = [];
  for (const archivo of archivos) {
    if (archivo.size > LIMITES.bytesPorImagen) {
      return NextResponse.json(
        { error: `"${archivo.name}" pesa más de 8 MB. Vuelve a elegirla.` },
        { status: 400 },
      );
    }
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const tipo = detectarTipoReal(bytes);
    if (!tipo) {
      return NextResponse.json(
        { error: `"${archivo.name}" no es una imagen JPEG, PNG o WebP.` },
        { status: 400 },
      );
    }
    imagenes.push({ tipo, base64: Buffer.from(bytes).toString("base64") });
  }

  /* --- 4. Una llamada por imagen, en paralelo (§4.3) --- */
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) {
    return NextResponse.json(
      { error: "Falta configurar ANTHROPIC_API_KEY en el servidor." },
      { status: 500 },
    );
  }
  const anthropic = new Anthropic({ apiKey: clave });

  let tokensEntrada = 0;
  let tokensSalida = 0;

  const resultados = await Promise.all(
    imagenes.map(async (imagen) => {
      try {
        const respuesta = await anthropic.messages.parse({
          model: MODELO,
          max_tokens: 8000,
          // La extracción es una tarea de lectura, no de razonamiento largo:
          // esfuerzo medio da precisión suficiente sin inflar el costo (§12).
          output_config: { effort: "medium", format: zodOutputFormat(esquemaModelo) },
          system: PROMPT_EXTRACCION,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imagen.tipo as "image/jpeg" | "image/png" | "image/webp",
                    data: imagen.base64,
                  },
                },
                {
                  type: "text",
                  text: "Extrae los datos de esta captura siguiendo el esquema.",
                },
              ],
            },
          ],
        });

        tokensEntrada += respuesta.usage.input_tokens ?? 0;
        tokensSalida += respuesta.usage.output_tokens ?? 0;

        // El modelo puede declinar; hay que mirarlo antes de leer el contenido.
        if (respuesta.stop_reason === "refusal") return null;
        return respuesta.parsed_output ?? null;
      } catch (error) {
        // Una imagen que falla no tumba la carga: se descarta y se informa.
        console.error("Fallo al leer una captura:", error instanceof Error ? error.message : error);
        return null;
      }
    }),
  );

  /* --- 5. Fusión determinista y validaciones (§4.4, §6) --- */
  const { validas, descartadas } = parsearRespuestas(resultados);
  if (validas.length === 0) {
    return NextResponse.json(
      { error: "No se pudo leer ninguna captura. Vuelve a intentarlo con fotos más nítidas." },
      { status: 422 },
    );
  }

  const jornada = fusionarCapturas(validas);
  const { regla } = await reglaVigente(jornada.fecha ?? hoy);
  const previos = await codigosYaRegistrados(jornada.ordenes.map((o) => o.codigo));
  const alertas = validarJornada(jornada, { hoy, codigosEnOtrasFechas: previos });

  const montoTramo1 = pagoDelTramo(regla, 1) ?? 1000;

  return NextResponse.json({
    jornada: {
      ...jornada,
      // Todos los pedidos nacen en tramo 1; el driver solo toca las excepciones.
      ordenes: jornada.ordenes.map((o) => ({ ...o, tramo: 1, montoCentimos: montoTramo1 })),
    },
    alertas,
    regla,
    imagenesLeidas: validas.length,
    imagenesDescartadas: descartadas.length + resultados.filter((r) => r === null).length,
    uso: { modelo: MODELO, tokensEntrada, tokensSalida },
  });
}
