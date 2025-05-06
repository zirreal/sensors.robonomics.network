<template>
  <div class="popup-js active">
    <section>
      <h3 class="flexline clipoverflow">
        <img v-if="icon" :src="icon" class="icontitle" />
        <font-awesome-icon v-else icon="fa-solid fa-location-dot" />
        <span v-if="addressformatted">{{ addressformatted }}</span>
        <span v-else class="skeleton-text"></span>
      </h3>
    </section>

    <div class="scrollable-y">
      <section class="flexline space-between">
        <div class="flexline">
          <input v-if="!realtime" type="date" v-model="state.start" :max="state.maxDate" />
          <Bookmark
            v-if="sensor_id"
            :id="sensor_id"
            :address="address?.address && address.address.join(', ')"
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

      <SelectRealtime :provider="currentProvider" />
      <section v-if="realtime" class="flexline">
        <div>
          <!-- <div class="rt-title">Realtime view mode</div> -->
          <div v-if="state.rttime" class="rt-time">{{ state.rttime }}</div>
        </div>
        <template v-if="rtdata">
          <div v-for="item in rtdata" :key="item.key">
            <div class="rt-unit">{{ item.label }}</div>
            <div class="rt-number" :style="item.color ? 'color:' + item.color : ''">
              {{ item.measure }} {{ item.unit }}
            </div>
          </div>
        </template>
      </section>

      <section>
        <!-- Показываем Chart, если данные готовы, иначе — скелет для графика -->
        <Chart v-if="chartReady" :point="props.point" :log="log" />
        <div v-else class="chart-skeleton"></div>
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
          <div class="infoline-info">{{ geo.lat }}, {{ geo.lng }}</div>
        </div>

        <div class="infoline flexline" v-if="link">
          <div class="infoline-title">{{ t("sensorpopup.infosensorowner") }}:</div>
          <div class="infoline-info">
            <a :href="link" rel="noopener" target="_blank">{{ link }}</a>
          </div>
        </div>

        <div class="infoline flexline" v-if="donated_by">
          <div class="infoline-title">{{ t("sensorpopup.infosensordonated") }}:</div>
          <div class="infoline-info">{{ donated_by }}</div>
        </div>

        <div v-if="model === 3" class="infoline flexline">
          <div class="infoline-title">
            <label for="realtime"></label>
            <span class="sensors-switcher-text"> {{ t("details.showpath") }} </span>:
          </div>
          <div class="infoline-info">
            <input type="checkbox" id="realtime" v-model="state.isShowPath" />
          </div>
        </div>
      </section>

      <section v-if="units && scales && scales.length > 0">
        <h3>{{ t("scales.title") }}</h3>
        <div class="scalegrid">
          <div v-for="item in scales" :key="item.label">
            <template v-if="item?.zones && (item.name || item.label)">
              <p>
                <b v-if="item.name">
                  {{ item.name[localeComputed] ? item.name[localeComputed] : item.name.en }}
                </b>
                <b v-else>{{ item.label }}</b>
                ({{ item.unit }})
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
                  (<template v-if="zone.value">{{ t("scales.upto") }} {{ zone.value }}</template>
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
    </div>

    <button @click.prevent="closesensor" aria-label="Close sensor" class="close">
      <font-awesome-icon icon="fa-solid fa-xmark" />
    </button>
  </div>
</template>

<script setup>
import { reactive, computed, ref, watch, watchEffect, onMounted, getCurrentInstance } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import moment from "moment";
import config, { sensors } from "@config";
import measurements from "../../measurements";
import { getTypeProvider } from "../../utils/utils";
import { getAddressByPos } from "../../utils/map/utils";

import Bookmark from "./Bookmark.vue";
import Chart from "./Chart.vue";
import Copy from "./Copy.vue";
import SelectRealtime from "./SelectRealtime.vue";

// Props и emits
const props = defineProps({
  type: String,
  point: Object,
  startTime: [Number, String],
  currentProvider: String,
});
const emit = defineEmits(["close"]);

// Глобальные объекты
const store = useStore();
const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { proxy } = getCurrentInstance();
const filters = proxy.$filters;
const globalWindow = window;

// Единообразное описание локального состояния в одном реактивном объекте
const state = reactive({
  select: "",
  measurement: props.type,
  isShowPath: false,
  start: moment().format("YYYY-MM-DD"),
  maxDate: moment().format("YYYY-MM-DD"),
  provider: route.params.provider,
  rttime: null,
  rtdata: [],
  sharedDefault: false,
  sharedLink: false,
  isLoad: false,
});

// Вычисляемые свойства
const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");

const geo = computed(() => {
  if (props.point?.geo && props.point.geo.lat && props.point.geo.lng) {
    return props.point.geo;
  }
  const { lat, lng } = route.params;
  return { lat: Number(lat) || 0, lng: Number(lng) || 0 };
});

const address = ref({});
const prevGeo = ref({ lat: null, lng: null });

watchEffect(() => {
  // Если в props.point есть адрес, обновляем его только если координаты изменились.
  if (props.point && props.point.address && Object.keys(props.point.address).length > 0) {
    const currentGeo = props.point.geo || {};
    if (
      !prevGeo.value.lat ||
      currentGeo.lat !== prevGeo.value.lat ||
      currentGeo.lng !== prevGeo.value.lng
    ) {
      address.value = props.point.address;
      prevGeo.value = { ...currentGeo };
    }
  } else if (geo.value.lat && geo.value.lng) {
    // Если в props.point нет адреса, а заданы геоданные, запрашиваем адрес
    if (
      !prevGeo.value.lat ||
      geo.value.lat !== prevGeo.value.lat ||
      geo.value.lng !== prevGeo.value.lng
    ) {
      getAddressByPos(geo.value.lat, geo.value.lng, locale.value)
        .then((res) => {
          address.value = res;
        })
        .catch((err) => {
          console.error(err);
        });
      prevGeo.value = { ...geo.value };
    }
  } else {
    address.value = {};
  }
});

// Если спустя 5 секунд address всё ещё пустой, подставляем координаты.
setTimeout(() => {
  if (!address.value || Object.keys(address.value).length === 0) {
    // Задаем объект с координатами (например, country пустой, а address — строка с lat, lng)
    address.value = {
      country: "Unrecognised address",
      address: [`${geo.value.lat}, ${geo.value.lng}`],
    };
  }
}, 5000);

const sensor_id = computed(() => {
  return props.point?.sensor_id || route.params.sensor || null;
});

const donated_by = computed(() => props.point?.donated_by || null);
// Гарантируем, что log всегда массив
const log = computed(() => (Array.isArray(props.point?.log) ? props.point.log : []));
const model = computed(() => props.point?.model || null);
const sender = computed(() => props.point?.sender || null);

const realtime = computed(() => state.provider === "realtime");

const addressformatted = computed(() => {
  let buffer = "";
  if (address.value && Object.keys(address.value).length > 0) {
    if (address.value.country) {
      buffer += address.value.country;
    }
    if (Array.isArray(address.value.address) && address.value.address.length > 0) {
      buffer += ", " + address.value.address.join(", ");
    }
  }
  return buffer;
});

const isRussia = computed(() => {
  return address.value?.country === "Россия" || address.value?.country === "Russia";
});

const last = computed(() => (log.value.length > 0 ? log.value[log.value.length - 1] : {}));
const date = computed(() =>
  last.value.timestamp ? moment(last.value.timestamp, "X").format("DD.MM.YYYY HH:mm:ss") : ""
);

const startTimestamp = computed(() => {
  return Number(moment(state.start + " 00:00:00", "YYYY-MM-DD HH:mm:ss").format("X"));
});

const endTimestamp = computed(() => {
  return Number(moment(state.start + " 23:59:59", "YYYY-MM-DD HH:mm:ss").format("X"));
});

const units = computed(() => {
  const measures = [];
  log.value.forEach((item) => {
    if (item.data) {
      Object.keys(item.data).forEach((unit) => {
        measures.push(unit.toLowerCase());
      });
    }
  });
  return [...new Set(measures)];
});

const scales = computed(() => {
  const buffer = [];
  Object.keys(measurements).forEach((key) => {
    if (units.value.some((unit) => unit === key)) {
      buffer.push(measurements[key]);
    }
  });
  return buffer;
});

const linkSensor = computed(() => {
  if (geo.value?.lat && geo.value?.lng && sensor_id.value) {
    const resolved = router.resolve({
      name: "main",
      params: {
        provider: getTypeProvider(),
        type: route.params.type || "pm10",
        zoom: route.params.zoom || config.MAP.zoom,
        lat: geo.value.lat,
        lng: geo.value.lng,
        sensor: sensor_id.value,
      },
    });
    return new URL(resolved.href, window.location.origin).href;
  }
  return "";
});

const link = computed(() => {
  return sensors[sensor_id.value] ? sensors[sensor_id.value].link : "";
});

const icon = computed(() => {
  return sensors[sensor_id.value] ? sensors[sensor_id.value].icon : "";
});

const chartReady = computed(() => {
  // График готов, если объект point не пустой и загрузка завершена
  return !state.isLoad && props.point && Object.keys(props.point).length > 0;
});

const shareData = () => {
  if (navigator.share) {
    navigator.share({
      title: config.TITLE,
      url: linkSensor.value || link.value,
    });
  }
};

const shareLink = () => {
  navigator.clipboard
    .writeText(linkSensor.value)
    .then(() => {
      state.sharedLink = true;
      setTimeout(() => {
        state.sharedLink = false;
      }, 5000);
    })
    .catch((e) => console.log("not copied", e));
};

function getHistory() {
  if (realtime.value) return;
  state.isLoad = true;
  emit("history", {
    sensor_id: sensor_id.value,
    start: startTimestamp.value,
    end: endTimestamp.value,
  });
}

function updatert() {
  if (realtime.value && log.value.length > 0) {
    const ts = last.value.timestamp * 1000;
    if (ts) {
      state.rttime = new Date(ts).toLocaleString();
    }
    const data = last.value.data;
    const buffer = {};
    console.log(data, " => just data");
    if (data) {
      state.rtdata = [];
      Object.keys(measurements).forEach((item) => {
        Object.keys(data).forEach((datakey) => {
          if (item === datakey) {
            buffer.key = datakey;
            buffer.measure = data[datakey];
            buffer.label = measurements[item].label;
            buffer.unit = measurements[item].unit;
            if (
              measurements[item].zones &&
              measurements[item].zones.find((i) => buffer.measure < i.value)
            ) {
              buffer.color = measurements[item].zones.find((i) => buffer.measure < i.value).color;
            }
            if (!buffer.color && measurements[item].zones) {
              const zones = measurements[item].zones;
              if (buffer.measure > zones[zones.length - 2].value) {
                buffer.color = zones[zones.length - 1].color;
              }
            }
            state.rtdata.push(buffer);
            console.log(state.rtdata, " => data after");
          }
        });
      });
    }
  }
}

function closesensor() {
  const urlStr = window.location.href;
  if (urlStr.includes(sensor_id.value)) {
    const u = urlStr.replace(sensor_id.value, "");
    window.location.href = u;
  }
  emit("close");
}

watch(
  () => sensor_id.value,
  () => {
    state.isShowPath = false;
  }
);
watch(
  () => state.start,
  () => {
    getHistory();
  }
);
watch(log, () => {
  updatert();
  state.isLoad = false;
});

watch(
  () => props.point,
  (newPoint) => {
    // Only update URL if a valid point with a sensor_id is present
    if (newPoint && newPoint.sensor_id && newPoint.geo) {
      router.replace({
        name: route.name, // Assumes your route name remains the same
        params: {
          provider: state.provider,
          type: props.type.toLowerCase(),
          zoom: route.params.zoom || config.MAP.zoom, // trying to keep zoom
          lat: newPoint.geo.lat,
          lng: newPoint.geo.lng,
          sensor: newPoint.sensor_id,
        },
      });
    }
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  state.start = props.startTime
    ? moment.unix(props.startTime).format("YYYY-MM-DD")
    : moment().format("YYYY-MM-DD");
  updatert();

  console.log(state.rtdata, " => data before");
});
</script>

<style scoped>
.popup-js.active {
  container: popup / inline-size;
  background: var(--app-popoverbg);
  border-radius: 0;
  bottom: 0;
  box-sizing: border-box;
  color: var(--app-textcolor);
  padding: var(--gap);
  position: absolute;
  right: 0;
  top: 0;
  width: 80vw;
  max-width: 1000px;
  z-index: 100;
}

.scrollable-y {
  max-height: 90%;
}

.close {
  border: 0;
  color: var(--app-textcolor);
  cursor: pointer;
  font-size: 1.2em;
  position: absolute;
  right: var(--gap);
  top: var(--gap);
}

.close:hover {
  color: var(--color-red);
}

.flexline {
  gap: calc(var(--gap) * 2);
}

.flexline .flexline {
  gap: var(--gap);
}

h3.flexline {
  gap: calc(var(--gap) * 0.5);
  max-width: calc(100% - var(--gap) * 2);
}

.icontitle {
  display: inline-block;
  max-height: calc(var(--font-size) * 2);
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
    width: 100vw;
    top: 30vw;
    padding-right: calc(var(--gap) * 0.5);
  }
}

@container popup (min-width: 400px) {
  .close {
    font-size: 1.6em;
  }
}

@container popup (max-width: 400px) {
  h3.flexline {
    max-width: calc(100% - var(--gap) * 3);
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

.shared-container span {
  display: block;
  width: 20px;
  height: 20px;
}

.shared-container span svg {
  fill: var(--color-light);
}

@media screen and (max-width: 570px) {
  .shared-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .shared-container button:first-of-type {
    margin-right: 0;
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
.rt-title {
  font-weight: 900;
}
.rt-title::before {
  animation: blink infinite 1.5s;
  background-color: var(--color-green);
  border-radius: 50%;
  content: "";
  display: inline-block;
  height: 8px;
  margin-right: 5px;
  vertical-align: middle;
  width: 8px;
}
.rt-time {
  font-size: 0.8em;
  font-weight: 300;
}
.rt-unit,
.rt-number {
  font-size: 0.8em;
  font-weight: 900;
}
/* - realtime */
</style>
