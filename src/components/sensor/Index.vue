<template>
  <div class="popup-js active">
    <section>
      <h3 class="sensor-title clipoverflow">
        
        <Icon :sensorID="sensor_id" />

        <span v-if="point?.address">{{ point.address }}</span>
        <span v-else class="skeleton skeleton-text"></span>
      </h3>
    </section>

    <div class="scrollable-y">
      <section class="flexline-mobile-column">

        <div class="flexline mb">
          <AQIWidget v-if="state.provider !== 'realtime'" :logs="log" />

          <ProviderType />

          <div v-if="state.provider !== 'realtime'">
            <input type="date" v-model="pickedDate" :max="state.maxDate" @change="handleDateChange" />
          </div>

          <div v-else>
            <div v-if="realtimeScope.time" class="rt-time">{{ realtimeScope.time }}</div>
          </div>
        </div>

        <div v-if="state.provider === 'realtime'" class="flexline">
          <template v-if="realtimeScope.data && realtimeScope.data.length">
            <div v-for="item in realtimeScope.data" :key="item.key">
              <div class="rt-unit">{{ item.label }}</div>
              <div class="rt-number" :style="item.color ? 'color:' + item.color : ''">
                {{ item.measure }} {{ item.unit }}
              </div>
            </div>
          </template>
        </div>

      </section>

      <section>
        <Chart v-if="point?.logs && point?.logs.length > 0" :log="log" />
        <div v-else class="chart-skeleton"></div>
      </section>

      <section class="flexline space-between">
        <div class="flexline">
          <Bookmark
            v-if="sensor_id"
            :id="sensor_id"
            :address="point?.address"
            :link="sensor_id"
            :geo="geo"
          />
        </div>
        <div class="shared-container">
          <button
            v-if="globalWindow.navigator.share"
            @click.prevent="shareData"
            class="button"
            :title="t('sensorpopup.sharedefault')"
          >
            <font-awesome-icon icon="fa-solid fa-share-from-square" v-if="!state.sharedDefault" />
            <font-awesome-icon icon="fa-solid fa-check" v-if="state.sharedDefault" />
          </button>

          <button @click.prevent="shareLink" class="button" :title="t('sensorpopup.sharelink')">
            <font-awesome-icon icon="fa-solid fa-link" v-if="!state.sharedLink" />
            <font-awesome-icon icon="fa-solid fa-check" v-if="state.sharedLink" />
          </button>
        </div>
      </section>


      <section v-if="units && scales && scales.length > 0">
        <h3>{{ t("scales.title") }}</h3>
        <div class="scalegrid">
          <div v-for="item in scales" :key="item.label">
            <template v-if="item?.zones && (item.name || item.label)">
              <p>
                <b v-if="item.name">
                  {{item.nameshort[localeComputed]}}
                </b>
                <b v-else>{{ item.label }}</b>
                <template v-if="item.unit && item.unit !== ''">
                  ({{ item.unit }})
                </template>
              </p>
              <template v-for="zone in item.zones" :key="zone.color">
                <div
                  class="scales-color"
                  v-if="zone.color && zone.label"
                  :style="`--color: ${zone.color}`"
                >
                  <b>
                    {{ zone.label[localeComputed] ? zone.label[localeComputed] : zone.label.en }}
                  </b>
                  (<template v-if="typeof zone.valueMax === 'number'">
                    {{ t("scales.upto") }} {{ zone.valueMax }}
                  </template>
                  <template v-else>{{ t("scales.above") }}</template
                  >)
                </div>
              </template>
            </template>
          </div>
        </div>

        <p class="textsmall">
          <template v-if="isRussia">{{ t("notice_with_fz") }}</template>
          <template v-else>{{ t("notice_without_fz") }}</template>
        </p>
      </section>

      <section>
        <h3>{{ t("sensorpopup.infotitle") }}</h3>
        <div class="infoline flexline" v-if="sensor_id">
          <div class="infoline-title">{{ t("sensorpopup.infosensorid") }}:</div>
          <div class="infoline-info">
            {{ filters.collapse(sensor_id) }}
            <Copy
              :msg="sensor_id"
              :title="`Sensor id: ${sensor_id}`"
              :notify="t('details.copied')"
            />
          </div>
        </div>

        <div class="infoline flexline" v-if="geo && geo.lat && geo.lng">
          <div class="infoline-title">{{ t("sensorpopup.infosensorgeo") }}:</div>
          <div class="infoline-info">
            <a 
              v-if="sensor_id"
              :href="getMapLink(geo.lat, geo.lng, `Air Sensor: ${sensor_id}` )"
              target="_blank"
            >{{ geo.lat }}, {{ geo.lng }}</a>
            <span v-else>{{ geo.lat }}, {{ geo.lng }}</span>
          </div>
        </div>

        <div class="infoline flexline" v-if="metaUserLink">
          <div class="infoline-title">{{ t("sensorpopup.infosensorowner") }}:</div>
          <div class="infoline-info">
            <a :href="metaUserLink" rel="noopener" target="_blank">{{ metaUserLink }}</a>
          </div>
        </div>

        <div class="infoline flexline" v-if="donated_by">
          <div class="infoline-title">{{ t("sensorpopup.infosensordonated") }}:</div>
          <div class="infoline-info">{{ donated_by }}</div>
        </div>

      </section>

      <ReleaseInfo />
    </div>

    <button @click.prevent="closesensor" aria-label="Close sensor" class="close">
      <font-awesome-icon icon="fa-solid fa-xmark" />
    </button>
  </div>
