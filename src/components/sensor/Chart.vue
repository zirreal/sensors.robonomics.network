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
import { ref, watch, onMounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Highcharts from 'highcharts';
import stockInit from 'highcharts/modules/stock';
import Boost from "highcharts/modules/boost";
import Exporting from "highcharts/modules/exporting";
import OfflineExporting from "highcharts/modules/offline-exporting";
import { Chart } from 'highcharts-vue';
import unitsettings from '../../measurements';
import { settings } from '@config';
import { getTypeProvider } from '../../utils/utils';

stockInit(Highcharts);
Boost(Highcharts);
// Exporting(Highcharts);
// OfflineExporting(Highcharts);

Highcharts.SVGRenderer.prototype.symbols.download = function (x, y, w, h) {
    const path = [
        // Arrow stem
        'M', x + w * 0.5, y,
        'L', x + w * 0.5, y + h * 0.7,
        // Arrow head
        'M', x + w * 0.3, y + h * 0.5,
        'L', x + w * 0.5, y + h * 0.7,
        'L', x + w * 0.7, y + h * 0.5,
        // Box
        'M', x, y + h * 0.9,
        'L', x, y + h,
        'L', x + w, y + h,
        'L', x + w, y + h * 0.9
    ];
    return path;
};

const props = defineProps({
  log:  { type: Array, default: () => [] },
  unit: { type: String }
});
const chartRef = ref(null);

const route  = useRoute();
const router = useRouter();
const { t: tr, locale } = useI18n();

const WINDOW_MS   = 60 * 60 * 1000;
const MAX_VISIBLE = settings.SERIES_MAX_VISIBLE;
const VALID_TYPES = Object.keys(unitsettings).map(k => k.toLowerCase());

// Determine total points across all series
const isLargeDataset = computed(() => props.log.length > 2500);

const GROUPS = {
  dust:    { members: ['pm10', 'pm25'], labelKey: 'Dust & Particles' },
  noise:   { members: ['noise', 'noisemax', 'noiseavg'], labelKey: 'Noise' },
  climate: { members: ['temperature', 'humidity', 'dewpoint'], labelKey: 'Climate' }
};
const idToGroup = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, { members }]) => members.map(id => [id, g])));

// Запоминаем уникальные типы
const presentIdsSet = ref(new Set());

const visibleLegend = computed(() => {
  const ids = presentIdsSet.value;
  const legend = [];

  Object.entries(GROUPS).forEach(([g, info]) => {
    if (info.members.some(m => ids.has(m))) {
      legend.push({ key: g, labelKey: info.labelKey, single: false });
    }
  });

  const groupedIds = Object.values(GROUPS).flatMap(g => g.members);
  ids.forEach(id => {
    if (!groupedIds.includes(id)) {
      legend.push({
        key: id,
        labelKey: unitsettings[id]?.namelong?.[locale.value] || unitsettings[id]?.nameshort?.[locale.value] || id.toUpperCase(),
        single: true
      });
    }
  });
  return legend;
});

const rawUrlType  = computed(() => route.query.type?.toLowerCase());
const activeGroupKey = computed(() => idToGroup[rawUrlType.value] || null);
const isSingle = computed(() => !idToGroup[rawUrlType.value] && presentIdsSet.value.has(rawUrlType.value));

const activeLegendKey = computed(() => {
  if (activeGroupKey.value && visibleLegend.value.some(x => x.key === activeGroupKey.value)) return activeGroupKey.value;
  if (isSingle.value && visibleLegend.value.some(x => x.key === rawUrlType.value)) return rawUrlType.value;
  return visibleLegend.value[0]?.key || null;
});

const isRealtime  = computed(() => getTypeProvider() === 'realtime');
const chartSeries = ref([]);

/**
 * Builds an array of Highcharts-ready series, showing only series for the selected legend group or single parameter.
 * - For group: shows all present members (dashed lines for secondary), one main (solid, displayed in legend).
 * - For single parameter: shows only that one.
 * - Only shows lines for parameters actually present in the current log.
 * - In realtime mode, stretches each series to the last hour window by adding a virtual point if needed.
 */
