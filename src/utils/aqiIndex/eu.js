/*
 * =============================================================================
 * AQI CALCULATOR - EUROPEAN STANDARD (EU/WHO)
 * =============================================================================
 * 
 * EN: Air Quality Index calculation based on European Union standards and WHO guidelines.
 *     Implements the 4-step aggregation algorithm: minutes → hours → time window → AQI.
 *     Uses stricter thresholds compared to US EPA standards for better health protection.
 * 
 * RU: Расчет индекса качества воздуха по стандартам Европейского союза и ВОЗ.
 *     Реализует 4-этапный алгоритм агрегации: минуты → часы → временное окно → AQI.
 *     Использует более строгие пороги по сравнению со стандартами EPA США.
 * 
 * =============================================================================
 * INPUT / ВХОДНЫЕ ДАННЫЕ
 * =============================================================================
 * 
 * EN: logs: Array<{timestamp: number, data: {pm25?: number, pm10?: number}}>
 *     - timestamp: Unix timestamp in seconds
 *     - data.pm25: PM2.5 concentration in µg/m³
 *     - data.pm10: PM10 concentration in µg/m³
 * 
 * RU: logs: Array<{timestamp: number, data: {pm25?: number, pm10?: number}}>
 *     - timestamp: Unix timestamp в секундах
 *     - data.pm25: Концентрация PM2.5 в мкг/м³
 *     - data.pm10: Концентрация PM10 в мкг/м³
 * 
 * =============================================================================
 * OUTPUT / ВЫХОДНЫЕ ДАННЫЕ
 * =============================================================================
 * 
 * EN: number | undefined
 *     - Rounded AQI value (0-500) if sufficient data (≥2 hours)
 *     - undefined if insufficient data or invalid input
 * 
 * RU: number | undefined
 *     - Округленное значение AQI (0-500) при достаточных данных (≥2 часа)
 *     - undefined при недостаточных данных или неверном вводе
 * 
 * =============================================================================
 * EUROPEAN THRESHOLDS (2024-2030) / ЕВРОПЕЙСКИЕ ПОРОГИ (2024-2030)
 * =============================================================================
 * 
 * EN: PM2.5: 0-10-25-50-75-100-150 µg/m³ (vs US: 0-12-35.4-55.4-150.4-250.4-500.4)
 *     PM10:  0-20-40-80-120-200-300 µg/m³ (vs US: 0-54-154-254-354-424-604)
 *     Based on EU 2030 standards and WHO 2021 recommendations
 * 
 * RU: PM2.5: 0-10-25-50-75-100-150 мкг/м³ (vs US: 0-12-35.4-55.4-150.4-250.4-500.4)
 *     PM10:  0-20-40-80-120-200-300 мкг/м³ (vs US: 0-54-154-254-354-424-604)
 *     Основано на стандартах ЕС 2030 года и рекомендациях ВОЗ 2021
 * 
 * =============================================================================
 */

import aqiEUZones from "../../measurements/aqi_eu";

function normalizeReading(x, pollutant) {
  if (!Number.isFinite(x)) return null;
  if (x < 0) return null;
  if (pollutant === 'pm25') return Math.trunc(x * 10) / 10; // Round to 0.1 µg/m³ precision
  return Math.trunc(x); // Round PM10 to whole numbers
}

export function aqiFromConc(conc, pollutant) {
  const c = normalizeReading(conc, pollutant);
  if (c === null) return null;

  // Map EU concentration thresholds to AQI index ranges
  const mapped = [];
  let prevValue = -1; // Initialize to create first zone as [0..value]
  for (const z of aqiEUZones) {
    const bp = z?.[pollutant];
    if (!bp || typeof z.valueMax !== 'number') continue;
    const I_lo = prevValue < 0 ? 0 : prevValue + 1;
    const I_hi = z.valueMax;
    mapped.push({ concentrationMin: bp.concentrationMin, concentrationMax: bp.concentrationMax, I_lo, I_hi });
    prevValue = z.valueMax;
  }

  const bp = mapped.find(b => c >= b.concentrationMin && c <= b.concentrationMax);
  if (bp) {
    const { concentrationMin, concentrationMax, I_lo, I_hi } = bp;
    return ((I_hi - I_lo) / (concentrationMax - concentrationMin)) * (c - concentrationMin) + I_lo;
  }
  if (mapped.length && c > mapped[mapped.length - 1].concentrationMax) return 500;
  return null;
}

