<template>
  <div v-if="aqiValue !== null" class="aqi" :style="aqiStyle">
    <div class="aqi-badge">
      <div class="aqi-box">
        <span class="aqi-value">{{ aqiValue }}</span>
      </div>
      <div class="aqi-text">
        <div class="aqi-subtext">{{ aqiTitle }}</div>
        <div v-if="zoneLabel" class="aqi-label">{{ zoneLabel }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { calculateAQIIndex } from '../../utils/aqiIndex';
import aqiMeasurement from '../../measurements/aqi';

const props = defineProps({
  logs: { type: Array, default: () => [] }
});

const { locale } = useI18n();
const localeComputed = computed(() => localStorage.getItem('locale') || locale.value || 'en');

const aqiValue = computed(() => {
  const v = calculateAQIIndex(props.logs);
  return typeof v === 'number' ? v : null;
});

const aqiTitle = computed(() => {
  const l = localeComputed.value;
  const nm = aqiMeasurement?.name;
  if (nm && typeof nm === 'object') {
    return nm[l] || nm.en || 'AQI';
  }
  return 'AQI';
});

const matchedZone = computed(() => {
  if (aqiValue.value === null) return null;
  const zones = Array.isArray(aqiMeasurement?.zones) ? aqiMeasurement.zones : [];
  return zones.find(z => typeof z.valueMax === 'number' && aqiValue.value <= z.valueMax) || null;
});

const zoneLabel = computed(() => {
  const z = matchedZone.value;
  if (!z?.label) return '';
  const l = localeComputed.value;
  return z.label[l] || z.label.en || '';
});

const aqiStyle = computed(() => {
  const z = matchedZone.value;
  return z?.color ? { backgroundColor: z.color } : {};
});
</script>

<style scoped>
.aqi {
  height: 40px;
  border-radius: 4px;
  padding: 8px 15px;
}
.aqi-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}
.aqi-box {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 20px;
}
.aqi-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.aqi-value { font-size: 18px; }
.aqi-label { font-size: 7px; font-weight: bold; }
.aqi-subtext { font-size: 10px; font-weight: bold; }
</style>


