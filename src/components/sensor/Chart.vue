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
import { ref, watch, computed, nextTick, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Highcharts from 'highcharts';
import stockInit from 'highcharts/modules/stock';
import { Chart } from 'highcharts-vue';
import unitsettings from '../../measurements';
import { settings } from '@config';
import { useMapStore } from '@/stores/map';
import { setMapSettings } from '@/utils/utils';

stockInit(Highcharts);


const props = defineProps({
  log:  { type: Array, default: () => [] },
});

const route  = useRoute();
const router = useRouter();
const { t: tr, locale } = useI18n();
const mapStore = useMapStore();

const chartRef = ref(null);

// Группировка параметров для легенды графика
const GROUPS = {
  dust:    { members: ['pm25', 'pm10'], labelKey: 'Dust & Particles' },
  noise:   { members: ['noisemax', 'noiseavg', 'noise'], labelKey: 'Noise' },
  climate: { members: ['temperature', 'humidity', 'dewpoint'], labelKey: 'Climate' }
};

// Словарь для быстрого поиска группы по параметру
const GROUPS_LOOKUP = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([groupName, { members }]) => 
    members.map(paramId => [paramId, groupName])
  )
);

// Временное окно просмотра для realtime режима (1 час)
const REALTIME_VIEW_TIMELINE_MS = 60 * 60 * 1000;

// Найденные в данных единицы измерения
const UNITS_FOUND = ref(new Set());

const chartSeries = ref([]);

// Цветовые зоны отформатированные для Highcharts
const HIGHCHARTS_COLOR_ZONES = Object.fromEntries(
  Object.entries(unitsettings).map(([k, v]) => {
    if (!v.zones) return [k.toLowerCase(), []];
    const highchartsZones = v.zones.map((zone) => ({ value: zone.valueMax, color: zone.color }));
    return [k.toLowerCase(), highchartsZones];
  })
);

// Строит список видимых элементов легенды на основе найденных в данных единиц измерения
const visibleLegend = computed(() => {
  const legend = [];

  // Добавляем группы, если есть хотя бы один член
  Object.entries(GROUPS).forEach(([key, { members, labelKey }]) => {
    if (members.some(m => UNITS_FOUND.value.has(m))) {
      legend.push({ key, labelKey, single: false });
    }
  });

  // Добавляем одиночные параметры (не в группах, не aqi)
  const groupedIds = new Set(Object.values(GROUPS).flatMap(g => g.members));
  UNITS_FOUND.value.forEach(id => {
    if (!groupedIds.has(id) && id !== 'aqi') {
      const settings = unitsettings[id];
      const labelKey = settings?.namelong?.[locale.value] || 
                      settings?.nameshort?.[locale.value] || 
                      id.toUpperCase();
      legend.push({ key: id, labelKey, single: true });
    }
  });

  return legend;
});

// Определяет активный ключ легенды на основе текущего типа единицы измерения
const activeLegendKey = computed(() => {
  const currentGroup = GROUPS_LOOKUP[mapStore.currentUnit];
  if (currentGroup && visibleLegend.value.some(x => x.key === currentGroup)) return currentGroup;
  
  const isSingle = !currentGroup && UNITS_FOUND.value.has(mapStore.currentUnit);
  if (isSingle && visibleLegend.value.some(x => x.key === mapStore.currentUnit)) return mapStore.currentUnit;
  
  return visibleLegend.value[0]?.key || null;
});

const isRealtime  = computed(() => mapStore.currentProvider === 'realtime');

// Получаем экземпляр Highcharts для работы с графиком
const chart = computed(() => chartRef.value?.chart);

// Флаг для предотвращения конкурирующих обновлений графика
const isUpdatingChart = ref(false);

// Вычисляем уникальные единицы измерения для осей Y
const uniqueUnits = computed(() => [...new Set(chartSeries.value.map(s => s.unit))]);

// Создаем маппинг единиц измерения на индексы осей
const unitToAxisMapping = computed(() => 
  Object.fromEntries(uniqueUnits.value.map((unit, index) => [unit, index]))
);

// Подготавливаем серии с назначенными осями Y
const preparedSeries = computed(() => 
  chartSeries.value.map(series => ({ 
    ...series, 
    yAxis: unitToAxisMapping.value[series.unit] ?? 0 
  }))
);

// Конфигурация осей Y
const yAxisConfig = computed(() => 
  uniqueUnits.value.map(unit => ({
    title: false,
    labels: { format: `{value} ${unit}` },
    opposite: true,
    visible: true
  }))
);

