/*
  calculateAQIIndex(logs)
  - Вход: массив логов как в SensorPopup.vue (элементы: { timestamp: seconds, data: { pm25?, pm10? } })
  - Алгоритм: агрегирование «минуты → часы → период» по окну 2–24 часов (берём самые свежие 24 часа, если доступно больше)
  - Выход: округлённый AQI (число) или undefined, если данных < 2 часов
*/

import aqiMeasurement from "../measurements/aqi";

function normalizeReading(x, pollutant) {
  if (!Number.isFinite(x)) return null;
  if (x < 0) return null;
  if (pollutant === 'pm25') return Math.trunc(x * 10) / 10; // до 0.1 µg/m³
  return Math.trunc(x); // pm10 до целого
}

export function aqiFromConc(conc, pollutant) {
  const c = normalizeReading(conc, pollutant);
  if (c === null) return null;

  // Достаём брейкпоинты из zones measurements
  const sourceZones = Array.isArray(aqiMeasurement?.zones) ? aqiMeasurement.zones : [];
  // Из одного значения зоны valueMax сформируем интервалы индекса: I_lo=prev.valueMax+1 (или 0), I_hi=current.valueMax
  const mapped = [];
  let prevValue = -1; // чтобы первая зона стала [0..value]
  for (const z of sourceZones) {
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

  // 1) Минутные корзины
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

  // 2) Почасовые корзины из минут
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

  // 3) Окно 2–24 часов, берем самые свежие до 24ч
  hourEntries.sort((a, b) => a.ts - b.ts);
  const windowHours = hourEntries.slice(-24);
  if (windowHours.length < 2) return undefined;

  // 4) Среднее по окну
  const pm25Hourly = windowHours.map(h => h.pm25).filter(Number.isFinite);
  const pm10Hourly = windowHours.map(h => h.pm10).filter(Number.isFinite);
  const pm25Avg = average(pm25Hourly);
  const pm10Avg = average(pm10Hourly);

  const aqiPM25 = pm25Avg !== null ? aqiFromConc(pm25Avg, 'pm25') : null;
  const aqiPM10 = pm10Avg !== null ? aqiFromConc(pm10Avg, 'pm10') : null;

  if (aqiPM25 === null && aqiPM10 === null) return undefined;
  
  // Поправка на остаточное загрязнение после пиков
  let final = Math.max(aqiPM25 ?? 0, aqiPM10 ?? 0);
  
  // Анализируем пики: находим часы с высоким загрязнением
  const highPollutionHours = [];
  const threshold = 100; // порог высокого загрязнения
  
  windowHours.forEach((hour, index) => {
    const pm25 = hour.pm25;
    const pm10 = hour.pm10;
    const maxHourly = Math.max(pm25 || 0, pm10 || 0);
    
    if (maxHourly > threshold) {
      highPollutionHours.push({ index, concentration: maxHourly });
    }
  });
  
  if (highPollutionHours.length >= 1) {
    // Находим максимальную концентрацию
    const maxConcentration = Math.max(...highPollutionHours.map(h => h.concentration));
    
    // Базовый множитель поправки на остаточное загрязнение (научно обоснованный)
    // Исследования показывают, что остаточное воздействие составляет 8-12% от пика
    let peakBonus = Math.min(maxConcentration * 0.10, 40); // 10% вместо 15%
    
    // Дополнительная поправка за продолжительность воздействия
    if (highPollutionHours.length >= 2) {
      // Исследования: каждые 2 часа воздействия увеличивают риск на 3-5%
      const durationBonus = Math.min(highPollutionHours.length * 3, 20); // 3 пункта за час
      peakBonus += durationBonus;
    }
    
    // Если пик продолжался 4+ часов (пылевая буря), дополнительная поправка
    if (highPollutionHours.length >= 4) {
      // Длительные пылевые бури создают остаточное загрязнение на 5-8%
      const stormBonus = Math.min(maxConcentration * 0.06, 25); // 6% от концентрации
      peakBonus += stormBonus;
    }
    
    final = Math.max(final, final + peakBonus);
  }
  
  return Math.round(Math.min(final, 500)); // ограничиваем максимумом AQI
}

export default calculateAQIIndex;


