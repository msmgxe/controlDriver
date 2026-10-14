import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pe.rutasa.app',
  appName: 'Control Driver',
  webDir: 'out',
  plugins: {
    // Android 14/15 dibuja la app bajo las barras del sistema: los márgenes los pone
    // MainActivity, así la cabecera y la barra de abajo no quedan tapadas.
    SystemBars: { insetsHandling: 'disable' },
  },
};

export default config;
