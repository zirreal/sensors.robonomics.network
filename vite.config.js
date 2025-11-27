import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    base: "/",
    // server: { https: true },
    plugins: [
      vue(),
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
      include: [
        "@fortawesome/fontawesome-svg-core",
        "@fortawesome/free-regular-svg-icons",
        "@fortawesome/free-solid-svg-icons",
        "@fortawesome/vue-fontawesome",
      ],
    },
  };
});
