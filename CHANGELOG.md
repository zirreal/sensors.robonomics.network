v2.1.0 (draft)
- Fix: Realtime glitch for Chart in sensor pop-up
- Fix: "Units of measurement" glith in sensor pop-up
- Fix: removed PWA for now (to fix blank page bug)
- Style: removed unnecessary titles and zoom for Highcharts
- Refactor: added VALID_DATA_PROVIDERS to config to escape wrong values for provider (took from localStorage or route) and store in one place titles for data providers
- Style: sensor pop-up rearranged sections
- Refactor: added DEFAULT_MEASURE_TYPE and checking for activeUnit taken from URL as a param
- Refactor: if no data for active type unit selected, show something available in the Chart (Sensor pop-up)
- Style: replaced unclear legends in a chart of snesor pop-up with human-readable ones
- Style: Units of measurement - rearranged and replaced names with human-readable ones
- Fix: tweaked Noise grades, PM2.5 grades, Radiation grades; added names for PM2.5 and PM10; added grades for Pressure

v2.0.1
- Feat: In sensor's popup has been added switcher "Realtime / Daily recap"

v2.0.0
- Loading events for sensor pop-up