import en from "./en.json";
import ru from "./ru.json";

// default locale
export const defaultLocale = "en";

// for language switcher
export const locales = [
  {
    key: "en",
    value: "English",
  },
  {
    key: "ru",
    value: "Русский",
  },
];

// files with translations
export const languages = {
  en: en,
  ru: ru,
};
