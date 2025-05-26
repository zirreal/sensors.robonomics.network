import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
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
