import { createPinia } from "pinia";
import polkadot from "robonomics-interface-vue";
import VueClipboard from "vue3-clipboard";
import router from "../router";
import { useFilters } from "./filters";
import { useIcons } from "./fontawesome";
import { useI18n } from "./i18n";
import { useNotification } from "./notification";

export function usePlugins(app) {
  app.use(createPinia());
  app.use(router);
  app.use(VueClipboard, {
    autoSetContainer: true,
    appendToBody: true,
  });
  app.use(polkadot, {
    start: false,
    endpoint: "wss://polkadot.rpc.robonomics.network/",
  });
  useI18n(app);
  useIcons(app);
  useFilters(app);
  useNotification(app);
}