</template>

<script setup>
import { reactive, computed, ref, watch, onMounted, getCurrentInstance, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { settings, pinned_sensors } from "@config";
import measurements from "../../measurements";
import { dayISO } from '../../utils/date';
import { useMap } from '@/composables/useMap';

import AQIWidget from './AQIWidget.vue';
import Bookmark from "./Bookmark.vue";
import Chart from "./Chart.vue";
import Copy from "./Copy.vue";
import ProviderType from "../ProviderType.vue";
import ReleaseInfo from "../ReleaseInfo.vue";
import Icon from "./Icon.vue";


const props = defineProps({
  point: Object,
});

const emit = defineEmits(["close"]);

const route = useRoute();
const { t, locale } = useI18n();
const { proxy } = getCurrentInstance();
const filters = proxy.$filters;
const globalWindow = window;
const mapState = useMap();

// Локальное состояние только для UI компонента
const state = reactive({
  maxDate: dayISO(),
  provider: mapState.currentProvider.value,
  sharedDefault: false,
  sharedLink: false
});

// Отдельная сущность для realtime данных
const realtimeScope = reactive({
  time: null,
  data: []
});

// Выбранная пользователем дата для v-model (синхронизируется с store)
const pickedDate = computed({
  get: () => mapState.currentDate.value,
  set: (value) => {
    mapState.setCurrentDate(value);
  }
});


const units = ref([]);


const sensor_id = computed(() => {
  // sensor_id всегда приходит из props.point (обрабатывается в Main.vue)
  return props.point?.sensor_id || null;
});

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");

const geo = computed(() => {
  // Координаты всегда приходят из props.point.geo (обрабатывается в Main.vue)
  return props.point?.geo || { lat: 0, lng: 0 };
});

const donated_by = computed(() => props.point?.donated_by || null);

// Гарантируем, что logs всегда массив
const log = computed(() => (Array.isArray(props.point?.logs) ? props.point.logs : []));

const isRussia = computed(() => {
  // Проверяем адрес на наличие российских индикаторов
  const address = props.point?.address || "";
  return /^(RU|Россия|Russia|, RU|, Россия|, Russia)/i.test(address);
});


const scales = computed(() => {
  const buffer = [];
  Object.keys(measurements).forEach((key) => {
    if (units.value.some((unit) => unit === key)) {
      if(measurements[key].zones) {
       buffer.push(measurements[key]);
      }
    }
  });
  
  return buffer.sort((a, b) => {
    const nameA = a.nameshort[localeComputed] || '';
    const nameB = b.nameshort[localeComputed] || '';
    return nameA.localeCompare(nameB);
  });
});


const metaUserLink = computed(() => {
  return pinned_sensors[sensor_id.value] ? pinned_sensors[sensor_id.value].link : "";
});


const shareData = () => {
  if (navigator.share) {
    navigator.share({
      title: settings.TITLE,
      url: window.location.href,
    });
  }
};

const shareLink = () => {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      state.sharedLink = true;
      setTimeout(() => {
        state.sharedLink = false;
      }, 5000);
    })
    .catch((e) => console.error("Sensor's link not copied", e));
};

/**
 * Форматирует realtime данные для отображения в UI
 * Обновляет время и данные последнего измерения
 */
