import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  build: {
    lib: {
      entry: "./dovekie.js",
      name: "dovekie",
      fileName: "dovekie",
      formats: ["es"],
    },
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
  },
});
