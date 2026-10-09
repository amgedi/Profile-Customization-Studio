import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build output goes to apps/studio/dist (build output only, never source).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5183, strictPort: true },
  build: { target: "es2022", outDir: "dist" },
});
