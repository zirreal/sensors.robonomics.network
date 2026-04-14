import { fileURLToPath, URL } from "node:url";

import prerender from "@prerenderer/rollup-plugin";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// for blog
import Markdown from 'unplugin-vue-markdown/vite'
import fs from "fs"
import path from "path"

function getBlogRoutes() {
  const postsDir = path.resolve(__dirname, "src/blog")

  return fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(postsDir, entry.name, "index.md")))
    .map((entry) => `/blog/${entry.name}`)
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    base: "/",
    // server: { https: true },
    plugins: [
      vue({include: [/\.vue$/, /\.md$/]}),
      prerender({
        routes: [
          "/",
          "/privacy-policy",
          "/air-measurements",
          "/altruist-timeline",
          "/altruist-use-cases",
          "/altruist-compare",
          "/altruist-device-info",
          "/altruist-setup",
          "/construction-monitoring",
          "/noise-data-real-estate",
          "/blog",
          // auto-generated blog routes
          ...getBlogRoutes()
        ],
        renderer: "@prerenderer/renderer-puppeteer",
      }),
        Markdown({
        frontmatter: true
      })
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
        "@fortawesome/free-brands-svg-icons",
        "@fortawesome/free-regular-svg-icons",
        "@fortawesome/free-solid-svg-icons",
        "@fortawesome/vue-fontawesome",
      ],
    },
  };
});
