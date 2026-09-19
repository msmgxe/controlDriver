import type { Metadata, Viewport } from "next";
import {
  DM_Mono,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Lora,
  Plus_Jakarta_Sans,
  Bricolage_Grotesque,
  Figtree,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

/* App del driver — dirección Moderna (§9) */
/* Las de la infografía, que gustaron más: Bricolage para los títulos y las
   cifras grandes —tiene carácter sin ser difícil de leer—, Figtree para el
   texto, y JetBrains Mono para los códigos de pedido, que tienen que leerse
   carácter a carácter. `next/font` las descarga al compilar y las mete dentro
   del APK: funcionan sin internet. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--fuente-bricolage",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-figtree",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-jetbrains",
  display: "swap",
});

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
  title: { default: "Rutas-A", template: "%s · Rutas-A" },
  description:
    "Registro diario de rutas y pedidos: sube las capturas, revisa y confirma. El resto es consulta.",
  applicationName: "Rutas-A",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Rutas-A", statusBarStyle: "default" },
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
        className={`${bricolage.variable} ${figtree.variable} ${jetbrains.variable} ${jakarta.variable} ${dmMono.variable} ${lora.variable} ${plex.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
