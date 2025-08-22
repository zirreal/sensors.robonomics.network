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
    },
    optimizeDeps: {
      esbuildOptions: {
        target: ["es2020"],
      },
    },
  };
});
