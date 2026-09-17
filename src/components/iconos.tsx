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
