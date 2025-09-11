// Reusable date helpers to replace moment.js usage

export function dayISO(input) {
  // Returns YYYY-MM-DD for provided date; if no input – for today
  let d;
  if (!input) {
    d = new Date();
  } else if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'number') {
    // Accept both seconds and milliseconds
    d = new Date(input < 1e12 ? input * 1000 : input);
  } else if (typeof input === 'string') {
    d = new Date(input);
  } else {
    d = new Date();
  }
  // Use local date instead of UTC to avoid timezone issues
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dayBoundsUnix(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const start = Math.floor(new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000);
  const end = Math.floor(new Date(y, m - 1, d, 23, 59, 59, 999).getTime() / 1000);
  return { start, end };
}

export function addDaysISO(isoDate, deltaDays) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(deltaDays || 0));
  return dt.toISOString().slice(0, 10);
}

export function addMonthsISO(isoDate, deltaMonths) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + Number(deltaMonths || 0));
  return dt.toISOString().slice(0, 10);
}

export function unixToISODate(unixSeconds) {
  if (!unixSeconds) return '';
  return new Date(Number(unixSeconds) * 1000).toISOString().slice(0, 10);
}

export function formatUnixLocale(unixSeconds, locale) {
  const dt = new Date(Number(unixSeconds) * 1000);
  const fmt = new Intl.DateTimeFormat(locale || (localStorage.getItem('locale') || 'en'), {
    dateStyle: 'medium', timeStyle: 'short'
  });
  return fmt.format(dt);
}


