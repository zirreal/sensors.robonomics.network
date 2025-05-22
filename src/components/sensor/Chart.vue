<template>
  <Chart
    ref="chartRef"
    constructor-type="stockChart"
    :options="chartOptions"
  />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Highcharts from 'highcharts'
import stockInit from 'highcharts/modules/stock'
import { Chart } from 'highcharts-vue'
import unitsettings from '../../measurements'
import config from '@config'
import { getTypeProvider } from '../../utils/utils'

stockInit(Highcharts)

// Props и переменные
const props = defineProps({ log: { type: Array, default: () => [] } })
const route = useRoute()
const activeType = (route.params.type ?? 'pm10').toLowerCase()
const MAX_VISIBLE = config.SERIES_MAX_VISIBLE
const provider = getTypeProvider()
const isRealtime = provider === 'realtime'
const chartRef = ref(null)
// Окно отображения (1 час)
const WINDOW_MS = 60 * 60 * 1000

// Сборка данных по сериям
function buildSeriesMap(log) {
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  )
  const map = new Map()
  for (const entry of log) {
    const { timestamp, data } = entry
    if (!timestamp || !data) continue
    const t = String(timestamp).length === 10 ? timestamp * 1000 : timestamp
    for (const [key, val] of Object.entries(data)) {
      const name = key.toLowerCase()
      if (!map.has(name)) {
        map.set(name, { name, data: [], zones: zonesMap[name] || [], dataGrouping: { enabled: true, units: [['minute', [5]]] } })
      }
      map.get(name).data.push([t, parseFloat(val)])
    }
  }
  return map
}

function makeSeriesArray(log) {
  const map = buildSeriesMap(log)
  return Array.from(map.values()).map(s => ({
    id: s.name,
    name: s.name,
    data: s.data,
    zones: s.zones,
    dataGrouping: isRealtime
      ? { enabled: false }
      : (s.data.length > MAX_VISIBLE
         ? { enabled: true, approximation: 'high', units: [['minute', [5]]] }
         : s.dataGrouping)
  }))
}

// Chart опции (не реактивны)
const chartOptions = {
  chart: { type: 'spline', height: 400 },
  rangeSelector: { inputEnabled: false, buttons: [{ type: 'all', text: 'All' }] },
  legend: { enabled: true },
  title: { text: '' },
  time: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  xAxis: { type: 'datetime', labels: { format: '{value:%H:%M}' }, ordinal: !isRealtime },
  yAxis: { title: false },
  tooltip: { valueDecimals: 2 },
  plotOptions: {
    series: {
      showInNavigator: true,
      dataGrouping: isRealtime ? { enabled: false } : { enabled: true, units: [['minute', [5]]] },
      // cropThreshold: Infinity
    }
  },
  series: []
}

// Инициализация при монтировании
onMounted(() => {
  // Начальные серии
  const initial = makeSeriesArray(props.log).map(s => ({ ...s, visible: s.id === activeType }))
  chartOptions.series = initial
  // Если realtime, фиксируем окно
  if (isRealtime) {
    setTimeout(() => {
      const chart = chartRef.value.chart
      const lastTime = initial.reduce((max, s) => Math.max(max, s.data[s.data.length - 1]?.[0] || 0), 0)
      if (lastTime) chart.xAxis[0].setExtremes(lastTime - WINDOW_MS, lastTime)
    }, 0)
  }
})

// Динамическое обновление только новых точек
watch(
  () => props.log.length,
  (newLen, oldLen) => {
    if (newLen <= oldLen) return
    const chart = chartRef.value.chart
    const raw = makeSeriesArray(props.log)
    const prevVis = {}
    chart.series.forEach(s => { prevVis[s.options.id] = s.visible })
    chart.series.slice().forEach(s => {
      if (!raw.find(ns => ns.id === s.options.id)) s.remove(false)
    })
    let maxTime = 0
    raw.forEach(ns => {
      const ex = chart.get(ns.id)
      if (ex) {
        ex.update({ zones: ns.zones, dataGrouping: ns.dataGrouping }, false)
        const lastX = ex.data[ex.data.length - 1]?.x || -Infinity
        ns.data.slice(oldLen).filter(p => p[0] > lastX).forEach(p => {
          ex.addPoint(p, false, false)
          maxTime = Math.max(maxTime, p[0])
        })
      } else {
        chart.addSeries({ ...ns, visible: prevVis[ns.id] ?? (ns.id === activeType) }, false)
        const pts = chart.get(ns.id).data
        maxTime = Math.max(maxTime, pts[pts.length - 1]?.x || 0)
      }
    })
    if (isRealtime && maxTime) chart.xAxis[0].setExtremes(maxTime - WINDOW_MS, maxTime, false, false)
    chart.redraw()
  }
)
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