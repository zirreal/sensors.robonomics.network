import { createI18n } from "vue-i18n";

import messages from "../translate";
import { defaultLocale } from "../translate";

export function useI18n(app) {
  const i18n = createI18n({
    locale: localStorage.getItem("locale") || defaultLocale,
    fallbackLocale: defaultLocale,
    messages,
  });

  app.use(i18n);
}
