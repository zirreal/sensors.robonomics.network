<template>
  <div v-if="aqiValue !== null" class="aqi-container">
    <div class="aqi" :style="aqiStyle">
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
    
    <select 
      v-model="selectedVersion" 
      @change="handleVersionChange"
      class="aqi-version-select"
    >
      <option value="us">US EPA</option>
      <option value="eu">EU Standards</option>
    </select>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapStore } from '@/stores/map';
import { calculateAQIIndex as calculateAQIIndexUS } from '../../utils/aqiIndex/us';
import { calculateAQIIndex as calculateAQIIndexEU } from '../../utils/aqiIndex/eu';
import aqiUSZones from '../../measurements/aqi_us';
import aqiEUZones from '../../measurements/aqi_eu';

const props = defineProps({
  logs: { type: Array, default: () => [] }
});

const { locale } = useI18n();
const mapStore = useMapStore();
const localeComputed = computed(() => localStorage.getItem('locale') || locale.value || 'en');
const selectedVersion = ref(mapStore.aqiVersion);

// AQI version selector function
const getAQICalculator = (version = 'us') => {
  switch (version) {
    case 'us':
      return calculateAQIIndexUS;
    case 'eu':
      return calculateAQIIndexEU;
    default:
      return calculateAQIIndexUS;
  }
};

// Get appropriate zones based on AQI version
const getAQIZones = (version = 'us') => {
  if (version === 'eu') {
    return aqiEUZones;
  }
  return aqiUSZones;
};

const aqiValue = computed(() => {
  const calculateAQIIndex = getAQICalculator(mapStore.aqiVersion);
  const v = calculateAQIIndex(props.logs);
  
  
  return typeof v === 'number' ? v : null;
});

const aqiTitle = computed(() => {
  // Показываем разные названия в зависимости от выбранной версии AQI
  if (mapStore.aqiVersion === 'eu') {
    return 'AQI (EU)';
  } else {
    return 'AQI (US EPA)';
  }
});

const matchedZone = computed(() => {
  if (aqiValue.value === null) return null;
  const zones = getAQIZones(mapStore.aqiVersion);
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

const handleVersionChange = () => {
  mapStore.setAQIVersion(selectedVersion.value);
  // Watcher will handle cache clearing and marker refresh
};

onMounted(() => {
  // Watch for external changes to aqiVersion
  selectedVersion.value = mapStore.aqiVersion;
});

// Watch for changes in aqiVersion from store and update markers
watch(
  () => mapStore.aqiVersion,
  (newVersion) => {
    // Update local selected version
    selectedVersion.value = newVersion;
    
    // Clear AQI cache and refresh markers
    import('@/utils/map/markers').then(module => {
      if (module.clearAQICache) {
        module.clearAQICache(mapStore.currentDate);
      }
      
      if (module.refreshClusters) {
        module.refreshClusters();
      }
    });
  }
);
</script>

<style scoped>
.aqi-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

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


