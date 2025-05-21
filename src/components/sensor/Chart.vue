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

const props = defineProps({ log: Array });
const route = useRoute();
const activeType = computed(() => (route.params.type ?? 'pm10').toLowerCase());
const MAX_VISIBLE = config.SERIES_MAX_VISIBLE;
const chartRef = ref(null);
let chartObj = null;
let lastIndex = 0;

function buildSeriesMap(log) {
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  );
  const map = new Map();
  log.forEach(item => {
    if (!item.timestamp || !item.data) return;
    const t = item.timestamp.toString().length === 10 ? item.timestamp * 1000 : item.timestamp;
    for (const [key, val] of Object.entries(item.data)) {
      const name = key.toLowerCase();
      if (!map.has(name)) {
        map.set(name, {
          name,
          data: [],
          zones: zonesMap[name],
          visible: true,
          dataGrouping: { enabled: true, approximation: 'high', units: [['minute', [5]]] }
        });
      }
      map.get(name).data.push([t, parseFloat(val)]);
    }
  });
  return map;
}

const chartOptions = ref({
  chart: { type: 'spline', height: 400 },
  rangeSelector: { inputEnabled: false, buttons: [{ type: 'all', text: 'All' }] },
  legend: { enabled: true },
  title: { text: '' },
  time: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  xAxis: { type: 'datetime', labels: { format: '{value:%H:%M}' } },
  yAxis: { title: false },
  tooltip: { valueDecimals: 2 },
  plotOptions: {
    series: {
      showInNavigator: false,
      dataGrouping: { enabled: true, units: [['minute', [5]]] }
    }
  },
  series: []
});

onMounted(async () => {
  await nextTick();
  chartObj = chartRef.value.chart;
  const seriesMap = buildSeriesMap(props.log);

  seriesMap.forEach((series, name) => {
    if (series.data.length > MAX_VISIBLE) {
      series.dataGrouping = { enabled: true, approximation: 'high', units: [['minute', [5]]] };
    }
    chartObj.addSeries(series, false);
  });

  chartObj.series.forEach(s =>
    s.setVisible(s.name === activeType.value, false)
  );
  chartObj.redraw();
  lastIndex = props.log.length;
});

watch(
  () => props.log,
  (newLog) => {
    if (!chartObj || newLog.length <= lastIndex) return;
    const newItems = newLog.slice(lastIndex);
    newItems.forEach(item => {
      const t = item.timestamp.toString().length === 10 ? item.timestamp * 1000 : item.timestamp;
      Object.entries(item.data).forEach(([key, val]) => {
        const name = key.toLowerCase();
        const s = chartObj.series.find(s => s.name === name);
        if (s) {
          s.options.data.push([t, parseFloat(val)]);
          s.processData();
          s.generatePoints();
          s.drawGraph();
          s.drawPoints();
        }
      });
    });
    lastIndex = newLog.length;
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