// Конфигурация оси X
const xAxisConfig = computed(() => ({
  type: 'datetime',
  labels: { format: '{value: %H:%M}' },
  ordinal: !isRealtime.value
}));

// Конфигурация тултипа
const tooltipConfig = computed(() => ({
  shared: true,
  valueDecimals: 2,
  xDateFormat: '%Y-%m-%d %H:%M:%S',
  formatter() {
    const xStr = new Date(this.x).toLocaleString();
    const rows = this.points.map(point => 
      `<span style="color:${point.color}">●</span> ${point.series.userOptions.fullLabel || point.series.name}: <b>${point.y.toFixed(2)}</b>`
    );
    return `<b>${xStr}</b><br/>${rows.join('<br/>')}`;
  }
}));

// Основная конфигурация графика
const chartOptions = computed(() => ({
  chart: { type: 'spline', height: 400 },
  rangeSelector: { enabled: false },
  legend: { enabled: false },
  title: { text: '' },
  time: { 
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, 
    useUTC: false 
  },
  xAxis: xAxisConfig.value,
  yAxis: yAxisConfig.value,
  tooltip: tooltipConfig.value,
  plotOptions: {
    series: {
      showInNavigator: true,
      dataGrouping: { 
        enabled: true, 
        units: [["minute", [5]]] 
      },
    }
  },
  series: preparedSeries.value,
  credits: { enabled: false }
}));

/**
 * Обновление графика с поддержкой realtime и remote режимов
 * 
 * Realtime режим (определяется по mapStore.currentProvider):
 * - Инкрементальное обновление: добавляет только новые точки данных
 * - Сохраняет состояние видимости серий
 * - Автоматически обновляет временную шкалу
 * - Удаляет серии, которых больше нет в данных
 * 
 * Remote режим:
 * - Полное обновление графика через applySeriesDiffToChart
 * - Обновляет chartSeries.value для реактивности
 * - Для realtime режима также обновляет временную шкалу
 * 
 * @param {Array} log - Данные лога сенсора
 * @param {string} legendKey - Ключ легенды (если null, используется activeLegendKey или первый доступный)
 */
const updateChart = async (log, legendKey = null) => {
  if (!chartRef.value || !log.length) return;
  
  // Предотвращаем конкурирующие обновления
  if (isUpdatingChart.value) return;
  isUpdatingChart.value = true;
  
  try {
    const currentLegendKey = legendKey || activeLegendKey.value || visibleLegend.value[0]?.key;
    if (!currentLegendKey) return;
    
    if (!chart.value) return;
  
  if (isRealtime.value) {
    // Realtime режим: инкрементальное обновление
    const raw = buildSeriesArray(log, currentLegendKey).sort((a, b) => a.name.localeCompare(b.name));
    
    // Обновляем chartSeries для реактивности
    chartSeries.value = raw;
    
    // Сохраняем состояние видимости серий
    const prevVis = {};
    chart.value.series.forEach(s => {
      if (s.options) {
        prevVis[s.options.id] = s.visible;
      }
    });

    // Удаляем серии, которых больше нет
    chart.value.series.slice().forEach(s => {
      if (s.options && !raw.find(ns => ns.id === s.options.id)) {
        s.remove(false);
      }
    });

    let maxTime = 0;
    raw.forEach(ns => {
      const existing = chart.value.get(ns.id);
      if (existing) {
        existing.update({
          name: ns.name,
          zones: ns.zones,
          dataGrouping: ns.dataGrouping
        }, false);
        existing.setData(ns.data, false, false, false);
        if (typeof prevVis[ns.id] === 'boolean') {
          existing.setVisible(prevVis[ns.id], false);
        }
        // Добавляем только новые точки
        ns.data
          .filter(p => p[0] > (existing.data.at(-1)?.x || 0))
          .forEach(p => {
            existing.addPoint(p, false, false);
            maxTime = Math.max(maxTime, p[0]);
          });
      } else {
        chart.value.addSeries({ ...ns, visible: true }, false);
        const pts = chart.value.get(ns.id).data;
        maxTime = Math.max(maxTime, pts.at(-1)?.x || 0);
      }
    });

    // Обновляем временную шкалу для realtime
    if (maxTime) {
      chart.value.xAxis[0].setExtremes(
        maxTime - REALTIME_VIEW_TIMELINE_MS,
        maxTime,
        false,
        false
      );
    }

    chart.value.redraw(false);
  } else {
    // Remote режим: полное обновление графика
    const all = buildSeriesArray(log, currentLegendKey);
    applySeriesDiffToChart(chart.value, all);
    chartSeries.value = all;
  }
  } finally {
    isUpdatingChart.value = false;
  }
};

