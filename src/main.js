import { Buffer } from "buffer";
import { createApp } from "vue";
import { createHead } from "@vueuse/head";
import App from "./App.vue";
import { usePlugins } from "./plugins";
import "@oddbird/popover-polyfill";

import "./assets/styles/main.css";

window.Buffer = Buffer;

const app = createApp(App).use(createHead());
usePlugins(app);

app.mount("#app");