function average(array) {
  return array.length ? array.reduce((a, b) => a + b, 0) / array.length : null;
}

export function calculateAQIIndex(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return undefined;

  // Step 1: Temporal aggregation - Group readings into minute buckets
  const minuteBuckets = new Map(); // key: 'YYYY-MM-DD HH:MM' → { pm25: number[], pm10: number[], ts: number }
  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    const tsSec = l?.timestamp;
    if (!Number.isFinite(tsSec)) continue;
    const d = new Date(tsSec * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    if (!minuteBuckets.has(key)) minuteBuckets.set(key, { pm25: [], pm10: [], ts: tsSec });
    const bucket = minuteBuckets.get(key);
    bucket.ts = Math.max(bucket.ts, tsSec);
    const data = l?.data || {};
    if (Number.isFinite(data.pm25) && data.pm25 >= 0) bucket.pm25.push(data.pm25);
    if (Number.isFinite(data.pm10) && data.pm10 >= 0) bucket.pm10.push(data.pm10);
  }

  const minuteAverages = []; // { key, ts, pm25, pm10 }
  minuteBuckets.forEach((v, k) => {
    minuteAverages.push({ key: k, ts: v.ts, pm25: average(v.pm25), pm10: average(v.pm10) });
  });
  if (minuteAverages.length === 0) return undefined;

  // Step 2: Hourly aggregation - Group minute averages into hourly buckets
  const hourBuckets = new Map(); // key: 'YYYY-MM-DD HH' → { pm25: number[], pm10: number[], ts: number }
  for (const m of minuteAverages) {
    const [datePart, hm] = m.key.split(' ');
    const hourKey = `${datePart} ${hm.slice(0,2)}`;
    if (!hourBuckets.has(hourKey)) hourBuckets.set(hourKey, { pm25: [], pm10: [], ts: m.ts });
    const hb = hourBuckets.get(hourKey);
    hb.ts = Math.max(hb.ts, m.ts);
    if (Number.isFinite(m.pm25)) hb.pm25.push(m.pm25);
    if (Number.isFinite(m.pm10)) hb.pm10.push(m.pm10);
  }

  const hourEntries = [];
  hourBuckets.forEach((v, k) => {
    hourEntries.push({ key: k, ts: v.ts, pm25: average(v.pm25), pm10: average(v.pm10) });
  });
  if (hourEntries.length === 0) return undefined;

  // Step 3: Time window selection - Use most recent 2-24 hours of data
  hourEntries.sort((a, b) => a.ts - b.ts);
  const windowHours = hourEntries.slice(-24);
  if (windowHours.length < 2) return undefined;

  // Step 4: AQI calculation - European standard formula
  const pm25Hourly = windowHours.map(h => h.pm25).filter(Number.isFinite);
  const pm10Hourly = windowHours.map(h => h.pm10).filter(Number.isFinite);
  const pm25Avg = average(pm25Hourly);
  const pm10Avg = average(pm10Hourly);

  const aqiPM25 = pm25Avg !== null ? aqiFromConc(pm25Avg, 'pm25') : null;
  const aqiPM10 = pm10Avg !== null ? aqiFromConc(pm10Avg, 'pm10') : null;

  if (aqiPM25 === null && aqiPM10 === null) return undefined;
  
  // European AQI formula: max(PM2.5_AQI, PM10_AQI) with EU thresholds
  const final = Math.max(aqiPM25 ?? 0, aqiPM10 ?? 0);
  
  return Math.round(Math.min(final, 500)); // Cap at maximum AQI value
}

export default calculateAQIIndex;
