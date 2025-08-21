<template>
  <div class="popup-js active">
    <section>
      <h3 class="sensor-title clipoverflow">
        
        <Icon :sensorID="sensor_id" />

        <span v-if="addressformatted && addressformatted !==''">{{ addressformatted }}</span>
        <span v-else class="skeleton-text"></span>
      </h3>
    </section>

    <div class="scrollable-y">
      <section class="flexline-mobile-column">

        <div class="flexline mb">
          <!-- тут нужна проверка, что между крайними показаниями не меньше часа-->
          <div class="aqi" v-if="latestAQI && state.provider !== 'realtime'" :style="{backgroundColor: latestAQI.Final_Color}">
            <div class="aqi-badge">
              <div class="aqi-box">
                <span class="aqi-value"> {{ latestAQI.Final_AQI }}</span>
              </div>
              <div class="aqi-text">
                <div class="aqi-subtext">AQI (US EPA)</div>
                <div v-if="latestAQI.Final_Label" class="aqi-label">
                  {{ $t(latestAQI.Final_Label) }}
                </div>
              </div>
            </div>
          </div>

          <ProviderType />

          <div v-if="state.provider !== 'realtime'">
            <input type="date" v-model="state.start" :max="state.maxDate" onchange="this.blur()" />
          </div>

          <div v-else>
            <div v-if="state.rttime" class="rt-time">{{ state.rttime }}</div>
          </div>
        </div>

        <div v-if="state.provider === 'realtime'" class="flexline">
          <template v-if="state.rtdata && state.rtdata.length">
            <div v-for="item in state.rtdata" :key="item.key">
              <div class="rt-unit">{{ item.label }}</div>
              <div class="rt-number" :style="item.color ? 'color:' + item.color : ''">
                {{ item.measure }} {{ item.unit }}
              </div>
            </div>
          </template>
        </div>
      </section>

      <section>
        <Chart v-show="state.chartReady" :log="log" :unit="measurements[props.type]?.unit" />
        <div v-show="!state.chartReady" class="chart-skeleton"></div>
      </section>

      <section class="flexline space-between">
        <div class="flexline">
          <Bookmark
            v-if="sensor_id"
            :id="sensor_id"
            :address="state.address?.address && state.address?.address.join(', ')"
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

      <AltruistPromo />

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
              :href="getMapLink(geo.lat, geo.lng, `Air Sensor: ${sensor_id}` )"
              target="_blank"
            >{{ geo.lat }}, {{ geo.lng }}</a>
          </div>
        </div>

        <div class="infoline flexline" v-if="dewPoint">
          <div class="infoline-title">{{ $t("Latest dew point") }}:</div>
          <div class="infoline-info">{{ dewPoint }} ℃</div>
          
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

      <ReleaseInfo />
    </div>

    <button @click.prevent="closesensor" aria-label="Close sensor" class="close">
      <font-awesome-icon icon="fa-solid fa-xmark" />
    </button>
  </div>
</template>

<script setup>
import { reactive, computed, ref, watch, watchEffect, onMounted, getCurrentInstance, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import moment from "moment";
import config, { sensors } from "@config";
import measurements from "../../measurements";
import { getTypeProvider } from "../../utils/utils";
import { getAddressByPos } from "../../utils/map/utils";
import { getTodayAQI, getRealtimeAQI } from '../../utils/aqi.js';

import Bookmark from "./Bookmark.vue";
import Chart from "./Chart.vue";
import Copy from "./Copy.vue";
import ProviderType from "../ProviderType.vue";
import AltruistPromo from "../devices/altruist/AltruistPromo.vue";
import ReleaseInfo from "../ReleaseInfo.vue";
import Icon from "./Icon.vue";

// Props и emits
const props = defineProps({
  type: String,
  point: Object,
  startTime: [Number, String],
});
const emit = defineEmits(["history", "close"]);

// Глобальные объекты
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
  provider: getTypeProvider(route.query),
  rttime: null,
  rtdata: [],
  sharedDefault: false,
  sharedLink: false,
  chartEverLoaded: false,
  chartReady: false,
  lastCoords: { lat: null, lon: null },
  address: ""
});


// some refs
// const prevGeo = ref({ lat: null, lng: null });
const units = ref([]);
const dewPoint = ref(null)
const latestAQI = ref(null)
const previousAQI = ref(null);

let AQIInterval;

// computed
const sensor_id = computed(() => {
  return props.point?.sensor_id || route.query.sensor || null;
});

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");

const geo = computed(() => {
  if (props.point?.geo && props.point.geo.lat && props.point.geo.lng) {
    return props.point.geo;
  }
  const { lat, lng } = route.query;
  return { lat: Number(lat) || 0, lng: Number(lng) || 0 };
});

