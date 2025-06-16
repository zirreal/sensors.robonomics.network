<template>
  <Chart
    ref="chartRef"
    constructor-type="stockChart"
    :options="chartOptions"
  />
</template>

<script setup>
/*
 * This component renders a Highcharts stockChart (spline) and supports two data modes:
 *   • Realtime mode (“realtime” provider):
 *       – Disables data grouping to show every point as it arrives.
 *       – Applies a rolling 1-hour time window on mount and as new data comes in.
 *       – Uses a watcher on props.log.length to efficiently append only new points,
 *         update existing series, remove deleted ones, and shift the x-axis window.
 *   • Remote (historical/recap) mode:
 *       – Enables Highcharts data grouping (5-minute bins) when point count exceeds threshold.
 *       – Disables the realtime logic and simply redraws the chart whenever the full log array changes.
 */

import { ref, watch, onMounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from "vue-i18n";
import Highcharts from 'highcharts';
import stockInit from 'highcharts/modules/stock';
import { Chart } from 'highcharts-vue';
import unitsettings from '../../measurements';
import config from '@config';
import { getTypeProvider } from '../../utils/utils';

stockInit(Highcharts);

// Props and Refs
const props = defineProps({
  /* log - Array of `{ timestamp, data }` entries; timestamps may be in seconds or ms. */
  log: {
    type: Array,
    default: () => []
  }
});

// Global objects
const route = useRoute();
const router = useRouter();
const { t: tr, locale } = useI18n();

// Fix chart timeline for 1 hour (only for realtime mode, to ensure nice view)
const WINDOW_MS = 60 * 60 * 1000;
const MAX_VISIBLE = config.SERIES_MAX_VISIBLE; // For performance issues, if reached max - approximation added
const VALID_TYPES = Object.keys(unitsettings).map(k => k.toLowerCase());
const chartRef = ref(null); // Chart container

// Tracks the current selected measurement type from the route
const activeType = computed(() => {
  const t = route.params.type?.toLowerCase();
  return VALID_TYPES.includes(t) ? t : config.DEFAULT_MEASURE_TYPE;
});

// Determines if the current provider is in realtime mode
const isRealtime = computed(() => {
  const provider = getTypeProvider();
  return provider === 'realtime';
});


// Series data managed separately
const chartSeries = ref([]);

// Reactive Highcharts config that updates when isRealtime changes
const chartOptions = computed(() => ({
  chart: { type: 'spline', height: 400 },
  // rangeSelector: { inputEnabled: false, buttons: [{ type: 'all', text: 'All' }] },
  rangeSelector: {
    enabled: false,
  },
  legend: { enabled: true },
  title: { text: '' },
  time: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  xAxis: {
    type: 'datetime',
    labels: { format: '{value:%H:%M}' },
    ordinal: !isRealtime.value
  },
  yAxis: { title: false },
  tooltip: { 
    valueDecimals: 2,
    shared: true,
    formatter() {
      const labelMap = {
        pm10: 'PM10',
        pm25: 'PM2.5',
        noisemax: 'Noise Max',
        noise: 'Noise',
        noiseavg: 'Noise Avg'
      };

      let html = `<b>${Highcharts.dateFormat('%Y-%m-%d %H:%M', this.x)}</b><br/>`;

      this.points.forEach(point => {
        const id = point.series.options.id;
        const label = labelMap[id] || point.series.name;
        html += `<span style="color:${point.color}">●</span> ${label}: <b>${point.y.toFixed(2)}</b><br/>`;
      });

      return html;
    }
  },
plotOptions: {
  series: {
    showInNavigator: true,
    dataGrouping: isRealtime.value
      ? { enabled: false }
      : { enabled: true, units: [['minute', [5]]] },
    events: {
      legendItemClick: function () {
        const chart = this.chart;
        const clickedSeries = this;

        // Prevent default toggling if already visible
        if (clickedSeries.visible) return false;

        // Hide all other series
        chart.series.forEach(s => {
          if (s !== clickedSeries) {
            s.setVisible(false, false);
          }
        });

        // Show clicked series
        clickedSeries.setVisible(true, false);

        chart.redraw();

        return false; // Prevent default behavior
      }
    }
  }},
  series: chartSeries.value, // inject dynamic series reactively
}));

function buildSeriesArray(log, realtime, maxVisible) {

  // Create a lookup table for zones, keyed by lowercase measurement type
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  );

  // Grouped series behavior: only one shows in legend, others are linked
  const linkedGroups = {
    dust: ['pm10', 'pm25'],
    noise: ['noise', 'noisemax', 'noiseavg']
  };

  const groupMap = {};
  Object.entries(linkedGroups).forEach(([group, ids]) => {
    ids.forEach(id => {
      groupMap[id] = group;
    });
  });

  // Store series in a Map for fast access and de-duplication by id
  const seriesMap = new Map();

  for (const entry of log) {
    const { timestamp, data } = entry;

    // Skip entries without timestamp or data
    if (!timestamp || !data) continue;

    // Convert UNIX timestamp (in seconds) to milliseconds if needed
    const t = String(timestamp).length === 10 ? timestamp * 1000 : timestamp;

    for (const [key, val] of Object.entries(data)) {
      const id = key.toLowerCase();

      const group = groupMap[id];

      if (group) {
        // Ensure first-seen ID becomes the main if default main is missing
        if (!groupMap._firstSeen) groupMap._firstSeen = {};
        if (!groupMap._firstSeen[group]) {
          groupMap._firstSeen[group] = id;
        }

        const mainId = groupMap._firstSeen[group];
        const isMain = id === mainId;

        if (!seriesMap.has(id)) {
          seriesMap.set(id, {
            id,
            name: group === 'noise'
              ? tr('Noise')
              : group === 'dust'
                ? tr('Dust & Particles')
                : displayName,
            showInLegend: isMain,
            linkedTo: isMain ? undefined : mainId,
            dashStyle: isMain ? 'Solid' : 'ShortDot',
            data: [],
            zones: zonesMap[id] || [],
            dataGrouping: {
              enabled: true,
              units: [['minute', [5]]]
            }
          });
        }

        seriesMap.get(id).data.push([t, parseFloat(val)]);
        continue;
      }

      // On first encounter, initialize series with localized short name
      if (!seriesMap.has(id)) {
        const setting = unitsettings[id] || {};
        const nameshort = setting.nameshort || {};
        const displayName = nameshort[locale.value] || id;

        seriesMap.set(id, {
          id,
          name: displayName,    // use localized short name
          data: [],
          zones: zonesMap[id] || [],
          dataGrouping: {
            enabled: true,
            units: [['minute', [5]]]
          }
        });
      }

      // Push raw point
      seriesMap.get(id).data.push([t, parseFloat(val)]);
    }
  }

  // Remove duplicated points and sorting by time
  // Convert to array, apply dataGrouping logic & sort alphabetically by displayName
  const seriesArray = Array.from(seriesMap.values()).map(s => ({
    ...s,
    data: s.data
      .reduce((acc, [timestamp, value]) => {
        if (!acc.some(([t]) => t === timestamp)) {
          acc.push([timestamp, value]);
        }
        return acc;
      }, [])
      .sort((a, b) => a[0] - b[0]),
    dataGrouping: realtime
      ? { enabled: false }
      : (s.data.length > maxVisible
         ? { enabled: true, approximation: 'high', units: [['minute', [5]]] }
         : s.dataGrouping)
  }));

  return seriesArray.sort((a, b) => a.name.localeCompare(b.name));

}