const formatRealtimeScope = () => {
  if (state.provider !== "realtime" || log.value.length === 0) return;
  
  const last = log.value[log.value.length - 1];
  
  // Обновляем время
  if (last.timestamp) {
    realtimeScope.time = new Date(last.timestamp * 1000).toLocaleString();
  }
  
  // Обновляем данные
  if (!last.data) return;
  
  realtimeScope.data = Object.entries(last.data)
    .filter(([key]) => measurements[key]) // Только известные измерения
    .map(([key, value]) => {
      const measurement = measurements[key];
      const zones = measurement.zones || [];
      
      return {
        key,
        measure: value,
        label: measurement.nameshort?.[localeComputed.value] || measurement.label,
        unit: measurement.unit,
        color: getZoneColor(value, zones)
      };
    });
};

/**
 * Получает цвет зоны для значения измерения
 * @param {number} value - Значение измерения
 * @param {Array} zones - Массив зон с цветами
 * @returns {string|undefined} Цвет зоны или undefined
 */
const getZoneColor = (value, zones) => {
  if (!zones.length) return undefined;
  
  const matchedZone = zones.find(zone => 
    typeof zone.valueMax === 'number' && value < zone.valueMax
  );
  
  if (matchedZone) return matchedZone.color;
  
  // Если значение больше всех зон, используем цвет последней зоны
  if (zones.length > 1) {
    const lastZone = zones[zones.length - 1];
    const preLastZone = zones[zones.length - 2];
    if (typeof preLastZone?.valueMax === 'number' && value > preLastZone.valueMax) {
      return lastZone.color;
    }
  }
  
  return undefined;
};


/**
 * Строит список доступных единиц измерения на основе данных логов
 * @returns {Array} Отсортированный массив единиц измерения
 */
function buildUnitsList() {
  const set = new Set();
  log.value.forEach(item => {
    if (item?.data) Object.keys(item.data).forEach(u => set.add(u.toLowerCase()));
  });
  
  // Добавляем AQI если есть данные PM2.5 и PM10
  const hasPM25 = log.value.some(item => item?.data?.pm25);
  const hasPM10 = log.value.some(item => item?.data?.pm10);
  if (hasPM25 && hasPM10) {
    set.add('aqi');
  }
  
  return Array.from(set).sort();
}


const closesensor = () => {
  // Просто эмитим событие закрытия - всю логику обрабатывает Main.vue
  emit("close");
};

// Обрабатывает изменение даты: убирает фокус и очищает логи
const handleDateChange = async (event) => {
  // Убираем фокус с input (особенно важно на мобильных)
  event.target.blur();
  
  // Ждем следующего тика, чтобы v-model успел обновиться
  await nextTick();
  
  // Очищаем логи при смене даты
  log.value = [];
  // Очищаем логи в point для показа skeleton
  if (props.point) {
    props.point.logs = [];
  }
};


/**
 * Генерирует ссылку на карту в зависимости от устройства
 * @param {number} lat - Широта
 * @param {number} lon - Долгота  
 * @param {string} [label="Sensor"] - Подпись для метки
 * @returns {string} URL ссылки на карту
 */
function getMapLink(lat, lon, label = "Sensor") {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(label)}`;
  }
  if (isAndroid) {
    return `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(label)})`;
  }
  return `https://www.google.com/maps?q=${lat},${lon}`;
}


onMounted(() => {
  // Обновляем realtime данные если нужно
  formatRealtimeScope();
});

// removed unused onUnmounted hook

// Watcher для изменений даты (из UI или внешних источников)
watch(
  () => mapState.currentDate.value,
  (newDate) => {
    if (newDate) {
      // Очищаем логи при смене даты
      log.value = [];
      // Очищаем логи в point для показа skeleton
      if (props.point) {
        props.point.logs = [];
      }
    }
  }
);

// Watcher для изменений провайдера извне
watch(
  () => mapState.currentProvider.value,
  (newProvider) => {
    if (newProvider && newProvider !== state.provider) {
      state.provider = newProvider;
    }
  }
);


