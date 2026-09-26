"use client";

import { Interruptor } from "@/components/Interruptor";
import { useDatos } from "@/hooks/useDatos";
import {
  guardarAjusteDeComandas,
  leerAjustesDeComandas,
  type AjustesDeComandas,
} from "@/lib/db/sqlite/ajustes";

/**
 * Qué se hace con lo que dice una comanda.
 *
 * Nombre, dirección y teléfono son datos de **otra persona**: el cliente del
 * pedido. Por eso cada uno se guarda o no por separado, nada se guarda sin que
 * se vea antes (salvo que se apague), y por defecto **no viajan en el respaldo**
 * —un respaldo se manda por WhatsApp—.
 *
 * Dos avisos que esta sección tiene que decir, porque son lo único que sale del
 * teléfono:
 *
 *   · buscar la dirección en el mapa manda ese texto al servicio de direcciones
 *     de Android;
 *   · medir «por calles» manda **solo coordenadas** a un servicio de rutas.
 */
export function SeccionComandas() {
  const { datos: ajustes, recargar } = useDatos(() => leerAjustesDeComandas(), [], { conservar: true });

  async function poner(nombre: keyof AjustesDeComandas, valor: boolean) {
    await guardarAjusteDeComandas(nombre, valor);
    recargar();
  }

  if (!ajustes) return <p className="text-sm text-tinta-3">Cargando…</p>;

  const fila = (nombre: keyof AjustesDeComandas, titulo: string, detalle: string) => (
    <Interruptor titulo={titulo} detalle={detalle} activo={ajustes[nombre]} alCambiar={(v) => void poner(nombre, v)} />
  );

  return (
    <div className="flex flex-col">
      <span className="rotulo">Qué guardar del cliente</span>
      <div className="flex flex-col divide-y divide-linea">
        {fila("guardarNombre", "Nombre", "Sirve para encontrar el pedido después.")}
        {fila(
          "guardarDireccion",
          "Dirección",
          "Con ella se mide la distancia y se calcula el tramo. Sin dirección, el tramo se elige a mano.",
        )}
        {fila("guardarTelefono", "Teléfono", "Por si hay que llamar por un pedido.")}
        {fila("guardarFoto", "Foto de la comanda", "Queda como evidencia del pedido, una por pedido.")}
      </div>

      <span className="rotulo mt-4">Al leer una comanda</span>
      <div className="flex flex-col divide-y divide-linea">
        {fila(
          "confirmarSiempre",
          "Revisar cada comanda antes de guardar",
          "Apagado, las que se leen con claridad se guardan juntas y solo revisas las dudosas.",
        )}
        {fila(
          "tramoAutomatico",
          "Calcular el tramo con la distancia",
          "Apagado, el tramo se elige a mano en cada pedido.",
        )}
      </div>

      <span className="rotulo mt-4">Privacidad</span>
      <div className="flex flex-col divide-y divide-linea">
        {fila(
          "clientesEnRespaldo",
          "Incluir a los clientes en el respaldo",
          "Apagado, el respaldo no lleva nombres, teléfonos ni direcciones de clientes.",
        )}
      </div>

      <p className="mt-4 border-t border-linea pt-4 text-xs leading-relaxed text-tinta-3">
        Los datos de tus clientes se quedan en este teléfono, protegidos por tu PIN. Solo salen dos
        cosas: al buscar una dirección en el mapa, el texto de la dirección va al servicio de
        direcciones de Android; y al medir «por calles», solo las coordenadas van a un servicio de
        rutas. Nunca un nombre ni un teléfono.
      </p>
    </div>
  );
}
