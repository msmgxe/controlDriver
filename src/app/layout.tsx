import type { Metadata, Viewport } from "next";
import {
  DM_Mono,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Lora,
  Plus_Jakarta_Sans,
} from "next/font/google";
import "./globals.css";

/* App del driver — dirección Moderna (§9) */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--fuente-jakarta",
  display: "swap",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-dm-mono",
  display: "swap",
});

/* Panel /admin — dirección Profesional */
const lora = Lora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--fuente-lora",
  display: "swap",
});
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-plex",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "RutaLog", template: "%s · RutaLog" },
  description:
    "Registro diario de rutas y pedidos: sube las capturas, revisa y confirma. El resto es consulta.",
  applicationName: "RutaLog",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "RutaLog", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // La app es privada: nada de esto debe indexarse.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff3f2" },
    { media: "(prefers-color-scheme: dark)", color: "#081210" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PE">
      <body
        className={`${jakarta.variable} ${dmMono.variable} ${lora.variable} ${plex.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
