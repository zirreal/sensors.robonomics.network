import { Buffer } from "buffer";
import { createApp } from "vue";
import VueMatomo from "vue-matomo";
import { createHead } from '@vueuse/head'
import App from "./App.vue";
import { usePlugins } from "./plugins";
import "@oddbird/popover-polyfill";

import "./assets/styles/main.css";

window.Buffer = Buffer;

const app = createApp(App).use(createHead()).use(VueMatomo, {
  host: "https://matomo.robonomics.network",
  siteId: 5,
  trackerFileName: "matomo",
}); // matomo analytics
usePlugins(app);

app.mount("#app");
