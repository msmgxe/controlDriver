/**
 * Guardar lo que se leyó de una comanda.
 *
 * Una comanda puede hacer dos cosas, y las dos son válidas:
 *
 *   · **completar** un pedido que ya estaba cargado —lo normal: las capturas
 *     trajeron el código, y la comanda aporta el cliente, la distancia y la
 *     foto—;
 *   · **crear** un pedido nuevo, cuando no estaba entre las capturas.
 *
 * Reglas que esta función respeta y no se pueden saltar desde la pantalla:
 *
 *   · **Solo se guarda lo que Ajustes permite** de cada dato del cliente. Sin
 *     dirección guardada tampoco se guardan las coordenadas —serían la
 *     dirección con otro formato—; la distancia sí.
 *   · **Una semana ya pagada no se toca**, igual que cualquier otra edición.
 *   · **Lo que la persona decidió a mano manda sobre el cálculo.** Si el pedido
 *     tenía un tramo elegido por ella, la distancia se guarda pero el tramo
 *     no se pisa.
 *   · **Más de 12 km no tiene tarifa**: sin un monto escrito no se cambia el
 *     tramo ni el dinero; se guarda la distancia y se avisa.
 */
import { estadoDeSemana } from "@/lib/db/sqlite/liquidaciones";
import { guardarCliente, guardarDistancia } from "@/lib/db/sqlite/clientes";
import { agregarPedidoManual, codigosYaRegistrados, jornadaPorFecha, reglaVigente } from "@/lib/db/sqlite/jornadas";
import { perfilActual } from "@/lib/db/sqlite/perfil";
import type { AjustesDeComandas } from "@/lib/db/sqlite/ajustes";
import type { DatosDeCliente } from "@/lib/db/tipos";
import { hoyEnLima, type FechaISO } from "@/lib/fechas";
import type { Punto } from "@/lib/geo/distancia";
import { tramoPorDistancia, type Distancia } from "@/lib/geo/tramo";
import { TRAMO_MAS_DE_12_KM, pagoDelTramo } from "@/lib/pagos/reglas";

import { codigoDeDespacho } from "./interpretar";

export interface ComandaParaGuardar {
  /** El número de despacho, 8 dígitos. */
  numero: string;
  /** El pedido que la comanda completa; null para crear uno nuevo. */
  ordenExistenteId: string | null;
  /** El día del pedido existente, o el día al que se añade uno nuevo. */
  fecha: FechaISO;
  /** Solo para un pedido nuevo. */
  ruta: number | null;
  nombre: string;
  telefono: string;
  direccion: string;
  punto: Punto | null;
  distancia: Distancia | null;
  /** Para más de 12 km, que no tiene tarifa: lo que se cobra por ese pedido. */
  montoManualCentimos: number | null;
  /** La imagen de respaldo; null si no hay o no se quiere guardar. */
  evidencia: (() => Promise<Blob>) | null;
}

type Tramo =
  /** El tramo salió de la distancia. */
  | "auto"
  /** Tenía un tramo elegido a mano: se dejó como estaba. */
  | "respetado"
  /** El cálculo automático está apagado en Ajustes. */
  | "apagado"
  /** Más de 12 km y sin monto escrito: falta ese dato. */
  | "falta-monto"
  /** No hay distancia (sin ubicación): el tramo no cambia. */
  | "sin-distancia";

export interface ResultadoDeGuardado {
  ordenId: string;
  fecha: FechaISO;
  creado: boolean;
  tramo: number;
  montoCentimos: number;
  km: number | null;
  tramoDe: Tramo;
}

interface Dependencias {
  /** Guarda la foto del pedido. Se cambia en las pruebas: el sistema de archivos solo existe en el teléfono. */
  guardarFoto: (fecha: FechaISO, ordenId: string, imagen: Blob) => Promise<void>;
}

async function guardarFotoDePedido(fecha: FechaISO, ordenId: string, imagen: Blob): Promise<void> {
  const { borrarPrueba, guardarPrueba, pruebaDeOrden } = await import("@/lib/db/sqlite/pruebas");
  // Un pedido tiene como mucho una foto: la nueva reemplaza a la anterior.
  const previa = await pruebaDeOrden(ordenId);
  if (previa) await borrarPrueba(previa.id);
  await guardarPrueba(fecha, imagen, ordenId);
}

