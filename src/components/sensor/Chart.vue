<template>
  <Chart
    :constructor-type="'stockChart'"
    :options="chartOptions"
    ref="chartRef"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
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
const activeType = computed(() =>
  (route.params.type ?? 'pm10').toLowerCase()
);

// Build all series from props.log with performance optimizations
const allSeries = computed(() => {
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  );
  const out = [];
  for (const item of props.log) {
    if (!item.timestamp || !item.data) continue;
    const t = item.timestamp.toString().length === 10
      ? item.timestamp * 1000
      : item.timestamp;
    for (const [key, val] of Object.entries(item.data)) {
      const name = key.toLowerCase();
      const idx = out.findIndex(s => s.name === name);
      if (idx >= 0) {
        out[idx].data.push([t, parseFloat(val)]);
      } else {
        out.push({
          name,
          data: [[t, parseFloat(val)]],
          zones: zonesMap[name],
          visible: true,
          dataGrouping: { enabled: false }
        });
      }
    }
  }
  // Performance: hide long series and use high approximation
  for (const measurement of out) {
    if (measurement.data.length > config.SERIES_MAX_VISIBLE) {
      measurement.visible = false;
      measurement.dataGrouping = { approximation: 'high' };
    }
  }
  return out;
});

// Base chart options (without series)
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
    series: {
      showInNavigator: true,
      dataGrouping: { enabled: true, units: [['minute', [5]]] }
    }
  }
};

// Reactive chart options
const chartOptions = ref({ ...baseOpts, series: [] });
const chartRef = ref(null);
let chartObj = null;

// On mount: render all series then hide non-active
onMounted(async () => {
  await nextTick();
  if (chartRef.value?.chart) {
    chartObj = chartRef.value.chart;
    // Render all series initially
    chartObj.update({ series: allSeries.value }, true, true);
    // Hide series not matching activeType
    chartObj.series.forEach(s => {
      s.setVisible(s.name === activeType.value, false);
    });
    chartObj.redraw();
  }
});

// On data update: only update data for existing series, preserving zoom
watch(
  allSeries,
  newArr => {
    if (!chartObj) return;
    // Save current x-axis extremes
    const extremes = chartObj.xAxis[0].getExtremes();
    // Update series data without redraw
    newArr.forEach(sData => {
      const exist = chartObj.series.find(x => x.name === sData.name);
      if (exist) {
        exist.setData(sData.data, false);
      }
    });
    // Restore extremes to prevent full redraw
    chartObj.xAxis[0].setExtremes(extremes.min, extremes.max, false);
    // Final redraw
    chartObj.redraw();
  },
  { deep: true }
);
</script>

<style>
.highcharts-legend-item {
  font-weight: 900;
}
.highcharts-legend-item .highcharts-graph,
.highcharts-legend-item .highcharts-point {
  stroke: #000 !important;
}
.highcharts-legend-item .highcharts-point {
  fill: #000 !important;
  stroke-width: 2;
}
.highcharts-legend-item-hidden text {
  fill: #999 !important;
  color: #999 !important;
  text-decoration: none !important;
}
.highcharts-legend-item-hidden .highcharts-graph,
.highcharts-legend-item-hidden .highcharts-point {
  stroke: #999 !important;
}
.highcharts-legend-item-hidden .highcharts-point {
  fill: #999 !important;
}
</style>
