/**
 * vite.config.ts  — Vercel-compatible build config
 *
 * Changes from the original Manus version:
 *   - Removed vite-plugin-manus-runtime (Manus platform only)
 *   - Removed vitePluginManusDebugCollector (writes to local fs, no-op on Vercel)
 *   - Removed jsxLocPlugin (dev-only Manus debugger)
 *   - Added proxy for /api/* → local Express dev server (dev only)
 *   - sourcemap: false in production (prevents source leak)
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },

  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),

  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // IMPORTANT: never expose source maps in production
    sourcemap: false,
  },

  server: {
    host: true,
    // In dev, proxy API calls to the local Express server
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});