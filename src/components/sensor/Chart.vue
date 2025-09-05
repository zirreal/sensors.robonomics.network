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
import { Chart } from 'highcharts-vue';
import unitsettings from '../../measurements';
import { settings } from '@config';
import { getTypeProvider } from '../../utils/utils';
import { useMapStore } from '@/stores/map';

stockInit(Highcharts);

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
  unit: { type: String },
  isChartReady: { type: Boolean }
});
const chartRef = ref(null);

const route  = useRoute();
const router = useRouter();
const { t: tr, locale } = useI18n();
const mapStore = useMapStore();
// priority auto-selection removed per request


const WINDOW_MS   = 60 * 60 * 1000;
const MAX_VISIBLE = settings.SERIES_MAX_VISIBLE;

const GROUPS = {
  dust:    { members: ['pm10', 'pm25'], labelKey: 'Dust & Particles' },
  noise:   { members: ['noise', 'noisemax', 'noiseavg'], labelKey: 'Noise' },
  climate: { members: ['temperature', 'humidity', 'dewpoint'], labelKey: 'Climate' }
};
const idToGroup = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, { members }]) => members.map(id => [id, g])));

// Запоминаем уникальные типы
const presentIdsSet = ref(new Set());

// Precompute zones map once (avoid recomputing on every tab switch)
const zonesMap = Object.fromEntries(
  Object.entries(unitsettings).map(([k, v]) => {
    if (!v.zones) return [k.toLowerCase(), []];
    const highchartsZones = v.zones.map((zone) => ({ value: zone.valueMax, color: zone.color }));
    return [k.toLowerCase(), highchartsZones];
  })
);

// Cache series per (legendKey, logSignature) to speed up tab switches
const seriesCache = new Map();
function getLogSignature(log) {
  if (!Array.isArray(log) || log.length === 0) return '0-0';
  const lastTs = log[log.length - 1]?.timestamp || 0;
  return `${log.length}-${lastTs}`;
}

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
  // Try cache first
  const sig = `${legendKey}|${getLogSignature(log)}`;
  const cached = seriesCache.get(sig);
  if (cached) return cached;

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
              units: [["minute", [5]]] 
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
              units: [["minute", [5]]] 
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
              units: (many ? { enabled: true, approximation: 'high', units: [['minute', [5]]] } : s.dataGrouping)
            }
    };
  });
  const sorted = out.sort((a, b) => a.name.localeCompare(b.name));
  seriesCache.set(sig, sorted);
  return sorted;
}

const makeSeriesArray = (log, legendKey) => {
  return buildSeriesArray(log, isRealtime.value, MAX_VISIBLE, legendKey); 
};

// Apply series array to an existing chart instance with minimal reflow
function applySeriesDiffToChart(chart, nextSeries) {
  if (!chart) return;
  const raw = nextSeries.sort((a, b) => a.name.localeCompare(b.name));

  // Remember visibility state
  const prevVis = {};
  (chart.series || []).forEach(s => { if (s && s.options) prevVis[s.options.id] = s.visible; });

  // Remove series that are no longer present
  (chart.series || []).slice().forEach(s => {
    if (s && s.options && !raw.find(ns => ns.id === s.options.id)) {
      s.remove(false);
    }
  });

  // Add/update series
  raw.forEach(ns => {
    const existing = chart.get(ns.id);
    if (existing) {
      existing.update({
        name: ns.name,
        zones: ns.zones,
        dataGrouping: ns.dataGrouping
      }, false);
      existing.setData(ns.data, false, false, false);
      if (typeof prevVis[ns.id] === 'boolean') existing.setVisible(prevVis[ns.id], false);
    } else {
      chart.addSeries({ ...ns, visible: true }, false);
    }
  });

  chart.redraw(false);
}

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

  const xAxis =  {
    type: 'datetime',
    labels: { format: '{value: %H:%M}' },
    ordinal: !isRealtime.value
  };

  const tooltip = {
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
        dataGrouping: { enabled: true, units: [["minute",[5]]] },
      }
    },
    series,
    credits: { enabled: false }
  };
});


function onLegendClick(legendKey) {
  if (legendKey === activeLegendKey.value) return;
  let targetType;
  if (GROUPS[legendKey]) {
    // Special case: Dust on remote with both pm25 and pm10 → prefer AQI
    if (
      legendKey === 'dust' &&
      getTypeProvider() === 'remote' &&
      presentIdsSet.value.has('pm25') &&
      presentIdsSet.value.has('pm10')
    ) {
      targetType = 'aqi';
    } else {
      // otherwise pick first present id of the group
      targetType = GROUPS[legendKey].members.find(m => presentIdsSet.value.has(m));
    }
  } else {
    targetType = legendKey;
  }
  // Update URL for deep-linking
  router.replace({ query: { ...route.query, type: targetType } });
  // Also synchronize reactive unit with the map store.
  // While popup is open, Map.vue will ignore this and not repaint.
  mapStore.setCurrentUnit(targetType);
}

// auto-priority watcher removed per request

// Keep Dust preference (remote → AQI, realtime → PM2.5) when Dust tab is active


watch(
  [() => props.log, () => activeLegendKey.value],
  async ([log, legendKey]) => {
    if (!legendKey || !log.length) return;
    const all = makeSeriesArray(log, legendKey);
    const chart = chartRef.value?.chart;
    if (chart) {
      applySeriesDiffToChart(chart, all);
    }
    chartSeries.value = all;
    if (isRealtime.value) {
      await nextTick();
      const chart = chartRef.value?.chart;
      if (chart && chart.xAxis && chart.xAxis[0]) {
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
    }
  },
  { immediate: true }
);

watch(
  () => props.log.length,
  async (newLen, oldLen) => {
    if (!isRealtime.value || newLen <= oldLen || !activeLegendKey.value) return;
    const chart = chartRef.value?.chart;
    if (!chart) return;

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

    chart.redraw(false);
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
    const all = makeSeriesArray(props.log, activeLegendKey.value);
    const chart = chartRef.value?.chart;
    if (chart) applySeriesDiffToChart(chart, all);
    chartSeries.value = all;
  }
);

// If current unit is not available in this sensor, switch to the first available one
watch(
  () => Array.from(presentIdsSet.value),
  (idsArr) => {
    if (!idsArr || idsArr.length === 0) return;
    const ids = new Set(idsArr);
    const provider = getTypeProvider();
    const cur = (mapStore.currentUnit || route.query.type || '').toLowerCase();
    const hasPM25 = ids.has('pm25');
    const hasPM10 = ids.has('pm10');
    const aqiAvailable = provider === 'remote' && hasPM25 && hasPM10;
    const curAvailable = cur === 'aqi' ? aqiAvailable : ids.has(cur);
    if (curAvailable) return;
    let next = null;
    if (cur === 'aqi') {
      next = hasPM25 ? 'pm25' : (hasPM10 ? 'pm10' : null);
    }
    if (!next) {
      // Prefer AQI instead of bare pm10 when conditions allow it
      if (idsArr[0] === 'pm10' && aqiAvailable) {
        next = 'aqi';
      } else {
        next = idsArr[0];
      }
    }
    if (next) {
      mapStore.setCurrentUnit(next);
      router.replace({ query: { ...route.query, type: next } });
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
