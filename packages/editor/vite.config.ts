import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(pkgDir, "../..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.join(pkgDir, "src"),
      "@config": path.join(rootDir, "config"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
