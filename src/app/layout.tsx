import type { Metadata, Viewport } from "next";
import {
  Barlow,
  Barlow_Condensed,
  Bricolage_Grotesque,
  DM_Sans,
  Figtree,
  Fredoka,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Lora,
  Manrope,
  Nunito,
  Space_Grotesk,
  Unbounded,
} from "next/font/google";
import Script from "next/script";

import { VigilanteDeApariencia } from "@/components/Apariencia";
import { AvisoLegal } from "@/components/AvisoLegal";
import { SplashDeMarca } from "@/components/SplashDeMarca";
import { SCRIPT_INICIAL } from "@/lib/apariencia";
import "./globals.css";

/* App del driver. Seis caras, una por tema (ver `src/lib/apariencia.ts`):
     · claro   → «Mapa» (D): Unbounded para títulos y cifras, DM Sans para el texto;
     · oscuro  → «Asfalto» (B): Barlow Condensed para títulos y cifras, Barlow
       para el texto;
     · turbo   → propuesta A: Fredoka para títulos y cifras, Nunito para el texto;
     · menta   → propuesta C: Bricolage Grotesque para títulos y cifras, Figtree
       para el texto;
     · arcilla → terracota y beige: Space Grotesk para títulos y cifras, Inter
       para el texto;
     · avispa  → negro y amarillo: Manrope para todo, títulos y texto.
   JetBrains Mono es de las seis: los códigos de pedido tienen que leerse
   carácter a carácter. `next/font` las descarga al compilar y las mete dentro
   del APK: funcionan sin internet. */
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--fuente-unbounded",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-dm-sans",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--fuente-barlow-condensed",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-barlow",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--fuente-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--fuente-nunito",
  display: "swap",
});

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

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--fuente-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--fuente-manrope",
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
  title: { default: "Control Driver", template: "%s · Control Driver" },
  description:
    "Registro diario de rutas y pedidos: sube las capturas, revisa y confirma. El resto es consulta.",
  applicationName: "Control Driver",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Control Driver", statusBarStyle: "default" },
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
    { media: "(prefers-color-scheme: light)", color: "#e6eef8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* `suppressHydrationWarning`: el script de abajo pone `data-modo` en esta
       etiqueta antes de que React arranque, y React no tiene por qué saberlo. */
    <html lang="es-PE" suppressHydrationWarning>
      <body
        className={`${unbounded.variable} ${dmSans.variable} ${barlowCondensed.variable} ${barlow.variable} ${fredoka.variable} ${nunito.variable} ${bricolage.variable} ${figtree.variable} ${jetbrains.variable} ${spaceGrotesk.variable} ${inter.variable} ${manrope.variable} ${lora.variable} ${plex.variable} ${plexMono.variable} antialiased`}
      >
        {/* Antes que nada: elige la cara clara u oscura, para que no haya un
            fogonazo del tema equivocado al abrir la app. */}
        <Script id="modo-inicial" strategy="beforeInteractive">
          {SCRIPT_INICIAL}
        </Script>
        <VigilanteDeApariencia />
        <SplashDeMarca />
        <AvisoLegal>{children}</AvisoLegal>
      </body>
    </html>
  );
}
