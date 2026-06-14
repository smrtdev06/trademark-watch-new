import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";
const apiPort = process.env.API_PORT ?? "5002";
const apiTarget = `http://127.0.0.1:${apiPort}`;
const apiProxy = {
  "/api": {
    target: apiTarget,
    changeOrigin: true,
  },
};

export default defineConfig(async ({ command }) => ({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    // Dev-only — keeps production build smaller and uses less RAM on small VPS
    ...(command === "serve" ? [runtimeErrorOverlay()] : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    cssMinify: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      maxParallelFileOps: 2,
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: apiProxy,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: apiProxy,
  },
}));
