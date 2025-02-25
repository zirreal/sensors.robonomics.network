import en from "./en";
import ru from "./ru";

export default { en, ru };

export const languages = [
  { code: "en", title: "English" },
  { code: "ru", title: "Русский" },
];

export const defaultLanguage = localStorage.getItem("locale") || "en";
