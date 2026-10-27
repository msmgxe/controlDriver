"use client";

import { useState } from "react";

import { Equis } from "@/components/iconos";
import { Aviso } from "@/components/ui";
import { useCapa } from "@/hooks/useCapa";
import { paraLeer } from "@/lib/carga";
import {
  cotejar,
  extraerNumeros,
  type ResultadoDeCotejo,
} from "@/lib/comanda/cotejo";
import { marcarContados, pedidosParaCotejo } from "@/lib/db/sqlite/pedidos";
import { formatearFecha } from "@/lib/fechas";
import { formatearSoles } from "@/lib/pagos/reglas";

function aDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(blob);
  });
}

/**
 * Cotejar con el reporte de la empresa: se sube la captura (o varias) con la
 * lista de pedidos que contó, y la app dice cuáles coinciden con lo registrado,
 * cuáles no tienes, y cuáles tú tienes y la empresa no contó.
 *
 * La lectura es en el teléfono, sin internet. Nada cambia hasta que se pulsa
 * «Marcar los que coinciden», y eso solo pone la casilla de «contado», no toca
 * ningún monto.
 */
export function HojaDeCotejo({
  alCerrar,
  alCambiar,
}: {
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  useCapa(alCerrar);
  const [leyendo, setLeyendo] = useState<{
    hechas: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDeCotejo | null>(null);
  const [marcado, setMarcado] = useState<number | null>(null);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (archivos.length === 0) return;

    setError(null);
    setResultado(null);
    setMarcado(null);
    setLeyendo({ hechas: 0, total: archivos.length });
    try {
      const { leerImagenConCajas } =
        await import("@/lib/extraccion/lectorTexto");
      const lineas: string[] = [];
      for (let k = 0; k < archivos.length; k++) {
        const lectura = await leerImagenConCajas(
          await aDataUrl(await paraLeer(archivos[k])),
        );
        lineas.push(...lectura.lineas.map((l) => l.texto));
        setLeyendo({ hechas: k + 1, total: archivos.length });
      }
      const numeros = extraerNumeros(lineas);
      if (numeros.length === 0) {
        throw new Error(
          "No encontré códigos de pedido en la imagen. Sube la captura de la lista, con los códigos bien visibles.",
        );
      }
      setResultado(cotejar(numeros, await pedidosParaCotejo()));
    } catch (fallo) {
      setError(
        fallo instanceof Error ? fallo.message : "No se pudo leer la imagen.",
      );
    } finally {
      setLeyendo(null);
    }
  }

  async function marcar() {
    if (!resultado) return;
    const porMarcar = resultado.coinciden
      .filter((p) => !p.contado)
      .map((p) => p.id);
    await marcarContados(porMarcar, true);
    setMarcado(porMarcar.length);
    alCambiar();
  }

  const r = resultado;
  const faltaSumar = r
    ? r.noContados.reduce((s, p) => s + p.montoCentimos, 0)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cotejar con el reporte de la empresa"
        className="flex h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-hoja bg-sup shadow-alta sm:rounded-hoja"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <h3 className="text-[21px] leading-tight">
              Cotejar con la empresa
            </h3>
            <p className="text-sm text-tinta-2">
              Sube la lista que te envió y mira las diferencias.
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-sup-2"
          >
            <Equis className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <label
            className={`boton-principal cursor-pointer ${leyendo ? "opacity-60" : ""}`}
          >
            {r ? "Subir otra imagen" : "Elegir la imagen del reporte"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={!!leyendo}
              onChange={(e) => void alElegir(e)}
              className="sr-only"
            />
          </label>
          <p className="-mt-2 text-xs text-tinta-3">
            Puedes elegir varias capturas si la lista es larga. Se lee aquí, en
            tu teléfono, sin internet.
          </p>

          {leyendo && (
            <p role="status" className="text-sm text-tinta-2">
              Leyendo la imagen {Math.min(leyendo.hechas + 1, leyendo.total)} de{" "}
              {leyendo.total}…
            </p>
          )}
          {error && <Aviso tono="mal" titulo={error} />}

          {r && (
            <>
              <div className="grid grid-cols-2 gap-2 text-center">
                <Cifra valor={r.enReporte} etiqueta="La empresa contó" />
                <Cifra
                  valor={r.coinciden.length}
                  etiqueta="Coinciden con los tuyos"
                  tono="bien"
                />
                <Cifra
                  valor={r.faltanEnMiRegistro.length}
                  etiqueta="No los tienes registrados"
                  tono={r.faltanEnMiRegistro.length > 0 ? "aviso" : undefined}
                />
                <Cifra
                  valor={r.noContados.length}
                  etiqueta="Tuyos que no contó"
                  tono={r.noContados.length > 0 ? "mal" : undefined}
                />
              </div>
              {r.periodo && (
                <p className="text-xs text-tinta-3">
                  Período del reporte, según los que coinciden:{" "}
                  {formatearFecha(r.periodo.desde)} al{" "}
                  {formatearFecha(r.periodo.hasta)}.
                </p>
              )}

              {r.coinciden.length > 0 && (
                <button
                  type="button"
                  className="boton-sec"
                  disabled={marcado !== null}
                  onClick={() => void marcar()}
                >
                  {marcado === null
                    ? `Marcar como contados los ${r.coinciden.length} que coinciden`
                    : `Listo: ${marcado} marcados en Pagos`}
                </button>
              )}

              {r.noContados.length > 0 && (
                <Seccion
                  titulo={`Tú los tienes y la empresa no los contó (${r.noContados.length} · ${formatearSoles(faltaSumar)})`}
                  tono="mal"
                >
                  {r.noContados.map((p) => (
                    <Fila
                      key={p.id}
                      izq={p.codigo}
                      der={`${formatearFecha(p.fecha)} · ${formatearSoles(p.montoCentimos)}`}
                    />
                  ))}
                </Seccion>
              )}

              {r.faltanEnMiRegistro.length > 0 && (
                <Seccion
                  titulo={`La empresa los contó y no los tienes (${r.faltanEnMiRegistro.length})`}
                  tono="aviso"
                >
                  {r.faltanEnMiRegistro.map((n) => (
                    <Fila
                      key={n}
                      izq={`v${n}wofp-01`}
                      der="falta registrarlo"
                    />
                  ))}
                </Seccion>
              )}

              {r.sinCodigo.length > 0 && (
                <Aviso
                  tono="atento"
                  titulo={`Tienes ${r.sinCodigo.length} pedidos sin código en ese período`}
                >
                  <p>
                    {r.faltanEnMiRegistro.length > 0
                      ? `La empresa contó ${r.faltanEnMiRegistro.length} que no tienes con código. Si ${r.sinCodigo.length >= r.faltanEnMiRegistro.length ? "esos pedidos sin código son esos" : "solo algunos de tus pedidos sin código son esos"}, ábrelos y complétales el código de la lista de arriba.`
                      : "Complétales el código cuando lo tengas, para poder cotejarlos."}
                  </p>
                </Aviso>
              )}

              {r.noContados.length === 0 &&
                r.faltanEnMiRegistro.length === 0 &&
                r.sinCodigo.length === 0 && (
                  <Aviso
                    tono="bien"
                    titulo="Todo coincide: la empresa contó exactamente lo que tienes."
                  />
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Cifra({
  valor,
  etiqueta,
  tono,
}: {
  valor: number;
  etiqueta: string;
  tono?: "bien" | "aviso" | "mal";
}) {
  const color =
    tono === "bien"
      ? "text-bien"
      : tono === "aviso"
        ? "text-aviso"
        : tono === "mal"
          ? "text-mal"
          : "text-tinta";
  return (
    <div className="flex flex-col rounded-btn bg-sup-2 px-2 py-2.5">
      <b className={`font-mono text-2xl leading-tight ${color}`}>{valor}</b>
      <span className="text-[11.5px] font-semibold text-tinta-2">
        {etiqueta}
      </span>
    </div>
  );
}

function Seccion({
  titulo,
  tono,
  children,
}: {
  titulo: string;
  tono: "aviso" | "mal";
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <b className={`text-sm ${tono === "mal" ? "text-mal" : "text-aviso"}`}>
        {titulo}
      </b>
      <ul className="flex flex-col overflow-hidden rounded-btn border border-linea">
        {children}
      </ul>
    </div>
  );
}

function Fila({ izq, der }: { izq: string; der: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-linea px-3 py-2 text-xs last:border-b-0">
      <span className="font-mono text-[13px]">{izq}</span>
      <span className="shrink-0 text-tinta-3">{der}</span>
    </li>
  );
}
