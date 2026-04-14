function normalizeLocale(locale) {
  const l = (locale || localStorage.getItem("locale") || "en").toLowerCase();
  if (l === "en") return "en-GB";
  if (l === "ru") return "ru-RU";
  return locale || l;
}

export function formatDate(date, locale) {
  const dt = new Date(date);
  const fmt = new Intl.DateTimeFormat(normalizeLocale(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return fmt.format(dt);
}

export function formatRelative(date, locale) {
  const dt = new Date(date);
  const diff = Date.now() - dt.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 7) {
    const rtf = new Intl.RelativeTimeFormat(normalizeLocale(locale), { numeric: "auto" });
    // past -> negative
    return rtf.format(-days, "day");
  }

  return formatDate(date, locale);
}

export function formatReadingTime(minutes, locale) {
  const m = Math.max(1, Number(minutes) || 1);
  const nf = new Intl.NumberFormat(normalizeLocale(locale));
  const mm = nf.format(m);
  const l = (locale || localStorage.getItem("locale") || "en").toLowerCase();

  if (l.startsWith("ru")) return `${mm} мин чтения`;
  return `${mm} min read`;
}