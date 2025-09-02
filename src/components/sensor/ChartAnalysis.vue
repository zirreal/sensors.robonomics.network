<template>
  <div>
    <Chart
      ref="chartRef"
      constructor-type="stockChart"
      :options="chartOptions"
    />
    <div class="custom-legend">
      <span
        v-for="item in visibleLegend"
        :key="item.key"
        :class="['legend-item', { active: item.key === activeLegendKey }]"
        @click="onLegendClick(item.key)"
      >
        {{ $t(item.labelKey) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import Highcharts from "highcharts";
import stockInit from "highcharts/modules/stock";
import Boost from "highcharts/modules/boost";
import Exporting from "highcharts/modules/exporting";
import { Chart } from "highcharts-vue";
import unitsettings from "../../measurements";

stockInit(Highcharts);
Boost(Highcharts);
Exporting(Highcharts);

const props = defineProps({
  log: { type: Array, default: () => [] },
  unit: { type: String },
  currentScope: { type: String }
});

const chartRef = ref(null);
const { locale } = useI18n();

const presentIdsSet = ref(new Set());
const chartSeries = ref([]);
const activeLegendKey = ref(null);

const visibleLegend = computed(() =>
  [...presentIdsSet.value].map((id) => ({
    key: id,
    labelKey: unitsettings[id]?.namelong?.[locale.value] || unitsettings[id]?.nameshort?.[locale.value] || id.toUpperCase(),
  }))
);

/**
 * Build overlay series for week or month
 */
function buildOverlaySeries(log, legendKey, scope = "week") {
  const seriesMap = new Map();

  // bucket size
  const groupMinutes = scope === "week" ? 25 : 180; // 25 min for week, 3h for month
  const bucketCount = Math.ceil((24 * 60) / groupMinutes); 

  for (const { timestamp, data } of log) {
    if (!timestamp || !data) continue;

    const ts = String(timestamp).length === 10 ? timestamp * 1000 : timestamp;
    const d = new Date(ts);

    const totalMinutes = d.getHours() * 60 + d.getMinutes();
    const bucketIndex = Math.floor(totalMinutes / groupMinutes);

    for (const [key, val] of Object.entries(data)) {
      const id = key.toLowerCase();
      if (id !== legendKey) continue;

      const dayStr = d.toISOString().slice(0, 10);
      const sid = `${id}_${dayStr}`;

      if (!seriesMap.has(sid)) {
        const set = unitsettings[id] || {};
        seriesMap.set(sid, {
          id: sid,
          name: `${set.nameshort?.[locale.value] || id.toUpperCase()} • ${dayStr}`,
          fullLabel:
            set.namelong?.[locale.value] ||
            set.nameshort?.[locale.value] ||
            id.toUpperCase(),
          unit: set.unit || "",
          zones: set.zones || [],
          data: Array(bucketCount)
            .fill(null)
            .map((_, i) => [i * (groupMinutes / 60), null]),
          showInLegend: false,
        });
      }

      const series = seriesMap.get(sid);
      if (val != null) {
        series.data[bucketIndex][1] = parseFloat(val);
      }
    }
  }

  const MAX_GAP_BUCKETS = 2;

  for (const series of seriesMap.values()) {
    
    for (let i = 1, gap = 0; i < series.data.length; i++) {
      if (series.data[i][1] === null) {
        gap++;
        if (gap <= MAX_GAP_BUCKETS && series.data[i - 1][1] != null) {
          series.data[i][1] = series.data[i - 1][1];
        }
      } else {
        gap = 0;
      }
    }

    
    for (let i = series.data.length - 2, gap = 0; i >= 0; i--) {
      if (series.data[i][1] === null) {
        gap++;
        if (gap <= MAX_GAP_BUCKETS && series.data[i + 1][1] != null) {
          series.data[i][1] = series.data[i + 1][1];
        }
      } else {
        gap = 0;
      }
    }

    while (
      series.data.length &&
      series.data[series.data.length - 1][1] === null
    ) {
      series.data.pop();
    }
  }

  return Array.from(seriesMap.values());
}

const chartOptions = computed(() => {
  const unitsArr = [...new Set(chartSeries.value.map((s) => s.unit))];
  const unitToAxis = Object.fromEntries(unitsArr.map((u, i) => [u, i]));
  const series = chartSeries.value.map((s) => ({ ...s, yAxis: unitToAxis[s.unit] ?? 0 }));

  return {
    chart: { type: "spline", height: 400 },
    rangeSelector: { enabled: false },
    legend: { enabled: false },
    title: { text: "" },
    xAxis: {
      type: "linear",
      min: 0,
      max: 24,
      tickInterval: props.currentScope === "week" ? 1 : 3,
      ordinal: false,
      startOnTick: true,
      endOnTick: true,
      title: { text: "Hour of day" },
      labels: {
        formatter() {
          const hours = Math.floor(this.value);
          const minutes = Math.round((this.value - hours) * 60);
          return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        },
      },
    },
    yAxis: unitsArr.map((u) => ({
      title: false,
      labels: { format: `{value} ${u}` },
      opposite: true,
    })),
    tooltip: props.currentScope === "week"
      ? {
          shared: true,
          formatter() {
            const hours = Math.floor(this.x);
            const minutes = Math.round((this.x - hours) * 60);
            const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
            const rows = this.points.map(
              (p) => `<span style="color:${p.color}">●</span> ${p.series.userOptions.fullLabel}: <b>${p.y.toFixed(2)} ${p.series.userOptions.unit}</b>`
            );
            return `<b>${timeStr}</b><br/>${rows.join("<br/>")}`;
          },
        }
      : { enabled: false },
    plotOptions: {
      series: {
        marker: { enabled: false },
        boostThreshold: 2000,
        animation: false,
        connectNulls: true,
      },
    },
    series,
    navigator: {
      xAxis: {
        labels: { enabled: false }
      },
    },
    exporting: {
      enabled: true,
      fallbackToExportServer: false,
      sourceWidth: 1200,
      sourceHeight: 600,
      chartOptions: {
        tooltip: { enabled: false },
        plotOptions: { series: { dataLabels: { enabled: false,  allowHTML: false },  boostThreshold: 0, boost: { enabled: false } } }
      },
      filename: 'chart1',
      buttons: {
        contextButton: {
          symbol: 'download',
          // symbolFill: 'red',
          // symbolStroke: 'red',
          // symbolX: 5,
          // symbolY: -5
        }
      }
    },
    credits: { enabled: false },
  };
});


function onLegendClick(legendKey) {
  activeLegendKey.value = legendKey;
  chartSeries.value = buildOverlaySeries(props.log, legendKey, props.currentScope);
}

watch(
  () => props.log,
  (log) => {
    if (!log.length) return;

    const set = new Set();
    for (const point of log) {
      if (!point.data) continue;
      Object.keys(point.data).forEach((id) => set.add(id.toLowerCase()));
    }
    presentIdsSet.value = set;

    if (!activeLegendKey.value && set.size) {
      activeLegendKey.value = [...set][0];
    }

    if (activeLegendKey.value) {
      chartSeries.value = buildOverlaySeries(log, activeLegendKey.value, props.currentScope);
    }
  },
  { immediate: true }
);
</script>

<style>
.custom-legend {
  font-weight: 900;
  font-size: 1.1em;
  user-select: none;
  margin-bottom: calc(var(--gap) * 3);
  text-align: center;
}
.legend-item {
  color: var(--color-dark);
  cursor: pointer;
  transition: color .2s;
  opacity: .5;
}
.legend-item:not(:last-child) {
  margin-right: calc(var(--gap) * 2);
}
.legend-item.active {
  opacity: 1;
  text-decoration: underline;
  cursor: default;
}
.legend-item:hover:not(.active) {
  opacity: .3;
}

@media screen and (max-width: 420px) {
  .custom-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
