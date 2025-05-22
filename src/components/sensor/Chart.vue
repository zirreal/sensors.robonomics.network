<template>
  <Chart
    ref="chartRef"
    constructor-type="stockChart"
    :options="chartOptions"
  />
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import Highcharts from 'highcharts';
import stockInit from 'highcharts/modules/stock';
import { Chart } from 'highcharts-vue';
import unitsettings from '../../measurements';
import config from '@config';
import { getTypeProvider } from '../../utils/utils';

stockInit(Highcharts);

// Props and Refs
const props = defineProps({
  log: {
    type: Array,
    default: () => []
  }
});

// Fix chart timeline for 1 hour (only for realtime mode, to ensure nice view)
const WINDOW_MS = 60 * 60 * 1000;

const route = useRoute();
const MAX_VISIBLE = config.SERIES_MAX_VISIBLE; // For perfomance issues, if reached max - approximation added
const chartRef = ref(null); // Chart container

// Tracks the current selected measurement type from the route
const activeType = computed(() => {
  return (route.params.type ?? 'pm10').toLowerCase();
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
  rangeSelector: { inputEnabled: false, buttons: [{ type: 'all', text: 'All' }] },
  legend: { enabled: true },
  title: { text: '' },
  time: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  xAxis: {
    type: 'datetime',
    labels: { format: '{value:%H:%M}' },
    ordinal: !isRealtime.value
  },
  yAxis: { title: false },
  tooltip: { valueDecimals: 2 },
  plotOptions: {
    series: {
      showInNavigator: true,
      dataGrouping: isRealtime.value
        ? { enabled: false }
        : { enabled: true, units: [['minute', [5]]] }
    }
  },
  series: chartSeries.value // inject dynamic series reactively
}));

// Converts raw log data into an array of Highcharts series
function buildSeriesArray(log, realtime, maxVisible) {
  // Create a lookup table for zones, keyed by lowercase measurement type
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  );

  // Store series in a Map for fast access and de-duplication by name
  const seriesMap = new Map();

  for (const entry of log) {
    const { timestamp, data } = entry;

    // Skip entries without timestamp or data
    if (!timestamp || !data) continue;

    // Convert UNIX timestamp (in seconds) to milliseconds if needed
    const t = String(timestamp).length === 10 ? timestamp * 1000 : timestamp;

    // Iterate over each key-value pair in the data object
    for (const [key, val] of Object.entries(data)) {
      const name = key.toLowerCase();

      // Initialize new series if it doesn't exist yet
      if (!seriesMap.has(name)) {
        seriesMap.set(name, {
          id: name,
          name,
          data: [],
          zones: zonesMap[name] || [],
          dataGrouping: {
            enabled: true,
            units: [['minute', [5]]]
          }
        });
      }

      // Add the data point [timestamp, value] to the corresponding series
      seriesMap.get(name).data.push([t, parseFloat(val)]);
    }
  }

  // Convert series Map into an array and apply dataGrouping logic
  return Array.from(seriesMap.values()).map(s => ({
    ...s,
    dataGrouping: realtime
      ? { enabled: false }
      : (s.data.length > maxVisible
         ? { enabled: true, approximation: 'high', units: [['minute', [5]]] }
         : s.dataGrouping)
  }));
}

// Builds a chart-ready series array from log data,
// with realtime and performance settings applied
const makeSeriesArray = (log) => buildSeriesArray(log, isRealtime.value, MAX_VISIBLE);


// Initialize chart when component is mounted
onMounted(() => {
  // Generate initial series based on the log data and selected type
  const initial = makeSeriesArray(props.log).map(s => ({
    ...s,
    visible: s.id === activeType.value
  }));

  // Set series for the chart (reactively bound via chartOptions)
  chartSeries.value = initial;

  // If in realtime mode, fix the visible time window to the last hour
  if (isRealtime.value) {
    setTimeout(() => {
      const chart = chartRef.value.chart;

      // Find the latest timestamp among all series
      const lastTime = initial.reduce(
        (max, s) => Math.max(max, s.data[s.data.length - 1]?.[0] || 0),
        0
      );

      // Set visible time range to [lastTime - 1h, lastTime]
      if (lastTime) {
        chart.xAxis[0].setExtremes(lastTime - WINDOW_MS, lastTime);
      }
    }, 0);
  }
});


// Dynamically append only new points to the chart when log grows
watch(
  () => props.log.length,
  (newLen, oldLen) => {
    if (newLen <= oldLen) return;

    const chart = chartRef.value.chart;
    const raw = makeSeriesArray(props.log);

    // Preserve current visibility state of series
    const prevVis = {};
    chart.series.forEach(s => {
      prevVis[s.options.id] = s.visible;
    });

    // Remove series that no longer exist in the new log
    chart.series.slice().forEach(s => {
      if (!raw.find(ns => ns.id === s.options.id)) {
        s.remove(false);
      }
    });

    let maxTime = 0;

    raw.forEach(ns => {
      const existingSeries = chart.get(ns.id);

      if (existingSeries) {
        // Update zones and data grouping if needed
        existingSeries.update(
          {
            zones: ns.zones,
            dataGrouping: ns.dataGrouping
          },
          false
        );

        // Add only new points that came after the last known point
        const lastX = existingSeries.data.at(-1)?.x || -Infinity;
        ns.data
          .slice(oldLen)
          .filter(p => p[0] > lastX)
          .forEach(p => {
            existingSeries.addPoint(p, false, false);
            maxTime = Math.max(maxTime, p[0]);
          });
      } else {
        // New series: add it to chart and track its latest timestamp
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

    // If realtime mode, update the visible time range
    if (isRealtime.value && maxTime) {
      chart.xAxis[0].setExtremes(maxTime - WINDOW_MS, maxTime, false, false);
    }

    chart.redraw();
  }
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