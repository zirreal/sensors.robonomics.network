function hasValue(value) {
  return value !== undefined && value !== null;
}

/**
 * Detect sensor kind from logs.
 *
 * - Returns "insight" when CO2 is present.
 * - Returns "urban" when typical urban measurements are present (noise or PM).
 * - Returns null when logs are empty or inconclusive.
 *
 * Notes:
 * - Some devices can emit mixed payloads; we prefer "urban" if both patterns exist.
 */
export function detectKindFromLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return null;

  let hasCo2 = false;
  let hasUrban = false;

  for (const item of logs) {
    const d = item?.data || {};
    if (hasValue(d.co2)) hasCo2 = true;
    if (hasValue(d.noiseavg) || hasValue(d.noisemax)) hasUrban = true;
    if (hasValue(d.pm25) || hasValue(d.pm10)) hasUrban = true;
    if (hasCo2 && hasUrban) break;
  }

  if (hasUrban) return "urban";
  if (hasCo2) return "insight";
  return null;
}

