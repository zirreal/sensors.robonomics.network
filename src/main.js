import { Buffer } from "buffer";
import { createApp } from "vue";
import VueMatomo from "vue-matomo";
import App from "./App.vue";
import { usePlugins } from "./plugins";
import "@oddbird/popover-polyfill";
import { registerSW } from "virtual:pwa-register";

import "./assets/styles/main.css";

window.Buffer = Buffer;

const app = createApp(App).use(VueMatomo, {
  host: "https://matomo.robonomics.network/",
  siteId: 5,
}); // matomo analytics
usePlugins(app);

// for pwa
registerSW({ immediate: true });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!window.__reloaded) {
      window.__reloaded = true;
      window.location.reload();
    }
  });
}

app.mount("#app");