const donated_by = computed(() => props.point?.donated_by || null);

// Гарантируем, что log всегда массив
const log = computed(() => (Array.isArray(props.point?.log) ? props.point.log : []));
const model = computed(() => props.point?.model || null);
const sender = computed(() => props.point?.sender || null);

const addressformatted = computed(() => {
  let buffer = "";
  if (state.address && (state.address.length > 0 || Object.keys(state.address).length > 0)) {
    if (state.address.country) {
      buffer += state.address.country;
    }
    if (Array.isArray(state.address.address) && state.address.address.length > 0) {
      buffer += ", " + state.address.address.join(", ");
    }
  }
  return buffer;
});

const isRussia = computed(() => {
  return state.address?.country === "Россия" || state.address?.country === "Russia";
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

const linkSensor = computed(() => {
  if (geo.value?.lat && geo.value?.lng && sensor_id.value) {
    const resolved = router.resolve({
      name: "main",
      query: {
        provider: state.provider,
        type: route.query.type || config.MAP.measure,
        zoom: route.query.zoom || config.MAP.zoom,
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

// checking log values for dew point
const latestValidLog = computed(() => {
  return [...log.value] // clone array to avoid mutating original
    .reverse()
    .find(entry => {
      const data = entry?.data;
      return typeof data?.temperature === 'number' && typeof data?.humidity === 'number';
    });
});

// methods

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
    .catch((e) => console.error("Sensor's link not copied", e));
};

const getHistory = () => {
  if (state.provider === "realtime") return;

  state.chartReady = false;

  emit("history", {
    sensor_id: sensor_id.value,
    start: startTimestamp.value,
    end: endTimestamp.value,
  });
}

const calculateDewPoint = (t, h) => {
  if (typeof t !== 'number' || typeof h !== 'number' || h <= 0 || h > 100) {
    return null;
  }

  const a = 17.27;
  const b = 237.7;
  const gamma = (a * t) / (b + t) + Math.log(h / 100);
  const dewPoint = (b * gamma) / (a - gamma);

  return parseFloat(dewPoint.toFixed(2));

}

// Updates the realtime view: refreshes the timestamp and rebuilds state.rtdata with the latest measurements, labels, units, and zone colors.
const updatert = () => {
  if (state.provider === "realtime" && log.value.length > 0) {
    const ts = last.value.timestamp * 1000;
    if (ts) {
      state.rttime = new Date(ts).toLocaleString();
    }
    const data = last.value.data;
    if (data) {
      state.rtdata = [];
      Object.keys(measurements).forEach((item) => {
        Object.keys(data).forEach((datakey) => {
          if (item === datakey) {
            const buffer = {
              key: datakey,
              measure: data[datakey],
              label: measurements[item].nameshort[localeComputed.value] || measurements[item].label,
              unit: measurements[item].unit,
              color: undefined,
            };
            const zones = measurements[item].zones;
            if (zones) {
              const matchedZone = zones.find((i) => buffer.measure < i.value);
              if (matchedZone) {
                buffer.color = matchedZone.color;
              } else if (buffer.measure > zones[zones.length - 2].value) {
                buffer.color = zones[zones.length - 1].color;
              }
            }
            state.rtdata.push(buffer);
          }
        });
      });
    }
  }
}

const closesensor = () => {
  router.replace({
    name: route.name,
    query: {
      provider: route.query.provider,
      type: route.query.type,
      zoom: route.query.zoom,
      lat: route.query.lat,
      lng: route.query.lng,
    },
  });
  emit("close");
};

const setAddressUnrecognised = (lat, lng) => {
  state.address = {
    country: "Unrecognised address",
    address: [`${lat}, ${lng}`]
  };
}

const updateAQI = () => {
  const newAQI = getRealtimeAQI(log.value);
  previousAQI.value = newAQI.Final_AQI;
  latestAQI.value = newAQI;
};

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

  // Если спустя 5 секунд address всё ещё пустой, подставляем координаты.
  setTimeout(() => {
    if (!state.address || Object.keys(state.address).length === 0) {
      state.address = {
        country: "Unrecognised address",
        address: [`${geo.value.lat}, ${geo.value.lng}`],
      };
    }
  }, 5000);

  state.start = props.startTime
    ? moment.unix(props.startTime).format("YYYY-MM-DD")
    : moment().format("YYYY-MM-DD");

  updatert();

});

onUnmounted(() => {
  if(AQIInterval) {
    clearInterval(AQIInterval);
  }
});

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


watch(() => log.value, (i) => {
    if(Array.isArray(i) && i.length > 0) {

      if(state.provider === 'realtime') {
        const aqiRealtimeResult = getRealtimeAQI(log.value);
        latestAQI.value = aqiRealtimeResult
        if(!AQIInterval) {
          previousAQI.value = latestAQI.value.Final_AQI;
          AQIInterval = setInterval(updateAQI, 60000);
        }
       } else {
        const aqiTodayResult = getTodayAQI(log.value);
        latestAQI.value = aqiTodayResult
      }

      log.value.forEach(entry => {
        if (
          entry?.data &&
          typeof entry.data.temperature === 'number' &&
          typeof entry.data.humidity === 'number'
        ) {
          const dew = calculateDewPoint(entry.data.temperature, entry.data.humidity);
          entry.data = {
            ...entry.data,
            ['dewpoint']: dew,
          };
        }
      });

      // EN: Checks if log is ready to show Chart
      updatert();

      if (!state.chartReady) {
        state.chartReady = true;
      }

      // EN: Checks if units set is changed (to show scales)
      const unitsSet = new Set();
      i.forEach((item) => {
        if (item.data)
          Object.keys(item.data).forEach((u) => unitsSet.add(u.toLowerCase()))
      });
      const newUnits = Array.from(unitsSet).sort();
      const oldUnits = units.value;
      const changed = newUnits.length !== oldUnits.length || newUnits.some((u, i) => u !== oldUnits[i]);
      if (changed) units.value = newUnits

      if (latestValidLog.value) {
        const { temperature, humidity } = latestValidLog.value.data;
        dewPoint.value = calculateDewPoint(temperature, humidity);
      } else {
        console.warn('No valid log entry for dew point was found');
      }

    }
  },
  { immediate: true }
);

// EN: Change URL for valid point if sensor_id is present and geo is okay
watch(
  () => props.point,
  (newPoint) => {
    if (newPoint && newPoint.sensor_id && newPoint.geo) {
      router.replace({
        name: route.name, // Assumes the route name remains the same
        query: {
          provider: state.provider,
          type: props.type.toLowerCase(),
          zoom: route.query.zoom || config.MAP.zoom, // trying to keep zoom
          lat: newPoint.geo.lat,
          lng: newPoint.geo.lng,
          sensor: newPoint.sensor_id,
        },
      });
    }
  },
  { immediate: true, deep: true }
);

// EN: Change the address text if geo is changed
watch(
  () => geo.value,
  async (newGeo) => {
    // 1) Use address from props.point if available
    if (props.point?.address && Object.keys(props.point.address).length > 0) {
      state.address = props.point.address;
      state.lastCoords.lat = newGeo.lat;
      state.lastCoords.lon = newGeo.lng;
      return;
    }

    // 2) If valid coordinates are provided
    if (newGeo.lat && newGeo.lng) {
      // Only proceed if coordinates have actually changed
      if (
        newGeo.lat !== state.lastCoords.lat ||
        newGeo.lng !== state.lastCoords.lon
      ) {
        // Update last known coordinates
        state.lastCoords.lat = newGeo.lat;
        state.lastCoords.lon = newGeo.lng;

        try {
          // Attempt reverse geocoding via your API helper
          const res = await getAddressByPos(
            newGeo.lat,
            newGeo.lng,
            localeComputed.value
          );
          // Assign result if valid, otherwise use fallback
          if (res && Object.keys(res).length > 0) {
            state.address = res;
          } else {
            setAddressUnrecognised(newGeo.lat, newGeo.lng);
          }
        } catch (err) {
          console.error("Reverse geocoding error:", err);
          setAddressUnrecognised(newGeo.lat, newGeo.lng);
        }
      }
    } else {
      // No coordinates provided – set fallback with empty values
      setAddressUnrecognised(newGeo.lat || "", newGeo.lng || "");
    }
  },
  { immediate: true, deep: true });

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

@media screen  and (max-width: 9600px) {
  .flexline-mobile-column .flexline {
    flex-wrap: wrap;
    align-items: flex-start;
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

  /* .close {
    top: -35px;
    right: 10px;
    background-color: #fff;
    width: 40px;
    height: 40px;
  } */

  .flexline-mobile-column {
    flex-direction: column;
    align-items: flex-start;
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
    /* flex-direction: column; */
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

.rt-number {
  color: var(--color-blue);
}

/* AQI */

.flexline.mb {
  margin-bottom: var(--gap);
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

.aqi-value {
  font-size: 18px;
}

.aqi-label {
  font-size: 7px;
  font-weight: bold;
}

.aqi-subtext {
  font-size: 10px;
  font-weight: bold;
}

/* - realtime */

.sensor-title {
  display: flex;
  gap: var(--gap);
  align-items: center;
}

.sensor-title span {
  font-size: inherit;
}
</style>