// Builds a chart-ready series array from log data,
// with realtime and performance settings applied
const makeSeriesArray = (log) => buildSeriesArray(log, isRealtime.value, MAX_VISIBLE);


// Initialize chart when component is mounted
onMounted(async () => {

  // Checks if no any data type "activeType", show first we have in Chart
  const all = makeSeriesArray(props.log);
  let selectedType = activeType.value;
  if (!all.find(s => s.id === selectedType)) {
    selectedType = all[0]?.id;
    if (selectedType) {
      router.replace({
        params: { ...route.params, type: selectedType }
      });
    }
  }

  // Generate initial series based on the log data and selected type
  const initial = all.map(s => ({
    ...s,
    visible: s.id === selectedType || s.linkedTo === selectedType
  }));

  
  // const initial = makeSeriesArray(props.log).map(s => ({
  //   ...s,
  //   visible: s.id === activeType.value
  // }));

  // Set series for the chart (reactively bound via chartOptions)
  chartSeries.value = initial;

  // If in realtime mode, fix the visible time window to the last hour
  if (isRealtime.value) {
    await nextTick();

    const chart = chartRef.value.chart;

    // Find the latest timestamp among all series
    const lastTime = initial.reduce(
      (max, s) => Math.max(max, s.data[s.data.length - 1]?.[0] || 0),
      0
    );

    // Set visible time range to [lastTime - 1h, lastTime]
    if (lastTime) {
      chart.xAxis[0].setExtremes(
        lastTime - WINDOW_MS,
        lastTime,
        true,   // redraw from start
        false   // no animation
      );
    }
  }
});