export async function guardarComanda(
  d: ComandaParaGuardar,
  ajustes: AjustesDeComandas,
  dependencias: Dependencias = { guardarFoto: guardarFotoDePedido },
): Promise<ResultadoDeGuardado> {
  if (!/^\d{8}$/.test(d.numero) && !d.ordenExistenteId) {
    throw new Error("El número de despacho tiene que tener 8 dígitos.");
  }
  if (d.fecha > hoyEnLima()) throw new Error("No puedes guardar un pedido con fecha futura.");
  if ((await estadoDeSemana(d.fecha)) === "pagada") {
    throw new Error(
      "Esa semana ya está pagada. Reábrela desde Pagos antes de añadir o completar un pedido, para que el monto liquidado y el historial no se contradigan.",
    );
  }

  const perfil = await perfilActual();
  const { regla } = await reglaVigente(d.fecha, perfil?.tiendaId ?? null, perfil?.vehiculo);

  /* Crear o encontrar el pedido. */
  let ordenId = d.ordenExistenteId;
  let creado = false;
  if (!ordenId) {
    const codigo = codigoDeDespacho(d.numero);
    const yaEsta = await codigosYaRegistrados([codigo]);
    if (yaEsta[codigo]) {
      throw new Error(`El pedido ${codigo} ya está cargado el ${yaEsta[codigo]}. Completa ese en vez de crear otro.`);
    }
    ({ ordenId } = await agregarPedidoManual(d.fecha, {
      codigo,
      ruta: d.ruta,
      estado: "Entregado",
      tramo: 1,
      km: null,
      montoCentimos: pagoDelTramo(regla, 1) ?? 1000,
      tiendaId: perfil?.tiendaId ?? null,
      vehiculo: perfil?.vehiculo,
      horaEntrada: perfil?.horaEntrada ?? null,
      horaSalida: perfil?.horaSalida ?? null,
    }));
    creado = true;
  }

  const jornada = await jornadaPorFecha(d.fecha);
  const actual = jornada?.ordenes.find((o) => o.id === ordenId);
  if (!actual) throw new Error("Ese pedido ya no existe. Recarga el día y vuelve a intentarlo.");

  /* El cliente: solo lo que Ajustes deja guardar y lo que se leyó. */
  const cliente: Partial<DatosDeCliente> = {};
  if (ajustes.guardarNombre && d.nombre.trim()) cliente.nombre = d.nombre;
  if (ajustes.guardarTelefono && d.telefono.trim()) cliente.telefono = d.telefono;
  if (ajustes.guardarDireccion && d.direccion.trim()) cliente.direccion = d.direccion;
  if (ajustes.guardarDireccion && d.punto) {
    cliente.lat = d.punto.lat;
    cliente.lng = d.punto.lng;
  }
  await guardarCliente(ordenId, cliente);

  /* La distancia y el tramo. */
  let tramo = actual.tramo;
  let montoCentimos = actual.montoCentimos ?? pagoDelTramo(regla, actual.tramo) ?? 0;
  let tramoDe: Tramo = "sin-distancia";

  if (d.distancia) {
    const calculado = tramoPorDistancia(regla, d.distancia.km);
    // Un tramo elegido por la persona —distinto del 1 con que nace todo pedido—
    // manda sobre el cálculo.
    const decididoAMano = !actual.tramoAuto && actual.tramo !== 1;

    if (!ajustes.tramoAutomatico) {
      await guardarDistancia(ordenId, { km: d.distancia.km, kmFuente: d.distancia.fuente });
      tramoDe = "apagado";
    } else if (decididoAMano) {
      await guardarDistancia(ordenId, { km: d.distancia.km, kmFuente: d.distancia.fuente });
      tramoDe = "respetado";
    } else if (calculado.tramo === TRAMO_MAS_DE_12_KM && !(d.montoManualCentimos && d.montoManualCentimos > 0)) {
      await guardarDistancia(ordenId, { km: d.distancia.km, kmFuente: d.distancia.fuente });
      tramoDe = "falta-monto";
    } else {
      tramo = calculado.tramo;
      montoCentimos = calculado.montoCentimos ?? (d.montoManualCentimos as number);
      await guardarDistancia(ordenId, {
        km: d.distancia.km,
        kmFuente: d.distancia.fuente,
        tramo,
        montoCentimos,
        tramoAuto: true,
      });
      tramoDe = "auto";
    }
  }

  /* La foto, si se quiere y hay. */
  if (ajustes.guardarFoto && d.evidencia) {
    await dependencias.guardarFoto(d.fecha, ordenId, await d.evidencia());
  }

  return {
    ordenId,
    fecha: d.fecha,
    creado,
    tramo,
    montoCentimos,
    km: d.distancia?.km ?? null,
    tramoDe,
  };
}
