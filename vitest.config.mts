import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Por ahora todo lo probado son funciones puras: fusión, validaciones y
    // liquidación. Cuando haya componentes se añade un proyecto con jsdom.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
