async function fetchJson(url) {
  const res = await fetch(url, { credentials: "omit", cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Locally cache reverse-geocoding results to reduce network calls
const REVTTL = 7 * 24 * 3600 * 1000; // 7 days
function keyCity(lat, lon, lang) {
  return `revgeo_city_${lang}_${Number(lat).toFixed(3)}_${Number(lon).toFixed(3)}`;
}
function keyAddr(lat, lon, lang) {
  return `revgeo_addr_${lang}_${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`;
}
function readLS(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.ts !== "number") return null;
    if (Date.now() - obj.ts > ttl) return null;
    return obj.data;
  } catch {
    return null;
  }
}
function writeLS(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// Normalize coordinates and auto-fix common mistakes (swapped lat/lon, out-of-range)
function normalizeCoords(lat, lon) {
  let la = Number(lat);
  let lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return { lat: la, lon: lo };
  // If latitude looks like longitude and vice versa → swap
  if (Math.abs(la) > 90 && Math.abs(lo) <= 90) {
    const t = la; la = lo; lo = t;
  }
  // Clamp latitude and wrap longitude
  la = Math.max(-90, Math.min(90, la));
  lo = ((lo + 180) % 360 + 360) % 360 - 180;
  return { lat: la, lon: lo };
}

function pickCity(addr) {
  return (
    addr?.city ||
    addr?.town ||
    addr?.village ||
    addr?.municipality ||
    addr?.locality ||
    addr?.suburb ||
    addr?.hamlet ||
    addr?.county ||
    addr?.state ||
    ""
  );
}

function buildFromNominatim(j) {
  const a = j?.address || {};
  const country = a.country || "";
  const city = pickCity(a);
  const hood = a.neighbourhood || a.suburb || a.city_district || a.village || "";
  const road = a.road || a.pedestrian || a.footway || a.path || a.cycleway || "";
  const house = a.house_number || "";
  const postcode = a.postcode || "";
  const address = [];
  if (city) address.push(city);
  if (hood && hood !== city) address.push(hood);
  if (road) address.push(road);
  if (house) address.push(house);
  return { country, address, postcode };
}

// Heuristic parsers for common providers (used only to NORMALIZE the response
// of the configured URL; not used for cascading requests)
function buildFromPhoton(j) {
  const p = j?.features?.[0]?.properties || {};
  const country = p.country || "";
  const city = p.city || p.town || p.village || p.locality || p.county || p.state || "";
  const hood = p.suburb || p.neighbourhood || "";
  const road = p.street || p.name || "";
  const house = p.housenumber || "";
  const postcode = p.postcode || "";
  const address = [];
  if (city) address.push(city);
  if (hood && hood !== city) address.push(hood);
  if (road) address.push(road);
  if (house) address.push(house);
  return { country, address, postcode };
}

function buildFromBDC(j) {
  const country = j?.countryName || "";
  const city = j?.city || j?.locality || j?.principalSubdivision || "";
  const address = [];
  if (city) address.push(city);
  return { country, address, postcode: "" };
}

function buildAddressFromAny(json) {
  if (json && json.address) return buildFromNominatim(json);
  if (json && json.features && json.features[0]?.properties) return buildFromPhoton(json);
  if (json && (json.city || json.locality || json.principalSubdivision)) return buildFromBDC(json);
  // Minimal fallback: try to read common fields
  const country = json?.country || "";
  const city = json?.city || json?.town || json?.village || json?.locality || json?.county || json?.state || "";
  const address = city ? [city] : [];
  return { country, address, postcode: json?.postcode || "" };
}

function extractCityFromAny(json) {
  if (json?.address) return pickCity(json.address);
  const p = json?.features?.[0]?.properties;
  if (p) return p.city || p.town || p.village || p.locality || p.county || p.state || "";
  return json?.city || json?.locality || json?.principalSubdivision || json?.state || "";
}

export async function getCityByPos(lat, lon, language = "en") {
  const { lat: la, lon: lo } = normalizeCoords(lat, lon);
  const key = keyCity(la, lo, language);
  const cached = readLS(key, REVTTL);
  if (cached) return cached;

  // Universal URL via config template
  const zoomCity = Number(window?.appSettings?.GEOCODER?.zoom?.city) || 14;
  const tpl = window?.appSettings?.GEOCODER?.urlTemplate ||
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&zoom={zoom}&addressdetails={addressdetails}&accept-language={lang}";
  const url = tpl
    .replace('{lat}', encodeURIComponent(la))
    .replace('{lon}', encodeURIComponent(lo))
    .replace('{zoom}', encodeURIComponent(zoomCity))
    .replace('{addressdetails}', '0')
    .replace('{lang}', encodeURIComponent(language));

  try {
    const data = await fetchJson(url);
    const name = extractCityFromAny(data);
    if (name) { writeLS(key, name); return name; }
  } catch {}

  return "";
}

export async function getAddressByPos(lat, lon, language = "en") {
  const { lat: la, lon: lo } = normalizeCoords(lat, lon);
  const key = keyAddr(la, lo, language);
  const cached = readLS(key, REVTTL);
  if (cached) return cached;

  const zoomAddr = Number(window?.appSettings?.GEOCODER?.zoom?.address) || 18;
  const tpl = window?.appSettings?.GEOCODER?.urlTemplate ||
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&zoom={zoom}&addressdetails={addressdetails}&accept-language={lang}";
  const url = tpl
    .replace('{lat}', encodeURIComponent(la))
    .replace('{lon}', encodeURIComponent(lo))
    .replace('{zoom}', encodeURIComponent(zoomAddr))
    .replace('{addressdetails}', '1')
    .replace('{lang}', encodeURIComponent(language));

  try {
    const data = await fetchJson(url);
    const addr = buildAddressFromAny(data);
    // Guard: sometimes providers return only coordinates or empty string — don't overwrite better cached value
    if (addr && Array.isArray(addr.address) && addr.address.length > 0) {
      writeLS(key, addr);
      return addr;
    }
  } catch {}

  return false;
}
