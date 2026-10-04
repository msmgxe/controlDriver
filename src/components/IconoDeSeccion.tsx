/**
 * El icono animado de una sección de Ajustes: un dibujo que **se mueve de la
 * manera que dice lo que la sección hace** —la paleta cambia de color, el pin
 * rebota, el candado se balancea, la cámara destella— para encontrar la opción
 * por su imagen y no solo por su título.
 */
export type ClaveDeIcono =
  | "paleta"
  | "ubicacion"
  | "comanda"
  | "candado"
  | "llave"
  | "escudo"
  | "respaldo"
  | "camara"
  | "probeta"
  | "lupa"
  | "meta"
  | "sonido"
  | "version";

const ICONOS: Record<ClaveDeIcono, { emoji: string; fondo: string; movimiento: string }> = {
  paleta: { emoji: "🎨", fondo: "bg-[#ffe4f1]", movimiento: "icono-colores" },
  ubicacion: { emoji: "📍", fondo: "bg-[#dff5e6]", movimiento: "icono-bota" },
  comanda: { emoji: "🧾", fondo: "bg-[#fff4d6]", movimiento: "icono-menea" },
  candado: { emoji: "🔒", fondo: "bg-[#e1e8ff]", movimiento: "icono-balanceo" },
  llave: { emoji: "🔑", fondo: "bg-[#fff4d6]", movimiento: "icono-balanceo" },
  escudo: { emoji: "🛡️", fondo: "bg-[#dff5e6]", movimiento: "icono-pulso" },
  respaldo: { emoji: "☁️", fondo: "bg-[#dff1ff]", movimiento: "icono-flota" },
  camara: { emoji: "📷", fondo: "bg-[#ece7ff]", movimiento: "icono-destello" },
  probeta: { emoji: "🧪", fondo: "bg-[#e7f9d9]", movimiento: "icono-menea" },
  lupa: { emoji: "🔍", fondo: "bg-[#e1e8ff]", movimiento: "icono-barre" },
  meta: { emoji: "🎯", fondo: "bg-[#ffe1e1]", movimiento: "icono-pulso" },
  sonido: { emoji: "🔊", fondo: "bg-[#ece7ff]", movimiento: "icono-pulso" },
  version: { emoji: "🚕", fondo: "bg-[#fff4d6]", movimiento: "icono-avanza" },
};

export function IconoDeSeccion({ clave, className = "" }: { clave: ClaveDeIcono; className?: string }) {
  const i = ICONOS[clave];
  return (
    <span aria-hidden className={`grid size-11 shrink-0 place-items-center overflow-hidden rounded-full ${i.fondo} ${className}`}>
      <span className={`text-[22px] leading-none ${i.movimiento}`}>{i.emoji}</span>
    </span>
  );
}
