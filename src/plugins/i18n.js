import { createI18n } from "vue-i18n";

import { languages } from "../translations/languages.js";
import { defaultLocale } from "../translations/languages.js";

const messages = Object.assign(languages);

export function useI18n(app) {
  const i18n = createI18n({
    locale: localStorage.getItem("locale") || defaultLocale,
    fallbackLocale: defaultLocale,
    messages,
  });

  app.use(i18n);
}