// Realtime watcher
// Dynamically append only new points to the chart when log grows
watch(
  () => props.log.length,
  (newLen, oldLen) => {

    if (!isRealtime.value || newLen <= oldLen) return;

    const chart = chartRef.value.chart;

    // 1. Rebuild and sort series alphabetically by name
    const raw = makeSeriesArray(props.log)
      .sort((a, b) => a.name.localeCompare(b.name));
      

    // 2. Preserve current visibility state of each series
    const prevVis = {};
    chart.series.forEach(s => {
      prevVis[s.options.id] = s.visible;
    });

    // 3. Remove any series that no longer exist in the new data
    chart.series.slice().forEach(s => {
      if (!raw.find(ns => ns.id === s.options.id)) {
        s.remove(false);
      }
    });

    let maxTime = 0;

    // 4. Update existing series or add new ones
    raw.forEach(ns => {
      const existing = chart.get(ns.id);
      if (existing) {
        // 4a. Update zones & dataGrouping
        existing.update(
          { 
            name: ns.name,
            zones: ns.zones, 
            dataGrouping: ns.dataGrouping
          },
          false
        );
        // 4b. Append only new points beyond the last known timestamp
        const lastX = existing.data.at(-1)?.x || -Infinity;
        ns.data
          .slice(oldLen)
          .filter(p => p[0] > lastX)
          .forEach(p => {
            existing.addPoint(p, false, false);
            maxTime = Math.max(maxTime, p[0]);
          });
      } else {
        // 4c. Add brand-new series, restoring its visibility or defaulting to activeType
        chart.addSeries(
          { 
            ...ns, 
            visible: prevVis[ns.id] ?? (ns.id === activeType.value) 
          },
          false
        );
        const pts = chart.get(ns.id).data;
        maxTime = Math.max(maxTime, pts.at(-1)?.x || 0);
      }
    });

    // 5. In realtime mode, shift the x-axis window to show the last hour
    if (isRealtime.value && maxTime) {
      chart.xAxis[0].setExtremes(
        maxTime - WINDOW_MS,
        maxTime,
        false,
        false
      );
    }

    // 6. Fallback to first series if activeType disappeared
    if (!raw.find(s => s.id === activeType.value) && raw.length) {
      const fallback = raw[0].id;
      router.replace({
        params: { ...route.params, type: fallback }
      });
      chart.series.forEach(s =>
        s.setVisible(s.options.id === fallback, false)
      );
    }

    // 7. Finally, redraw to apply all changes
    chart.redraw();
  }
);

// Daily recap watcher
// Redrawes all chart if log is changed
watch(
  () => props.log,
  newLog => {
    if (isRealtime.value) return;

    const all = makeSeriesArray(newLog);
    const initial = all.map(s => ({
      ...s,
      visible: s.id === activeType.value || s.linkedTo === activeType.value
    }));

    chartSeries.value = initial;
  },
  { deep: true }
);

</script>

<style>
.highcharts-legend-item { font-weight: 900; }
.highcharts-legend-item .highcharts-graph,
.highcharts-legend-item .highcharts-point { stroke: #000!important; }
.highcharts-legend-item .highcharts-point { fill: #000!important; stroke-width: 2; }
.highcharts-legend-item-hidden text { fill: #999!important; color: #999!important; text-decoration: none!important; }
.highcharts-legend-item-hidden .highcharts-graph,
.highcharts-legend-item-hidden .highcharts-point { stroke: #999!important; }
.highcharts-legend-item-hidden .highcharts-point { fill: #999!important; }
</style>