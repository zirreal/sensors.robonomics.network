<template>
  <Chart
    :constructor-type="'stockChart'"
    :options="chartOptions"
    :updateArgs="[true, true]"
    ref="chartRef"
  />
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Highcharts from 'highcharts'
import stockInit from 'highcharts/modules/stock'
import { Chart } from 'highcharts-vue'
import unitsettings from '../../measurements'
import config from '@config'
import { getTypeProvider } from '../../utils/utils'

stockInit(Highcharts)

const props = defineProps({ log: Array })
const route = useRoute()
const provider = route.params.provider || getTypeProvider()

const activeType = computed(() => {
  const t = route.params.type ?? 'pm10'
  return String(t).toLowerCase()
})

const MAX_VISIBLE = config.SERIES_MAX_VISIBLE
const isInitial = ref(true)

function buildSeriesMap(log) {
  const zonesMap = Object.fromEntries(
    Object.entries(unitsettings).map(([k, v]) => [k.toLowerCase(), v.zones])
  )
  const map = new Map()
  for (const item of log) {
    if (!item.timestamp || !item.data) continue
    const t = String(item.timestamp).length === 10 ? item.timestamp * 1000 : item.timestamp
    for (const [key, val] of Object.entries(item.data)) {
      const name = key.toLowerCase()
      if (!map.has(name)) {
        map.set(name, {
          name,
          data: [],
          zones: zonesMap[name],
          dataGrouping: { enabled: true, units: [['minute', [5]]] }
        })
      }
      map.get(name).data.push([t, parseFloat(val)])
    }
  }
  return map
}

const baseOpts = {
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
      showInNavigator: true,
      dataGrouping: { enabled: true }
    }
  }
}

const chartOptions = ref({ ...baseOpts, series: [] })
const chartRef = ref(null)

watch(
  () => props.log,
  async (log) => {
    const map = buildSeriesMap(log)

    const arr = Array.from(map.values()).map(s => {
      if (s.data.length > MAX_VISIBLE) {
        s.dataGrouping = { enabled: true, approximation: 'high', units: [['minute', [5]]] }
      }
      return s
    })

    const seriesArr = arr.map(s => {
      const prev = chartOptions.value.series.find(ps => ps.id === s.name)
      const visible = isInitial.value
        ? s.name === activeType.value
        : (prev ? prev.visible : true)

      return {
        id: s.name,
        name: s.name,
        data: s.data,
        zones: s.zones,
        dataGrouping: s.dataGrouping,
        visible
      }
    })

    if (chartRef.value && chartRef.value.chart) {
      await nextTick()
      chartRef.value.chart.update(
        { series: seriesArr },
        true,
        true
      )
    } else {
      chartOptions.value.series = seriesArr
    }

    isInitial.value = false
  },
  { immediate: true }
)
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
