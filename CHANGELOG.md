vx.x.x
- Fix: timeline within points in a sensor's chart
- Refactor: new structure for the header
- Refactor: improved sensor's popup for small screens
- Fix: overflow width scrolling for a sensor's popup
- Feat: dark mode support
- Refactor: improved code for the 'Measurements' page
- Docs: new page about use cases of air sensor
- Feat: added units in chart
- Fix: removed update chart in 'Daily recap' mode
- Feat: combined Temperature and Humidity in one group
- Feat: added navigation icon
- Refactor: images paths structruzed better
- Feat: static pages prerender for SEO
- Refactor: Pinia store structure refactoring
- Refactor: no geo popup (slight redesign)
- Refactor: default measure type in config moved to "map section" added usage of the default measure from config
- Refactor: added using of Roseman api, instead of BroadCasting for getting sensors list

v2.1.6
- Feat: combined dust and noise values in the chart

v2.1.5
- Refactor: added in sensor's chart checking if data is duplicated
- Refactor: added as DEFAULT_MEASURE_TYPE PM 2.5 value
- Fix: Radiation naming fixed
- Feat: added release info and bage about Polkadot (added REPO_NAME in config)
- Fix: name of sensor removed reloading on new points in Realtime
- Feat: added CO₂ unit
- Fix: fixed units file (some syntax)

v2.1.4
- Feat: Added bookmark icon for bookmarked sensors on the map
- Feat: Altruit promo section added
- Style: Sensors count styling

v2.1.3
Hotfix testing release. Some trouble with cache

v2.1.2
- Fix: "Daily recap" date picked chart redrawing bug
- Refactor: updated name of project in package, removed some unnessecary logs to debug in console

v2.1.1
Hot fix for cache problem (blank screen)

v2.1.0
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
Feat: In sensor's popup has been added switcher "Realtime / Daily recap"

v2.0.0
- Loading events for sensor pop-up