import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
// import mkcert from "vite-plugin-mkcert";
import fs from "node:fs";
import path from "node:path";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // eslint-disable-next-line no-undef
  const env = loadEnv(mode, process.cwd());
  let configEnv = env.VITE_CONFIG_ENV || "default";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  if (!fs.existsSync(path.resolve(__dirname, `src/config/${configEnv}`))) {
    console.error("!!! No config folder found. Used main config. !!!");
    configEnv = "default";
  }

  console.log("Load config:", configEnv);

  return {
    base: "",
    // server: { https: true },
    plugins: [
      vue(),
      // for pwa testing
      // mkcert(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: {
          name: "Robonomics Sensors",
          short_name: "Sensors map",
          description: "Decentralized opensource sensors air monitoring map",
          theme_color: "#333",
          background_color: "#333",
          display: "standalone",
          icons: [
            {
              purpose: "maskable",
              src: "app-icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              purpose: "any",
              src: "app-icon-512-rounded.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "app-icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "app-icon-256.png",
              sizes: "256x256",
              type: "image/png",
            },
            {
              src: "app-icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@config": `/src/config/${configEnv}`,
      },
    },
    build: {
      target: ["es2020"],
    },
    optimizeDeps: {
      esbuildOptions: {
        target: ["es2020"],
      },
    },
  };
});
