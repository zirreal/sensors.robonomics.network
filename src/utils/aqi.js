export const breakpoints = {
  pm25: [
    { BP_lo: 0.0,   BP_hi: 9.0,   I_lo: 0,   I_hi: 50 },
    { BP_lo: 9.1,  BP_hi: 35.4,   I_lo: 51,  I_hi: 100 },
    { BP_lo: 35.5,  BP_hi: 55.4,   I_lo: 101, I_hi: 150 },
    { BP_lo: 55.5,  BP_hi: 125.4,  I_lo: 151, I_hi: 200 },
    { BP_lo: 125.5, BP_hi: 225.4,  I_lo: 201, I_hi: 300 },
    { BP_lo: 225.5, BP_hi: 504,  I_lo: 301, I_hi: 500 },
  ],
  pm10: [
    { BP_lo: 0,     BP_hi: 54,     I_lo: 0,   I_hi: 50 },
    { BP_lo: 55,    BP_hi: 154,    I_lo: 51,  I_hi: 100 },
    { BP_lo: 155,   BP_hi: 254,    I_lo: 101, I_hi: 150 },
    { BP_lo: 255,   BP_hi: 354,    I_lo: 151, I_hi: 200 },
    { BP_lo: 355,   BP_hi: 424,    I_lo: 201, I_hi: 300 },
    { BP_lo: 425,   BP_hi: 504,    I_lo: 301, I_hi: 500 },
  ]
};

export function getAQILabelAndColor(aqi) {
  if (aqi <= 50) return { label: "Good", color: "var(--measure-green)" };         
  if (aqi <= 100) return { label: "Moderate", color: "var(--measure-bluegreen)" };   
  if (aqi <= 150) return { label: "Unhealthy", color: "var(--measure-yellow)" };
  if (aqi <= 200) return { label: "Very Unhealthy", color: "var(--measure-orange)" };    
  if (aqi <= 300) return { label: "Unacceptable", color: "var(--measure-red)" }; 
  return { label: "Hazardous", color: "var(--measure-darkred)" };
}              

export function calcAQI(concentration, pollutant) {
  const bp = breakpoints[pollutant].find(b =>
    concentration >= b.BP_lo && concentration <= b.BP_hi
  );
  if (!bp) return null;
  const { BP_lo, BP_hi, I_lo, I_hi } = bp;
  return ((I_hi - I_lo) / (BP_hi - BP_lo)) * (concentration - BP_lo) + I_lo;
}

export function getTodayAQI(logs) {
  const now = new Date();

  const startOfDayLocal = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0
  ).getTime();

  // Filter logs from local 00:00
  const todayLogs = logs.filter(l => l.timestamp * 1000 >= startOfDayLocal);

  const hourlyData = {};
  todayLogs.forEach(l => {
    const localHour = new Date(l.timestamp * 1000);
    const hourKey = `${localHour.getFullYear()}-${String(localHour.getMonth() + 1).padStart(2,'0')}-${String(localHour.getDate()).padStart(2,'0')} ${String(localHour.getHours()).padStart(2,'0')}`;

    if (!hourlyData[hourKey]) hourlyData[hourKey] = { pm25: [], pm10: [] };
    if (typeof l.data.pm25 === "number" && l.data.pm25 > 0) {
      hourlyData[hourKey].pm25.push(l.data.pm25);
    }
    if (typeof l.data.pm10 === "number" && l.data.pm10 > 0) {
      hourlyData[hourKey].pm10.push(l.data.pm10);
    }
  });

  const debugTable = [];
  const hourlyAQIs = { pm25: [], pm10: [] };

  for (const hour of Object.keys(hourlyData).sort()) {
    const pm25Values = hourlyData[hour].pm25.filter(v => v > 0);
    const pm10Values = hourlyData[hour].pm10.filter(v => v > 0);

    const worstPM25 = pm25Values.length ? Math.max(...pm25Values) : null;
    const worstPM10 = pm10Values.length ? Math.max(...pm10Values) : null;

    const aqiPM25 = worstPM25 !== null ? calcAQI(worstPM25, 'pm25') : null;
    const aqiPM10 = worstPM10 !== null ? calcAQI(worstPM10, 'pm10') : null;

    if (aqiPM25 !== null) {
      hourlyAQIs.pm25.push(aqiPM25);
    }
    if (aqiPM10 !== null) {
      hourlyAQIs.pm10.push(aqiPM10);
    }

    const pm25Info = aqiPM25 !== null ? getAQILabelAndColor(aqiPM25) : { label: "No data", color: "var(--measure-nodata)" };
    const pm10Info = aqiPM10 !== null ? getAQILabelAndColor(aqiPM10) : { label: "No data", color: "var(--measure-nodata)" };

    const worstPollutant = aqiPM25 !== null && aqiPM10 !== null
      ? (aqiPM25 >= aqiPM10 ? "PM2.5" : "PM10")
      : (aqiPM25 !== null ? "PM2.5" : aqiPM10 !== null ? "PM10" : "None");

    const worstColor = aqiPM25 !== null && aqiPM10 !== null
      ? (aqiPM25 >= aqiPM10 ? pm25Info.color : pm10Info.color)
      : (aqiPM25 !== null ? pm25Info.color : aqiPM10 !== null ? pm10Info.color : "var(--measure-nodata)");

    debugTable.push({
      hour,
      worstPM25: worstPM25 !== null ? worstPM25.toFixed(2) : "-",
      aqiPM25: aqiPM25 !== null ? Math.round(aqiPM25) : "-",
      labelPM25: pm25Info.label,
      colorPM25: pm25Info.color,
      worstPM10: worstPM10 !== null ? worstPM10.toFixed(2) : "-",
      aqiPM10: aqiPM10 !== null ? Math.round(aqiPM10) : "-",
      labelPM10: pm10Info.label,
      colorPM10: pm10Info.color,
      worstPollutant,
      worstColor
    });
  }

  const worstAQIpm25 = hourlyAQIs.pm25.length ? Math.max(...hourlyAQIs.pm25) : null;
  const worstAQIpm10 = hourlyAQIs.pm10.length ? Math.max(...hourlyAQIs.pm10) : null;

  let finalAQI, finalInfo;
  if (worstAQIpm25 === null && worstAQIpm10 === null) {
    finalAQI = "-";
    finalInfo = { label: "No data", color: "var(--measure-nodata)" };
  } else {
    finalAQI = Math.round(Math.max(worstAQIpm25 ?? 0, worstAQIpm10 ?? 0));
    finalInfo = getAQILabelAndColor(finalAQI);
  }

  // console.table(debugTable);

  return {
    debugTable,
    AQI_PM25: worstAQIpm25 !== null ? Math.round(worstAQIpm25) : "-",
    Label_PM25: worstAQIpm25 !== null ? getAQILabelAndColor(worstAQIpm25).label : "No data",
    Color_PM25: worstAQIpm25 !== null ? getAQILabelAndColor(worstAQIpm25).color : "var(--measure-nodata)",
    AQI_PM10: worstAQIpm10 !== null ? Math.round(worstAQIpm10) : "-",
    Label_PM10: worstAQIpm10 !== null ? getAQILabelAndColor(worstAQIpm10).label : "No data",
    Color_PM10: worstAQIpm10 !== null ? getAQILabelAndColor(worstAQIpm10).color : "var(--measure-nodata)",
    Final_AQI: finalAQI,
    Final_Label: finalInfo.label,
    Final_Color: finalInfo.color
  };
}



