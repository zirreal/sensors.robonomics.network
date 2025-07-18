<template>
  <Chart
    ref="chartRef"
    constructor-type="stockChart"
    :options="chartOptions"
  />
</template>

<script setup>

import { ref, watch, onMounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from "vue-i18n";
import { useStore } from "@/store";
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
  },
  
});


// Global objects
const route = useRoute();
const router = useRouter();
const store = useStore();
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
  chart: {
    type: 'spline',
    height: 400,
  },
  rangeSelector: {
    enabled: false,
  },
  legend: {
    enabled: true
  },
  title: {
    text: ''
  },
  time: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    useUTC: false
  },
  xAxis: {
    type: 'datetime',
    labels: {
      format: '{value:%H:%M}'
    },
    ordinal: !isRealtime.value
  },
  yAxis: {
    title: false
  },
  navigator: {
    enabled: false
  },
  tooltip: {
    valueDecimals: 2,
    shared: true,
    xDateFormat: '%Y-%m-%d %H:%M:%S'
  },
  plotOptions: {
    series: {
      showInNavigator: false,
      dataGrouping: isRealtime.value
        ? { enabled: false }
        : { enabled: true, units: [['minute', [5]]] }
    }
  },
  series: chartSeries.value,
  credits: {
    enabled: false
  }
}));

function buildSeriesArray(log, realtime, maxVisible) {
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  );

  const seriesMap = new Map();

  for (const entry of log) {
    const { timestamp, data } = entry;
    if (!timestamp || !data) continue;

    const t = String(timestamp).length === 10 ? timestamp * 1000 : timestamp;

    for (const [key, val] of Object.entries(data)) {
      const id = key.toLowerCase();

      // Initialize series if not yet created
      if (!seriesMap.has(id)) {
        const setting = unitsettings[id] || {};
        const nameshort = setting.nameshort || {};
        const displayName = nameshort[locale.value] || id;

        seriesMap.set(id, {
          id,
          name: displayName,
          data: [],
          zones: zonesMap[id] || [],
          dataGrouping: {
            enabled: !realtime && (maxVisible ? true : false),
            units: [['minute', [5]]]
          },
          showInLegend: true,
        });
      }

      seriesMap.get(id).data.push([t, parseFloat(val)]);
    }
  }

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


const makeSeriesArray = (log) => buildSeriesArray(log, isRealtime.value, MAX_VISIBLE);


function showMultipleSeries(ids = []) {
  const chart = chartRef.value?.chart;
  if (!chart) return;

  const idsSet = new Set(ids);

  chart.series.forEach(s => {
    const shouldShow = idsSet.has(s.options.id);
    s.setVisible(shouldShow, false);
  });

  chart.redraw();
}



async function restoreSingleSeries(id) {
  makeSeriesArray(props.log);
}



defineExpose({
  showMultipleSeries,
  restoreSingleSeries,
});


// Initialize chart when component is mounted
onMounted(async () => {
  const allSeries = makeSeriesArray(props.log);

  // Show all series on chart load
  chartSeries.value = allSeries.map(series => ({
    ...series,
    visible: true
  }));

  // In realtime mode, set the visible time window to the last hour
  if (isRealtime.value) {
    await nextTick();

    const chart = chartRef.value?.chart;
    if (!chart) return;

    const latestTimestamp = allSeries.reduce(
      (max, s) => Math.max(max, s.data.at(-1)?.[0] || 0),
      0
    );

    if (latestTimestamp) {
      chart.xAxis[0].setExtremes(
        latestTimestamp - WINDOW_MS,
        latestTimestamp,
        true, // redraw
        false // no animation
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