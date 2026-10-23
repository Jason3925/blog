import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { site } from "../../config/site.ts";
import { contentPostsPlugin } from "./vite-plugin-content.ts";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(pkgDir, "../..");
const configDir = path.join(rootDir, "config");
const blogDist = process.env.BLOG_DIST;

export default defineConfig({
  base: site.base,
  build: blogDist ? { outDir: path.resolve(blogDist), emptyOutDir: true } : undefined,
  plugins: [react(), tailwindcss(), contentPostsPlugin(rootDir, site.base)],
  resolve: {
    alias: {
      "@": path.join(pkgDir, "src"),
      "@config": configDir,
    },
  },
  server: {
    fs: {
      allow: [rootDir],
    },
  },
});
