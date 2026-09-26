/**
 * Iconos de la interfaz.
 *
 * Trazo sobre `currentColor`, así que heredan el color del texto y funcionan en
 * los dos temas sin tocarlos. Se dibujan a mano en vez de traer una librería:
 * son once y pesan menos que cualquier dependencia.
 */

type Props = React.SVGProps<SVGSVGElement>;

function Base({ children, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Casa = (p: Props) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </Base>
);

export const Calendario = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9.5h18M8 3v3M16 3v3" />
  </Base>
);

export const Cartera = (p: Props) => (
  <Base {...p}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17z" />
    <path d="M3 8.5V7a2 2 0 0 1 2-2h11" />
    <circle cx="16.5" cy="12.5" r="1.3" />
  </Base>
);

export const Barras = (p: Props) => (
  <Base {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Base>
);

export const Gente = (p: Props) => (
  <Base {...p}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.5" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 3.6a4 4 0 0 1 0 6.8" />
  </Base>
);

export const Menu = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const Salir = (p: Props) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Base>
);

export const Subir = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <path d="M12 17V4" />
    <path d="m6.5 9.5 5.5-5.5 5.5 5.5" />
    <path d="M4 18v2h16v-2" />
  </Base>
);

export const Check = (p: Props) => (
  <Base strokeWidth={2.4} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const Alerta = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);

export const Equis = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-6 6M9 9l6 6" />
  </Base>
);

export const Medio = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
  </Base>
);

export const Reloj = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);

export const Flecha = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);

export const Candado = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Base>
);

export const Huella = (p: Props) => (
  <Base {...p}>
    <path d="M12 3a7 7 0 0 0-7 7v3a9 9 0 0 1-.6 3.2" />
    <path d="M19 10a7 7 0 0 0-2.1-5" />
    <path d="M8.5 10a3.5 3.5 0 0 1 7 0v3c0 1.6-.3 3.2-.9 4.7" />
    <path d="M12 10v3.5c0 2.3-.5 4.5-1.4 6.5" />
    <path d="M19 13.5c0 2.3-.3 4.5-1 6.5" />
  </Base>
);

export const Hoja = (p: Props) => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Base>
);

export const Trofeo = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M9 20h6M12 14v6" />
  </Base>
);

export const Buscar = (p: Props) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 5 5" />
  </Base>
);

/** Un día de descanso. */
export const Luna = (p: Props) => (
  <Base {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Base>
);

export const Camara = (p: Props) => (
  <Base {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
    <circle cx="12" cy="13.5" r="3.2" />
  </Base>
);

export const Mas = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Base>
);

export const Usuario = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.5v-1a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v1" />
  </Base>
);

/** La comanda: un papel de despacho, con su recorte abajo. */
export const Ticket = (p: Props) => (
  <Base {...p}>
    <path d="M5 3h14v18l-2.3-1.6L14.5 21 12 19.4 9.5 21l-2.2-1.6L5 21z" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
  </Base>
);

export const Pin = (p: Props) => (
  <Base {...p}>
    <path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Base>
);

export const Ojo = (p: Props) => (
  <Base {...p}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const Telefono = (p: Props) => (
  <Base {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Base>
);

export const Enlace = (p: Props) => (
  <Base {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Base>
);

export const Lista = (p: Props) => (
  <Base {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Base>
);

export const Mas2 = (p: Props) => (
  <Base strokeWidth={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
