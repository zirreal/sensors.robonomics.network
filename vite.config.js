import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
import fs from "node:fs";
import path from "node:path";
import nodePolyfills from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
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
    plugins: [
      vue(),
      nodePolyfills({
        protocolImports: true,
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@config": `/src/config/${configEnv}`,

        // Node polyfills
        crypto: "crypto-browserify",
        stream: "stream-browserify",
        buffer: "buffer",
        util: "util",
      },
    },
    define: {
      global: "globalThis",
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
