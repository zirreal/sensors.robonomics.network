<template>
  <Chart
    :constructor-type="'stockChart'"
    :options="chartOptions"
    ref="chartRef"
  />
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import Highcharts from 'highcharts';
import stockInit from 'highcharts/modules/stock';
import { Chart } from 'highcharts-vue';
import unitsettings from '../../measurements';
import config from '@config';
import { getTypeProvider } from '../../utils/utils';

stockInit(Highcharts);

// Props & routing
const props = defineProps({ log: Array });
const route = useRoute();
const provider = route.params.provider || getTypeProvider();

// Active type from URL (default to 'pm10')
const activeType = computed(() => (
  route.params.type ?? 'pm10').toLowerCase()
);

// Performance cap
const MAX_VISIBLE = config.SERIES_MAX_VISIBLE;

// Build initial allSeries
function buildSeriesFromLog(log) {

  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  );

  const out = [];

  log.forEach(item => {
    if (!item.timestamp || !item.data) return;

    const t = item.timestamp.toString().length === 10 ? item.timestamp * 1000 : item.timestamp;

    Object.entries(item.data).forEach(([key, val]) => {
      const name = key.toLowerCase();
      let series = out.find(s => s.name === name);
      if (!series) {
        series = { name, data: [], zones: zonesMap[name], visible: true, dataGrouping: { enabled: false } };
        out.push(series);
      }
      series.data.push([t, parseFloat(val)]);
    });

  });

  // Performance
  out.forEach(s => {
    if (s.data.length > MAX_VISIBLE) {
      s.visible = false;
      s.dataGrouping = { approximation: 'high' };
    }
  });

  return out;
}

const allSeries = ref([]);

// Chart options
const baseOpts = {
  legend: { enabled: true },
  rangeSelector: { inputEnabled: false, buttons: [{ type: 'all', text: 'All' }] },
  chart: { type: 'spline', height: 400 },
  title: { text: '' },
  time: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  xAxis: { type: 'datetime', labels: { format: '{value:%H:%M}' } },
  yAxis: { title: false },
  tooltip: { valueDecimals: 2 },
  plotOptions: {
    series: { showInNavigator: false, dataGrouping: { enabled: true, units: [['minute', [5]]] } }
  }
};

const chartOptions = ref({ ...baseOpts, series: [] });
const chartRef = ref(null);
let chartObj = null;
let lastIndex = 0;

onMounted(async () => {

  await nextTick();

  if (!chartRef.value?.chart) return;

  chartObj = chartRef.value.chart;

  // Initial build
  allSeries.value = buildSeriesFromLog(props.log);
  chartObj.update({ series: allSeries.value }, true, true);

  // Hide non-active
  chartObj.series.forEach(s => s.setVisible(s.name === activeType.value, false));
  chartObj.redraw();
  lastIndex = props.log.length;
});

// Incremental updates: only add new points
watch(
  () => props.log,
  (newLog) => {

    if (!chartObj) return;
    if (newLog.length <= lastIndex) return;

    const newItems = newLog.slice(lastIndex);

    newItems.forEach(item => {
      if (!item.timestamp || !item.data) return;

      const t = item.timestamp.toString().length === 10 ? item.timestamp * 1000 : item.timestamp;
      Object.entries(item.data).forEach(([key, val]) => {
        const name = key.toLowerCase();
        const series = chartObj.series.find(s => s.name === name);

        if (series) {
          series.addPoint([t, parseFloat(val)], false, false);
        }
      });
    });
    lastIndex = newLog.length;
    chartObj.redraw();
  },
  { deep: true }
);
</script>

<style>
.highcharts-legend-item { font-weight: 900; }
.highcharts-legend-item .highcharts-graph,
.highcharts-legend-item .highcharts-point { stroke: #000 !important; }
.highcharts-legend-item .highcharts-point { fill: #000 !important; stroke-width: 2; }
.highcharts-legend-item-hidden text { fill: #999 !important; color: #999 !important; text-decoration: none !important; }
.highcharts-legend-item-hidden .highcharts-graph,
.highcharts-legend-item-hidden .highcharts-point { stroke: #999 !important; }
.highcharts-legend-item-hidden .highcharts-point { fill: #999 !important; }
</style>
