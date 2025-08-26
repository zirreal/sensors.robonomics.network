/*
  AQI (US EPA) helpers
*/

export const breakpoints = {
  pm25: [
    { BP_lo: 0.0,   BP_hi: 12.0,   I_lo: 0,   I_hi: 50 },
    { BP_lo: 12.1,  BP_hi: 35.4,   I_lo: 51,  I_hi: 100 },
    { BP_lo: 35.5,  BP_hi: 55.4,   I_lo: 101, I_hi: 150 },
    { BP_lo: 55.5,  BP_hi: 150.4,  I_lo: 151, I_hi: 200 },
    { BP_lo: 150.5, BP_hi: 250.4,  I_lo: 201, I_hi: 300 },
    { BP_lo: 250.5, BP_hi: 500.4,  I_lo: 301, I_hi: 500 },
  ],
  pm10: [
    { BP_lo: 0,     BP_hi: 54,     I_lo: 0,   I_hi: 50 },
    { BP_lo: 55,    BP_hi: 154,    I_lo: 51,  I_hi: 100 },
    { BP_lo: 155,   BP_hi: 254,    I_lo: 101, I_hi: 150 },
    { BP_lo: 255,   BP_hi: 354,    I_lo: 151, I_hi: 200 },
    { BP_lo: 355,   BP_hi: 424,    I_lo: 201, I_hi: 300 },
    { BP_lo: 425,   BP_hi: 604,    I_lo: 301, I_hi: 500 },
  ]
};

export function getAQILabelAndColor(aqi) {
  if (aqi <= 50)  return { label: "Good",                           color: "var(--measure-green)" };
  if (aqi <= 100) return { label: "Moderate",                       color: "var(--measure-bluegreen)" };
  if (aqi <= 150) return { label: "Unhealthy for Sensitive Groups", color: "var(--measure-yellow)" };
  if (aqi <= 200) return { label: "Unhealthy",                      color: "var(--measure-orange)" };
  if (aqi <= 300) return { label: "Very Unhealthy",                 color: "var(--measure-red)" };
  return               { label: "Hazardous",                        color: "var(--measure-darkred)" };
}

/*
  Валидация и усечение измерений по EPA.
  PM2.5 → до 0.1 µg/m³, PM10 → до целого. Отрицательные/NaN отбрасываются.
*/
function normalizeReading(x, pollutant) {
  if (!Number.isFinite(x)) return null;
  if (x < 0) return null;
  if (pollutant === 'pm25') return Math.trunc(x * 10) / 10;
  return Math.trunc(x);
}

/*
  AQI из концентрации: усечение → поиск брейкпоинта → линейная интерполяция.
  Возвращает null, если данных нет; 500, если выше верхнего порога.
*/
export function aqiFromConc(conc, pollutant) {
  const c = normalizeReading(conc, pollutant);
  if (c === null) return null;

  const arr = breakpoints[pollutant];
  const bp = arr.find(b => c >= b.BP_lo && c <= b.BP_hi);
  if (bp) {
    const { BP_lo, BP_hi, I_lo, I_hi } = bp;
    return ((I_hi - I_lo) / (BP_hi - BP_lo)) * (c - BP_lo) + I_lo;
  }
  if (c > arr[arr.length - 1].BP_hi) return 500;
  return null;
}

/*
  Проверка покрытия истории для realtime:
  минимум minutes минут до последней точки и нет разрывов > maxGapMin.
*/
function hasCoverage(logs, minutes = 60, maxGapMin = 20) {
  if (!logs?.length) return false;

  const latestSec = logs[logs.length - 1].timestamp;
  const startSec = latestSec - minutes * 60;

  const window = [];
  for (let i = logs.length - 1; i >= 0; i--) {
    const t = logs[i].timestamp;
    if (t < startSec) break;
    window.push(logs[i]);
  }
  if (window.length < 2) return false;

  window.reverse();

  if (window[0].timestamp > startSec + maxGapMin * 60) return false;

  let maxGapSec = 0;
  for (let i = 1; i < window.length; i++) {
    const gap = window[i].timestamp - window[i - 1].timestamp;
    if (gap > maxGapSec) maxGapSec = gap;
  }
  return maxGapSec <= maxGapMin * 60;
}