function buildSeriesArray(log, realtime, maxVisible, legendKey) {
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  );

  const firstSeen = {};
  const seriesMap = new Map();

  for (const { timestamp, data } of log) {
    if (!timestamp || !data) continue;
    const t = String(timestamp).length === 10 ? timestamp * 1000 : timestamp;
    for (const [key, val] of Object.entries(data)) {
      const id = key.toLowerCase();
      const group = idToGroup[id];
      const set = unitsettings[id] || {};
      const unit = set.unit || props.unit || '';
      const short = set.nameshort?.[locale.value] || id.toUpperCase();
      const full = set.namelong?.[locale.value] || short;
      if ((group && group === legendKey) || (!group && id === legendKey)) {
        if (group) {
          if (!firstSeen[group]) firstSeen[group] = id;
          const mainId = firstSeen[group];
          const isMain = id === mainId;
          if (!seriesMap.has(id)) {
            seriesMap.set(id, {
              id,
              unit,
              name: tr(GROUPS[group].labelKey),
              fullLabel: full,
              showInLegend: isMain,
              linkedTo: isMain ? undefined : mainId,
              dashStyle: isMain || id === 'dewpoint' ? 'Solid' : 'ShortDot',
              data: [],
              zones: zonesMap[id] || [],
              dataGrouping:  {
              enabled: true,
              units: isLargeDataset.value
                ? [["hour", [3]]] 
                : [["minute", [5]]] 
            }});
          }
        } else {
          if (!seriesMap.has(id)) {
            seriesMap.set(id, {
              id,
              unit,
              name: short,
              fullLabel: full,
              showInLegend: true,
              data: [],
              zones: zonesMap[id] || [],
              dataGrouping: {
              enabled: true,
              units: isLargeDataset.value
                ? [["hour", [3]]] 
                : [["minute", [5]]] 
            }});
          }
        }
        seriesMap.get(id).data.push([t, parseFloat(val)]);
      }
    }
  }

  let out = Array.from(seriesMap.values()).map(s => {
    let arr = Array.from(new Map(s.data.map(([ts, v]) => [ts, v])).entries())
      .sort((a, b) => a[0] - b[0]);
    const many = arr.length > maxVisible;
    if (realtime && arr.length) {
      const lastX = arr.at(-1)[0];
      const leftX = lastX - WINDOW_MS;
      if (arr[0][0] > leftX) {
        arr = [[leftX, arr[0][1]], ...arr];
      }
    }
    return {
      ...s,
      data: arr,
      dataGrouping: realtime
        ? { enabled: false }
        :  {
              enabled: true,
              units: isLargeDataset.value
                ? [["hour", [3]]]
                : (many ? { enabled: true, approximation: 'high', units: [['minute', [5]]] } : s.dataGrouping)
            }
    };
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}


function buildMonthlyOverlaySeries(log, legendKey) {
  const seriesMap = new Map(); 

  for (const { timestamp, data } of log) {
    if (!timestamp || !data) continue;
    const ts = String(timestamp).length === 10 ? timestamp * 1000 : timestamp;
    const d = new Date(ts);
    const dayStr = d.toISOString().slice(0,10);
    let hour = d.getHours();
    hour = Math.floor(hour / 3) * 3; 

    for (const [key, val] of Object.entries(data)) {
      const id = key.toLowerCase();
      const group = idToGroup[id];
      if (!((group && group === legendKey) || (!group && id === legendKey))) continue;

      const sid = `${id}_${dayStr}`;
      if (!seriesMap.has(sid)) {
        const set = unitsettings[id] || {};
        seriesMap.set(sid, {
          id: sid,
          name: `${set.nameshort?.[locale.value] || id.toUpperCase()} • ${dayStr}`,
          fullLabel: set.namelong?.[locale.value] || set.nameshort?.[locale.value] || id.toUpperCase(),
          unit: set.unit || '',
          data: Array.from({ length: 8 }, () => []), 
          dashStyle: group && id !== (GROUPS[group]?.members[0]) ? 'ShortDot' : 'Solid',
          marker: { enabled: false },
          zones: set.zones || [],
          showInLegend: false,
          dayStr
        });
      }

      
      const bucketIndex = hour / 3;
      seriesMap.get(sid).data[bucketIndex].push([hour, parseFloat(val)]);
    }
  }

  
  return Array.from(seriesMap.values()).map(s => {
    const averaged = s.data
      .map(arr => arr.length ? [arr[0][0], arr.reduce((a,b)=>a+b[1],0)/arr.length] : null)
      .filter(Boolean);
    return { ...s, data: averaged };
  });
}

const makeSeriesArray = (log, legendKey) => {
  return isLargeDataset.value
    ? buildMonthlyOverlaySeries(log, legendKey) 
    : buildSeriesArray(log, isRealtime.value, MAX_VISIBLE, legendKey); 
};

const chartOptions = computed(() => {
  const unitsArr = [...new Set(chartSeries.value.map(s => s.unit))];
  const unitToAxis = Object.fromEntries(unitsArr.map((u, i) => [u, i]));
  const series = chartSeries.value.map(s => ({ ...s, yAxis: unitToAxis[s.unit] ?? 0 }));

  const yAxis = unitsArr.map(u => ({
    title: false,
    labels: { format: `{value} ${u}` },
    opposite: true,
    visible: true
  }));

  const xAxis = isLargeDataset.value
    ? {
        type: 'linear',
        min: 0,
        max: 23,
        tickInterval: 1,
        title: { text: 'Hour' },
        labels: { formatter() { return this.value.toString().padStart(2,'0') + ':00'; } }
      }
    : {
        type: 'datetime',
        labels: { format: '{value: %H:%M}' },
        ordinal: !isRealtime.value
  };

  const tooltip = isLargeDataset.value
    ? {
      shared: true,
      crosshairs: true,
      formatter() {
        const d = new Date(this.x);
        const hour = d.getHours();
        const rows = this.points.map(p => {
          const s = p.series.userOptions;
          return `<span style="color:${p.color}">●</span> ${s.fullLabel} (${s.dayStr}): <b>${p.y.toFixed(2)} ${s.unit}</b>`;
        });
        return `<b>${hour}:00</b><br/>${rows.join('<br/>')}`;
      }
    }
    : {
        shared: true,
        valueDecimals: 2,
        xDateFormat: '%Y-%m-%d %H:%M:%S',
        formatter() {
          const xStr = new Date(this.x).toLocaleString();
          const rows = this.points.map(p => `<span style="color:${p.color}">●</span> ${p.series.userOptions.fullLabel || p.series.name}: <b>${p.y.toFixed(2)}</b>`);
          return `<b>${xStr}</b><br/>${rows.join('<br/>')}`;
        }
    };


  return {
    chart: { type: 'spline', height: 400 },
    rangeSelector: { enabled: false },
    legend: { enabled: false },
    title:  { text: '' },
    time:   { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, useUTC: false },
    xAxis,
    yAxis,
    tooltip,
    plotOptions: {
      series: {
        showInNavigator: true,
        dataGrouping: !isLargeDataset.value
          ? { enabled: true, units: [["minute",[5]]] }
          : { approximation: 'average',
            units: [['hour', [1]]], },  
        turboThreshold: isLargeDataset.value ? 50000 : 0,
        boostThreshold: isLargeDataset.value ? 50 : 500,
        boost: {
          useGPUTranslations: true,
          allowForce: true
        },
        animation: !isLargeDataset.value,
        stickyTracking: false 
      }
    },
    // export: {
    //   enabled: true,
    //   sourceWidth: 1200,
    //   sourceHeight: 600,
    //   chartOptions: {
    //     plotOptions: { series: { dataLabels: { enabled: true }, boost: { enabled: false } } }
    //   },
    //   filename: 'chart1',
    //   buttons: {
    //     contextButton: {
    //       symbol: 'download',
    //       // symbolFill: 'red',
    //       // symbolStroke: 'red',
    //       // symbolX: 5,
    //       // symbolY: -5
    //     }
    //   }
    // },
    series,
    credits: { enabled: false }
  };
});


function onLegendClick(legendKey) {
  if (legendKey === activeLegendKey.value) return;
  let targetType;
  if (GROUPS[legendKey]) {
    targetType = GROUPS[legendKey].members.find(m => presentIdsSet.value.has(m));
  } else {
    targetType = legendKey;
  }
  router.replace({ query: { ...route.query, type: targetType } });
}

watch(
  [() => props.log, () => activeLegendKey.value],
  async ([log, legendKey]) => {
    if (!legendKey || !log.length) return;
    const all = makeSeriesArray(log, legendKey);
    chartSeries.value = all;
    if (isRealtime.value) {
      await nextTick();
      const chart = chartRef.value.chart;
      const lastX = Math.max(...all.map(s => s.data.at(-1)?.[0] || 0));
      if (lastX) {
        chart.xAxis[0].setExtremes(
          lastX - WINDOW_MS,
          lastX,
          true,
          false
        );
      }
    }
  },
  { immediate: true }
);

watch(
  () => props.log.length,
  async (newLen, oldLen) => {
    if (!isRealtime.value || newLen <= oldLen || !activeLegendKey.value) return;
    const chart = chartRef.value.chart;

    const raw = makeSeriesArray(props.log, activeLegendKey.value)
      .sort((a, b) => a.name.localeCompare(b.name));

    const prevVis = {};
    chart.series.forEach(s => {
      prevVis[s.options.id] = s.visible;
    });

    chart.series.slice().forEach(s => {
      if (!raw.find(ns => ns.id === s.options.id)) {
        s.remove(false);
      }
    });

    let maxTime = 0;
    raw.forEach(ns => {
      const existing = chart.get(ns.id);
      if (existing) {
        existing.update(
          {
            name: ns.name,
            zones: ns.zones,
            dataGrouping: ns.dataGrouping
          },
          false
        );
        const lastX = existing.data.at(-1)?.x || -Infinity;
        ns.data
          .slice(oldLen)
          .filter(p => p[0] > lastX)
          .forEach(p => {
            existing.addPoint(p, false, false);
            maxTime = Math.max(maxTime, p[0]);
          });
      } else {
        chart.addSeries(
          { ...ns, visible: true },
          false
        );
        const pts = chart.get(ns.id).data;
        maxTime = Math.max(maxTime, pts.at(-1)?.x || 0);
      }
    });

    if (isRealtime.value && maxTime) {
      chart.xAxis[0].setExtremes(
        maxTime - WINDOW_MS,
        maxTime,
        false,
        false
      );
    }

    if (!raw.length) {
      const fallbackKey = visibleLegend.value[0]?.key;
      if (fallbackKey) {
        let fallbackType = GROUPS[fallbackKey]
          ? GROUPS[fallbackKey].members.find(m => presentIdsSet.value.has(m))
          : fallbackKey;
        router.replace({ query: { ...route.query, type: fallbackType } });
      }
    }

    chart.redraw();
  }
);

watch(
  () => props.log,
  newLog => {
    if (isRealtime.value || !activeLegendKey.value) return;
    chartSeries.value = makeSeriesArray(newLog, activeLegendKey.value);
  }
);

// если набор типов изменился
watch(
  () => props.log,
  (log) => {
    if (!log.length) return;
    const set = new Set();
    for (const point of log) {
      if (!point.data) continue;
      Object.keys(point.data).forEach(id => set.add(id.toLowerCase()));
    }
    // Обновляем только если изменился состав
    const old = presentIdsSet.value;
    if (
      set.size !== old.size ||
      [...set].some(id => !old.has(id))
    ) {
      presentIdsSet.value = set;
    }
  },
  { immediate: true }
);

watch(
  () => route.query.type,
  () => {
    if (!activeLegendKey.value) return;
    chartSeries.value = makeSeriesArray(props.log, activeLegendKey.value);
  }
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