watch(() => log.value, (newLogs, oldLogs) => {
    // Если массив пустой, больше ничего не делаем
    if (newLogs.length === 0) return;
    
    // Проверяем, изменились ли данные (избегаем лишних обновлений)
    if (oldLogs && newLogs.length === oldLogs.length) {
      const hasChanged = newLogs.some((item, index) => {
        const oldItem = oldLogs[index];
        return !oldItem || item.timestamp !== oldItem.timestamp || 
               JSON.stringify(item.data) !== JSON.stringify(oldItem.data);
      });
      if (!hasChanged) return;
    }

    // Обновляем realtime данные для UI
    formatRealtimeScope();

    // update units list for scales
    const nextUnits = buildUnitsList();
    const prevUnits = units.value;
    const changed = nextUnits.length !== prevUnits.length || nextUnits.some((u, i) => u !== prevUnits[i]);
    if (changed) units.value = nextUnits;
  }
);

// URL обновление теперь происходит только в Main.vue
// Здесь оставляем только UI-специфичную логику

</script>

<style scoped>
.popup-js.active {
  container: popup / inline-size;
  background: var(--color-light);
  border-radius: 0;
  bottom: 0;
  box-sizing: border-box;
  color: var(--color-dark);
  padding: var(--gap);
  position: absolute;
  right: 0;
  top: 0;
  width: 80vw;
  max-width: 1000px;
  z-index: 100;
  box-shadow: -6px 0 12px -4px rgba(0, 0, 0, 0.3);
}

.scrollable-y {
  max-height: 90%;
}

.close {
  border: 0;
  color: var(--color-dark);
  cursor: pointer;
  position: absolute;
  right: var(--gap);
  top: var(--gap);
}

.close:hover {
  color: var(--color-red);
}

.close svg {
  height: 2rem;
}

.monthly-analysis {
  margin-top: calc(var(--gap) * 3);
  margin-bottom: calc(var(--gap) * 2);
}

.monthly-analysis h2 {
  margin-bottom: calc(var(--gap) * 0.5);;
}

.monthly-analysis .flexline {
  margin-bottom: var(--gap);
}

.chart-wrapper {
  position: relative;
}

.monthly-scope-warning {
  position: absolute;
  top: 50%;
  left: 50%;
  font-weight: 600;
  transform: translateX(-50%);
}

/* Стили скелетона для заглушки графика */
.chart-skeleton {
  height: 300px;
  width: 100%;
  background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Стили заглушки для текста */
.skeleton-text {
  display: inline-block;
  height: 1em;
  width: 100%;
  background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media screen and (max-width: 700px) {
  .popup-js.active {
    left: 0;
    width: 100%;
    top: 0;
    padding-right: calc(var(--gap) * 0.5);
    padding-top: calc(2rem + var(--gap));
  }

  .close {
    font-size: 2rem !important; 
  }
}

@container popup (min-width: 400px) {
  .close {
    font-size: 1.8em;
  }
}

@container popup (max-width: 400px) {
  h3.flexline {
    max-width: calc(100% - var(--gap) * 3);
  }

  .close {
    font-size: 1.8em;
  }
}

.infoline.flexline {
  gap: calc(var(--gap) * 0.5);
}

.infoline-title {
  font-weight: bold;
}

/* shared container */
.shared-container button:first-of-type {
  margin-right: 10px;
}

@media screen and (max-width: 570px) {
  .shared-container {
    display: flex;
    gap: 10px;
    padding-right: 10px;
  }
  .shared-container button:first-of-type {
    margin-right: 0;
    flex-shrink: 0;
  }

  .shared-container button {
    min-width: 20px;
    min-height: 20px;
  }
}
/* shared container */

/* + scales */
.scalegrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--gap);
  font-size: 0.8em;
}
.scalegrid:not(:last-child) {
  margin-bottom: calc(var(--gap) * 2);
}
.scalegrid p {
  margin-bottom: calc(var(--gap) * 0.5);
}
.scales-color {
  position: relative;
  padding-left: calc(var(--gap) * 2);
  hyphens: auto;
}
.scales-color:before {
  content: "";
  display: block;
  position: absolute;
  background-color: var(--color);
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--gap);
}
/* - scales */

/* + realtime */
/* removed .rt-title indicator styles (not used) */
.rt-time {
  font-size: 0.8em;
  font-weight: 300;
}
.rt-unit,
.rt-number {
  font-size: 0.8em;
  font-weight: 900;
}

.rt-number {
  color: var(--color-blue);
}

/* - realtime */

.sensor-title {
  display: flex;
  gap: var(--gap);
  align-items: center;
  margin-right: 2rem;
}

.sensor-title span {
  font-size: inherit;
}

</style>
