import en from "./en";
import ru from "./ru";

export default { en, ru };

export const languages = [
  { code: "en", title: "EN" },
  { code: "ru", title: "RU" },
];

export const defaultLocale = localStorage.getItem("locale") || "en";
