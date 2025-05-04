<template>
  <Chart :constructor-type="'stockChart'" :options="chartOptions" ref="chartRef" />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import config from '@config';
import Highcharts from 'highcharts';
import { Chart } from 'highcharts-vue';
import stockInit from 'highcharts/modules/stock';
import unitsettings from '../../measurements';
import { getTypeProvider } from '../../utils/utils';

stockInit(Highcharts);

Highcharts.seriesTypes.spline.prototype.drawLegendSymbol = function (legend, item) {
  this.options.marker.enabled = true;
  Highcharts.LegendSymbol.lineMarker?.call(this, legend, item);
  this.options.marker.enabled = false;
};

const props = defineProps({
  point: [Number, Object, String],
  log: {
    type: Array,
    default: () => []
  }
});

const chartOptions = ref({});
const chartObj = ref(null);
const chartRef = ref(null);
const route = useRoute();
const provider = route.params.provider || getTypeProvider();

// EN: If the 'type' parameter is not specified in the URL, default to filtering by "pm10"
// RU: Если в URL не задан параметр type, то фильтруем по умолчанию по "pm10"
const activeType = computed(() => {
  return route.params.type ? route.params.type.toLowerCase() : 'pm10';
});

// EN: Compute all series from props.log data (with timestamp handling)
// RU: Вычисляем все серии по данным из props.log (с обработкой timestamp)
const series = computed(() => {
  const unitsettingsLowerCase = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v])
  );
  const result = [];
  for (const item of props.log) {
    if (!item.timestamp) {
      console.warn("Skipping item without timestamp", item);
      continue;
    }
    if (item.data) {
      // EN: If the timestamp has 10 digits (seconds), multiply by 1000; otherwise, use it as is
      // RU: Если timestamp состоит из 10 цифр (секунды), умножаем на 1000; иначе используем как есть
      const timestamp =
        item.timestamp.toString().length === 10
          ? item.timestamp * 1000
          : item.timestamp;
      for (let keyname of Object.keys(item.data)) {
        keyname = keyname.toLowerCase();
        const existingIndex = result.findIndex((m) => m.name === keyname);
        if (existingIndex >= 0) {
          result[existingIndex].data.push([timestamp, item.data[keyname]]);
        } else {
          result.push({
            name: keyname,
            data: [[timestamp, parseFloat(item.data[keyname])]],
            zones: unitsettingsLowerCase[keyname]?.zones,
            visible: true,
            dataGrouping: { enabled: false }
          });
        }
      }
    }
  }
  for (const measurement of result) {
    if (measurement.data.length > config.SERIES_MAX_VISIBLE) {
      measurement.visible = false;
      measurement.dataGrouping = { approximation: 'high' };
    }
  }
  return result;
});

// EN: Filter: display only the series that matches the activeType
// RU: Фильтрация: показываем только ту серию, которая соответствует activeType
const filteredSeries = computed(() => {
  // 1) Ищем совпадения с активным типом
  const match = series.value.filter(s => s.name === activeType.value);

  console.log('TEST', match.length, series.value.filter(s => s.name === 'pm10'))

  if (match.length > 0) {
    // есть данные — возвращаем их
    return match;
  }

  // 2) Нет данных? Фолбэк на PM10
  const fallback = series.value.filter(s => s.name === 'pm10');
  return fallback;
});

const startpoint = computed(() => {
  if (provider === 'realtime') {
    return Date.now();
  } else {
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }
});

// EN: Update the chart when the series list changes
// RU: Обновляем график при изменении списка серий
watch(series, (v) => {
  if (!chartObj.value) return;
  // EN: Add or update all series (all series are added initially)
  // RU: Добавляем или обновляем все серии (изначально добавляем все)
  v.forEach(newdata => {
    const index = chartObj.value.series.findIndex(m => m.name === newdata.name);
    if (index >= 0) {
      chartObj.value.series[index].setData(newdata.data, false);
    } else {
      chartObj.value.addSeries(newdata, false);
    }
  });
  chartObj.value.redraw();
}, { immediate: true, deep: true });

// EN: Apply filtering (set visibility) based on activeType
// RU: Применяем фильтрацию (устанавливаем видимость) по activeType
watch(filteredSeries, (newList) => {
  if (!chartObj.value) return;
  
  // вытащим список имён, которые нам надо показывать
  const namesToShow = newList.map(s => s.name);

  // пройдём по всем series в графике и включим/скроем
  chartObj.value.series.forEach(serie => {
    serie.setVisible(namesToShow.includes(serie.name), false);
  });

  chartObj.value.redraw();
}, { immediate: true, deep: true });


onMounted(() => {
  if (chartRef.value && chartRef.value.chart) {
    chartObj.value = chartRef.value.chart;
  }
  
  chartOptions.value = {
    legend: { enabled: true },
    rangeSelector: {
      inputEnabled: false,
      buttons: [{ type: "all", text: "All", title: "View all" }]
    },
    chart: { type: "spline", height: 400 },
    title: { text: "" },
    time: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    series: series.value,
    xAxis: {
      title: false,
      type: "datetime",
      labels: { overflow: "justify", format: "{value: %H:%M }" }
    },
    yAxis: { title: false },
    tooltip: { valueDecimals: 2 },
    plotOptions: {
      series: {
        showInNavigator: true,
        dataGrouping: { enabled: true, units: [["minute", [5]]] },
        events: {
          legendItemClick: function () {
            // EN: When the user clicks on the legend, you can disable the filtering
            // (Standard behavior is maintained here)
            // RU: Если пользователь кликает по легенде, можно отключить фильтрацию
            // Или оставить выбор за пользователем – здесь оставляем стандартное поведение.
          }
        }
      }
    },
  };
});
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
