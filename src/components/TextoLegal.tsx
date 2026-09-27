/**
 * El texto del aviso legal: propiedad de la app y protección de los datos de
 * los clientes. Aparece en dos sitios —la puerta de entrada (`AvisoLegal`) y
 * "Términos y privacidad" en Ajustes—, siempre con estas mismas palabras: si
 * el texto cambia, cambia aquí y sube `VERSION_TERMINOS` (`lib/terminos.ts`)
 * para que se vuelva a pedir la aceptación.
 */

const CLAUSULAS = [
  {
    titulo: "1. Propiedad",
    texto:
      "Control Driver es una aplicación de Marco Saldarriaga Medina. Su código, su diseño y su funcionamiento están protegidos por derechos de autor; no se puede copiar, distribuir ni modificar sin permiso escrito.",
  },
  {
    titulo: "2. Los datos de tus clientes",
    texto:
      "Al leer una comanda, la app puede guardar el nombre, el teléfono y la dirección del cliente de ese pedido. Son datos de una tercera persona, no tuyos, y existen solo para que puedas completar y encontrar tus entregas.",
  },
] as const;

const COMPROMISOS = [
  "No compartir, publicar, vender ni difundir por ningún medio —redes sociales, mensajería, terceros— los datos de tus clientes.",
  "No usarlos para ningún fin distinto de completar la entrega de ese pedido.",
  "Eres tú quien decide activar o no cada dato en Ajustes; lo que actives, es tu responsabilidad protegerlo.",
] as const;

const CLAUSULAS_FINALES = [
  {
    titulo: "4. Dónde viven esos datos",
    texto:
      "Se guardan solo en este teléfono, protegidos por tu PIN, y no se envían a ningún servidor. No entran en tu respaldo salvo que tú lo actives a propósito.",
  },
  {
    titulo: "5. Responsabilidad",
    texto:
      "El uso indebido de los datos de tus clientes es tu responsabilidad, conforme a la Ley N.º 29733 (Ley de Protección de Datos Personales) y sus modificatorias. Marco Saldarriaga Medina no responde por el uso que le des a esos datos fuera de la aplicación.",
  },
  {
    titulo: "6. Si este aviso cambia",
    texto: "Si más adelante se modifican estas condiciones, se te van a volver a pedir antes de seguir usando la app.",
  },
] as const;

export function TextoLegal() {
  return (
    <div className="flex flex-col gap-3.5 text-sm text-tinta-2">
      {CLAUSULAS.map((c) => (
        <div key={c.titulo}>
          <h4 className="mb-0.5 text-xs font-bold tracking-wide text-tinta uppercase">{c.titulo}</h4>
          <p>{c.texto}</p>
        </div>
      ))}

      <div>
        <h4 className="mb-0.5 text-xs font-bold tracking-wide text-tinta uppercase">
          3. Lo que te comprometes a no hacer
        </h4>
        <ol className="list-decimal space-y-1 pl-4">
          {COMPROMISOS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </div>

      {CLAUSULAS_FINALES.map((c) => (
        <div key={c.titulo}>
          <h4 className="mb-0.5 text-xs font-bold tracking-wide text-tinta uppercase">{c.titulo}</h4>
          <p>{c.texto}</p>
        </div>
      ))}
    </div>
  );
}

/** "© 2026 Marco Saldarriaga Medina. Todos los derechos reservados." */
export function LineaCopyright({ className }: { className?: string }) {
  return <p className={className}>© 2026 Marco Saldarriaga Medina. Todos los derechos reservados.</p>;
}