function formatLastUpdated(tsSec) {
  const diffMins = Math.floor((Date.now() - tsSec * 1000) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  const h = Math.floor(diffMins / 60);
  return `${h} hour${h > 1 ? "s" : ""} ago`;
}

/*
  Realtime AQI: считает, только если есть час истории без больших разрывов.
*/
export function getRealtimeAQI(logs) {
  if (!logs?.length) return null;
  const latestLog = logs[logs.length - 1];
  if (!latestLog?.data) return null;

  if (!hasCoverage(logs, 60, 20)) {
    return {
      timestamp: formatLastUpdated(latestLog.timestamp),
      AQI_PM25: null,
      Label_PM25: null,
      Color_PM25: null,
      AQI_PM10: null,
      Label_PM10: null,
      Color_PM10: null,
      Final_AQI: '–',
      Final_Label: 'No Data',
      Final_Color: 'var(--measure-nodata)'
    };
  }

  const pm25Value = Number.isFinite(latestLog.data.pm25) ? latestLog.data.pm25 : null;
  const pm10Value = Number.isFinite(latestLog.data.pm10) ? latestLog.data.pm10 : null;

  const aqiPM25 = pm25Value !== null ? aqiFromConc(pm25Value, 'pm25') : null;
  const aqiPM10 = pm10Value !== null ? aqiFromConc(pm10Value, 'pm10') : null;

  const pm25Info = aqiPM25 !== null ? getAQILabelAndColor(aqiPM25) : null;
  const pm10Info = aqiPM10 !== null ? getAQILabelAndColor(aqiPM10) : null;

  let finalAQI = '–';
  let finalInfo = { label: 'No Data', color: 'var(--measure-nodata)' };
  if (aqiPM25 !== null && aqiPM10 !== null) {
    finalAQI = Math.round(Math.max(aqiPM25, aqiPM10));
    finalInfo = getAQILabelAndColor(finalAQI);
  } else if (aqiPM25 !== null) {
    finalAQI = Math.round(aqiPM25);
    finalInfo = pm25Info;
  } else if (aqiPM10 !== null) {
    finalAQI = Math.round(aqiPM10);
    finalInfo = pm10Info;
  }

  return {
    timestamp: formatLastUpdated(latestLog.timestamp),
    AQI_PM25: aqiPM25 !== null ? Math.round(aqiPM25) : null,
    Label_PM25: pm25Info?.label ?? null,
    Color_PM25: pm25Info?.color ?? null,
    AQI_PM10: aqiPM10 !== null ? Math.round(aqiPM10) : null,
    Label_PM10: pm10Info?.label ?? null,
    Color_PM10: pm10Info?.color ?? null,
    Final_AQI: finalAQI,
    Final_Label: finalInfo.label,
    Final_Color: finalInfo.color
  };
}

/*
  Daily Recap: средние концентрации с 00:00 локального дня → AQI.
  Отрицательные/NaN значения не учитываются. Для дебага — почасовые средние.
*/
export function getTodayAQI(logs) {
  const now = new Date();
  const startOfDayLocal = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0
  ).getTime();

  const todayLogs = (logs || []).filter(l => l.timestamp * 1000 >= startOfDayLocal);

  const pm25All = [];
  const pm10All = [];
  const hourlyData = {};

  todayLogs.forEach(l => {
    const localHour = new Date(l.timestamp * 1000);
    const hourKey = `${localHour.getFullYear()}-${String(localHour.getMonth() + 1).padStart(2,'0')}-${String(localHour.getDate()).padStart(2,'0')} ${String(localHour.getHours()).padStart(2,'0')}`;

    if (!hourlyData[hourKey]) hourlyData[hourKey] = { pm25: [], pm10: [] };

    if (Number.isFinite(l.data?.pm25) && l.data.pm25 >= 0) {
      hourlyData[hourKey].pm25.push(l.data.pm25);
      pm25All.push(l.data.pm25);
    }
    if (Number.isFinite(l.data?.pm10) && l.data.pm10 >= 0) {
      hourlyData[hourKey].pm10.push(l.data.pm10);
      pm10All.push(l.data.pm10);
    }
  });

  const avg = arr => arr.length ? arr.reduce((a,b) => a + b, 0) / arr.length : null;

  const debugTable = [];
  Object.keys(hourlyData).sort().forEach(hour => {
    const pm25avg = avg(hourlyData[hour].pm25);
    const pm10avg = avg(hourlyData[hour].pm10);
    const aqi25 = pm25avg !== null ? aqiFromConc(pm25avg, 'pm25') : null;
    const aqi10 = pm10avg !== null ? aqiFromConc(pm10avg, 'pm10') : null;
    const info25 = aqi25 !== null ? getAQILabelAndColor(aqi25) : null;
    const info10 = aqi10 !== null ? getAQILabelAndColor(aqi10) : null;

    debugTable.push({
      hour,
      pm25avg: pm25avg !== null ? pm25avg.toFixed(2) : null,
      aqiPM25: aqi25 !== null ? Math.round(aqi25) : null,
      labelPM25: info25?.label ?? null,
      colorPM25: info25?.color ?? null,
      pm10avg: pm10avg !== null ? pm10avg.toFixed(2) : null,
      aqiPM10: aqi10 !== null ? Math.round(aqi10) : null,
      labelPM10: info10?.label ?? null,
      colorPM10: info10?.color ?? null
    });
  });

  const pm25DayAvg = avg(pm25All);
  const pm10DayAvg = avg(pm10All);

  const aqiPM25 = pm25DayAvg !== null ? aqiFromConc(pm25DayAvg, 'pm25') : null;
  const aqiPM10 = pm10DayAvg !== null ? aqiFromConc(pm10DayAvg, 'pm10') : null;

  let finalAQI = '–';
  let finalInfo = { label: 'No Data', color: 'var(--measure-nodata)' };
  if (aqiPM25 !== null || aqiPM10 !== null) {
    const val = Math.max(aqiPM25 ?? 0, aqiPM10 ?? 0);
    finalAQI = Math.round(val);
    finalInfo = getAQILabelAndColor(finalAQI);
  }

  return {
    debugTable,
    AQI_PM25: aqiPM25 !== null ? Math.round(aqiPM25) : null,
    Label_PM25: aqiPM25 !== null ? getAQILabelAndColor(aqiPM25).label : null,
    Color_PM25: aqiPM25 !== null ? getAQILabelAndColor(aqiPM25).color : null,
    AQI_PM10: aqiPM10 !== null ? Math.round(aqiPM10) : null,
    Label_PM10: aqiPM10 !== null ? getAQILabelAndColor(aqiPM10).label : null,
    Color_PM10: aqiPM10 !== null ? getAQILabelAndColor(aqiPM10).color : null,
    Final_AQI: finalAQI,
    Final_Label: finalInfo.label,
    Final_Color: finalInfo.color
  };
}
