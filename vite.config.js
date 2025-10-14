import { fileURLToPath, URL } from "node:url";

import prerender from "@prerenderer/rollup-plugin";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(() => {

  return {
    base: "/",
    // server: { https: true },
    plugins: [
      vue(),
      prerender({
        routes: [
          "/",
          "/privacy-policy",
          "/air-measurements",
          "/altruist-timeline",
          "/altruist-use-cases",
          "/altruist-compare",
        ],
        renderer: "@prerenderer/renderer-puppeteer",
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@config": fileURLToPath(new URL("./src/config", import.meta.url)),
      },
    },
    build: {
      target: ["es2020"],
      rollupOptions: {
        external: (id) => {
          // Externalize problematic internal imports
          if (id.startsWith('#')) {
            return true;
          }
          // Externalize libp2p and related modules
          if (id.includes('libp2p') || id.includes('@multiformats') || id.includes('uint8arrays')) {
            return true;
          }
          return false;
        }
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        target: ["es2020"],
      },
      include: [
        'uint8arrays',
        '@multiformats/multiaddr',
        '@multiformats/mafmt'
      ]
    },
  };
});
