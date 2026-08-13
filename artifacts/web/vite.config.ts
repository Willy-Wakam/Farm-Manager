import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), 
  VitePWA({
  registerType: "prompt",

  manifest: {
    name: "Farm Manager",
    short_name: "Farm Manager",
    description: "Application de gestion de ferme avicole",
    start_url: basePath,
    scope: basePath,
    display: "standalone",
    theme_color: "#ffffff",
    background_color: "#ffffff",
  },

  devOptions: {
    enabled: true,

    // Autorise les routes SPA comme /dashboard,
    // mais pas /api/*
    navigateFallbackAllowlist: [
      /^\/(?!api\/).*/,
    ],
  },

  workbox: {
    navigateFallback: "index.html",

    globPatterns: [
      "**/*.{js,css,html,ico,png,svg,webp}",
    ],
  },
  }), 
  ],
   
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port,
    host: "0.0.0.0",
    proxy: {
      "/api": "http://localhost:8080",  // proxy vers l'API en dev
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});