// Cache series per (legendKey, logSignature) to speed up tab switches
const seriesCache = new Map();
function getLogSignature(log) {
  if (!Array.isArray(log) || log.length === 0) return '0-0';
  const lastTs = log[log.length - 1]?.timestamp || 0;
  return `${log.length}-${lastTs}`;
}

/**
 * Строит массив серий Highcharts для выбранной группы легенды или отдельного параметра
 * - Для группы: показывает всех присутствующих участников (пунктирные линии для вторичных), один основной (сплошная, отображается в легенде)
 * - Для отдельного параметра: показывает только его
 * - Показывает только линии для параметров, фактически присутствующих в текущем логе
 * - В режиме realtime растягивает каждую серию до последнего часового окна, добавляя виртуальную точку при необходимости
 * @param {Array} log - Массив логов сенсора
 * @param {string} legendKey - Ключ легенды
 * @returns {Array} Массив серий Highcharts
 */
function buildSeriesArray(log, legendKey) {
  // Try cache first
  const sig = `${legendKey}|${getLogSignature(log)}`;
  const cached = seriesCache.get(sig);
  if (cached) return cached;

  const groupMainSeries = {}; // Первая серия в каждой группе (показывается в легенде)
  const seriesCollection = new Map(); // Коллекция всех серий

  for (const { timestamp, data } of log) {
    if (!timestamp || !data) continue;
    
    for (const [paramKey, paramValue] of Object.entries(data)) {
      const paramId = paramKey.toLowerCase();
      const paramGroup = GROUPS_LOOKUP[paramId];
      const paramSettings = unitsettings[paramId] || {};
      
      // Проверяем, нужно ли обрабатывать этот параметр для текущей вкладки легенды:
      // - Для групп: обрабатываем только если выбранная легенда соответствует группе параметра
      // - Для одиночных параметров: обрабатываем только если выбранная легенда соответствует самому параметру
      const shouldProcess = (paramGroup && paramGroup === legendKey) || 
                           (!paramGroup && paramId === legendKey);
      
      if (shouldProcess) {
        // Создаем серию если её еще нет
        if (!seriesCollection.has(paramId)) {
          const shortName = paramSettings.nameshort?.[locale.value] || paramId.toUpperCase();
          
          const seriesConfig = {
            id: paramId,
            unit: paramSettings.unit || '',
            name: paramGroup ? tr(GROUPS[paramGroup].labelKey) : shortName,
            fullLabel: paramSettings.namelong?.[locale.value] || shortName,
            data: [],
            zones: HIGHCHARTS_COLOR_ZONES[paramId] || [],
            dataGrouping: { enabled: true, units: [["minute", [5]]] }
          };

          if (paramGroup) {
            // Для групп: определяем основной и связанные серии
            if (!groupMainSeries[paramGroup]) {
              groupMainSeries[paramGroup] = paramId;
            }
            const mainSeriesId = groupMainSeries[paramGroup];
            const isMainSeries = paramId === mainSeriesId;
            
            seriesConfig.showInLegend = isMainSeries;
            seriesConfig.linkedTo = isMainSeries ? undefined : mainSeriesId;
            seriesConfig.dashStyle = isMainSeries || paramId === 'dewpoint' ? 'Solid' : 'ShortDot';
          } else {
            // Для одиночных параметров
            seriesConfig.showInLegend = true;
          }

          seriesCollection.set(paramId, seriesConfig);
        }
        
        // Добавляем точку данных
        const timestampMs = String(timestamp).length === 10 ? timestamp * 1000 : timestamp;
        seriesCollection.get(paramId).data.push([timestampMs, parseFloat(paramValue)]);
      }
    }
  }

  // Обрабатываем каждую серию: дедуплицируем данные и настраиваем отображение
  const processedSeries = Array.from(seriesCollection.values()).map(series => {
    // Убираем дубликаты по времени и сортируем
    let dataPoints = Array.from(new Map(series.data.map(([timestamp, value]) => [timestamp, value])).entries())
      .sort((a, b) => a[0] - b[0]);
    
    // В realtime режиме добавляем виртуальную точку в начале для правильного отображения
    if (isRealtime.value && dataPoints.length) {
      const lastTimestamp = dataPoints[dataPoints.length - 1][0];
      const timelineStart = lastTimestamp - REALTIME_VIEW_TIMELINE_MS;
      
      if (dataPoints[0][0] > timelineStart) {
        dataPoints = [[timelineStart, dataPoints[0][1]], ...dataPoints];
      }
    }
    
    return {
      ...series,
      data: dataPoints,
      dataGrouping: isRealtime.value
        ? { enabled: false }
        : {
            enabled: true,
            units: dataPoints.length > settings.SERIES_MAX_VISIBLE 
              ? { enabled: true, approximation: 'high', units: [['minute', [5]]] } 
              : series.dataGrouping
          }
    };
  });
  
  // Сортируем серии по имени и кэшируем результат
  const sortedSeries = processedSeries.sort((a, b) => a.name.localeCompare(b.name));
  seriesCache.set(sig, sortedSeries);
  return sortedSeries;
}



/**
 * Применяет массив серий к существующему экземпляру диаграммы с минимальным перерисовыванием
 * @param {Object} chart - Экземпляр диаграммы Highcharts
 * @param {Array} nextSeries - Массив новых серий
 */
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




/**
 * Обрабатывает клик по элементу легенды
 * @param {string} legendKey - Ключ элемента легенды
 */
function onLegendClick(legendKey) {
  if (legendKey === activeLegendKey.value) return;
  let targetType;
  if (GROUPS[legendKey]) {
    // For groups, take the first available member from the group
    targetType = GROUPS[legendKey].members.find(m => UNITS_FOUND.value.has(m));
  } else {
    // For single parameters, use the key directly
    targetType = legendKey;
  }
  // Update URL and store for deep-linking
  setMapSettings(route, router, mapStore, { type: targetType });
}


// Основной watcher для обновления графика при изменении данных или легенды
watch(
  [() => props.log, () => activeLegendKey.value],
  async ([log, legendKey]) => {
    if (!log.length || !chartRef.value || isUpdatingChart.value) return;
    
    // Ждем пока UNITS_FOUND заполнится данными
    if (UNITS_FOUND.value.size === 0) return;
    
    await updateChart(log, legendKey);
  },
  { immediate: true }
);

// Realtime обновления при добавлении новых данных
watch(
  () => props.log.length,
  async (newLen, oldLen) => {
    if (!isRealtime.value || newLen <= oldLen || !chartRef.value || isUpdatingChart.value) return;
    
    await updateChart(props.log);
  }
);

// Обновление найденных единиц измерения и графика при изменении данных
watch(
  () => props.log,
  (newLog) => {
    // Обновляем список найденных единиц измерения
    if (newLog.length) {
      const newUnits = new Set();
      for (const point of newLog) {
        if (!point.data) continue;
        Object.keys(point.data).forEach(id => newUnits.add(id.toLowerCase()));
      }
      
      // Обновляем только если изменился состав единиц
      const oldUnits = UNITS_FOUND.value;
      if (newUnits.size !== oldUnits.size || [...newUnits].some(id => !oldUnits.has(id))) {
        UNITS_FOUND.value = newUnits;
      }
    }
    
    // Обновляем график для remote режима
    if (!isRealtime.value) {
      updateChart(newLog);
    }
  },
  { immediate: true }
);


// If current unit is not available in this sensor, switch to the first available one
watch(
  () => Array.from(UNITS_FOUND.value),
  (idsArr) => {
    if (!idsArr || idsArr.length === 0) return;
    const ids = new Set(idsArr);
    const cur = mapStore.currentUnit;
    
    // Если есть данные и график еще не отрисован, принудительно обновляем
    if (props.log.length > 0 && chartRef.value && !isUpdatingChart.value) {
      updateChart(props.log);
    }
    
    // Check if current unit is available
    const curAvailable = ids.has(cur);
    if (curAvailable) return;
    
    // Find first available parameter by checking groups in order
    let next = null;
    for (const [groupKey, groupInfo] of Object.entries(GROUPS)) {
      const firstAvailable = groupInfo.members.find(member => ids.has(member));
      if (firstAvailable) {
        next = firstAvailable;
        break;
      }
    }
    
    // If no group member found, use the first available parameter
    if (!next) {
      next = idsArr[0];
    }
    
    if (next) {
      setMapSettings(route, router, mapStore, { type: next });
    }
  },
  { immediate: true }
);

// Принудительная инициализация графика при маунте
onMounted(async () => {
  await nextTick();
  
  if (props.log.length > 0 && chartRef.value && UNITS_FOUND.value.size > 0 && !isUpdatingChart.value) {
    updateChart(props.log);
  }
});
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
