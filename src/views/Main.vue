<template>
  <Header />

  <MessagePopup v-if="isMessage" @close="handlerClose" :data="state.point.measurement" />

  <SensorPopup
    v-if="isSensor"
    :type="props?.type?.toLowerCase()"
    :point="state?.point"
    @modal="handlerModal"
    @close="handlerClose"
    @history="handlerHistoryLog"
    :startTime="state?.start"
  />

  <Map
    :measuretype="props.type"
    :historyready="state.canHistory"
    :historyhandler="handlerHistory"
    :isLoad="state.isLoad"
    @clickMarker="handlerClick"
  />
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, getCurrentInstance } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "@/store";
import moment from "moment";

import Header from "../components/header/Header.vue";
import Map from "../components/Map.vue";
import MessagePopup from "../components/message/MessagePopup.vue";
import SensorPopup from "../components/sensor/SensorPopup.vue";

import config from "@config";
import * as providers from "../providers";
import { instanceMap } from "../utils/map/instance";
import * as markers from "../utils/map/marker";
import { getAddressByPos } from "../utils/map/utils";
import { getTypeProvider, setTypeProvider } from "../utils/utils";
import { useI18n } from "vue-i18n";

const props = defineProps({
  provider: {
    type: String,
    default: getTypeProvider(),
  },
  type: {
    type: String,
    default: "pm10",
  },
  sensor: String,
});

const store = useStore();
const router = useRouter();
const route = useRoute();
const { locale } = useI18n();

// Локальное состояние компонента
const state = reactive({
  providerReady: false,
  point: null,
  points: {},
  status: "online",
  canHistory: false,
  isShowInfo: false,
  providerObj: null,
  geoLocationOptions: {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0,
  },
  start: null,
  end: null,
  isLoad: false,
});

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");
const zoom = computed(() => store.mapposition.zoom);
const lat = computed(() => store.mapposition.lat);
const lng = computed(() => store.mapposition.lng);

const isMessage = computed(() => {
  return state.point && state.point.measurement && state.point.measurement.message;
});

// в Main.vue определяем просто это сенсор или нет
// внутри компонента сенсора будем проверять загружены ли данные
const isSensor = computed(() => {
  return state.point
    ? !(state.point.measurement && state.point.measurement.message)
    : !!props.sensor;
});

// Следим за изменением типа единиц измерения и сохраняем его в localStorage
watch(
  () => props.type,
  (value) => {
    if (value) {
      localStorage.setItem("currentUnit", value);
    }
  }
);

// combined values for pm10 & pm 25 to get the max one
function getCombinedValue(type, data) {
  if (type.toLowerCase() === "pm10") {
    const pm10 = data?.pm10;
    const pm25 = data?.pm25;
    if (pm10 !== undefined && pm25 !== undefined) return Math.max(pm10, pm25);
    if (pm10 !== undefined) return pm10;
    if (pm25 !== undefined) return pm25;
    return null;
  }
  return data?.[type.toLowerCase()] ?? null;
}

const handlerHistory = async ({ start, end }) => {
  state.isLoad = true;
  state.start = start;
  state.end = end;
  state.status = "history";
  state.providerObj.watch(null);
  handlerClose();
  markers.clear();
  state.providerObj.setStartDate(start);
  state.providerObj.setEndDate(end);
  const today = moment().format("YYYY-MM-DD");
  const startDate = moment.unix(start).format("YYYY-MM-DD");
  let sensorsData;
  if (today === startDate) {
    sensorsData = await state.providerObj.lastValuesForPeriod(start, end, props.type);
  } else {
    sensorsData = await state.providerObj.maxValuesForPeriod(start, end, props.type);
  }
  for (const sensor in sensorsData) {
    for (const item of sensorsData[sensor]) {
      await handlerNewPoint(item);
    }
  }
  const messages = await state.providerObj.messagesForPeriod(start, end);
  for (const message in messages) {
    await handlerNewPoint(messages[message]);
  }
  state.isLoad = false;
};

const handlerNewPoint = async (point) => {
  if (!point.model || !markers.isReadyLayers()) return;

  point.data = point.data
    ? Object.fromEntries(Object.entries(point.data).map(([k, v]) => [k.toLowerCase(), v]))
    : {};


  point.isBookmarked = store.idbBookmarks?.some(bookmark => bookmark.id === point.sensor_id) || false;


  // Добавление маркера
  markers.addPoint({
    ...point,
    isEmpty: !point.data[props.type.toLowerCase()],
    value: getCombinedValue(props.type, point.data),
  });

  if (point.sensor_id === props.sensor) {
    await handlerClick(point);
  }

  if (state.point && state.point.sensor_id === point.sensor_id) {
    state.point.log = [...state.point.log, { data: point.data, timestamp: point.timestamp }];
  }

  if (
    Object.prototype.hasOwnProperty.call(point.data, props.type.toLowerCase()) ||
    Object.prototype.hasOwnProperty.call(point.data, "message")
  ) {
    state.points[point.sensor_id] = point.data;
  }
};

const handlerClick = async (point) => {
  state.isLoad = true;
  state.point = null;
  let log = [];
  if (state.status === "history") {
    log = await state.providerObj.getHistoryPeriodBySensor(
      point.sensor_id,
      state.providerObj.start,
      state.providerObj.end
    );
    store.mapinactive = true;
  } else {
    log = await state.providerObj.getHistoryBySensor(point.sensor_id);
  }
  const address = await getAddressByPos(point.geo.lat, point.geo.lng, localeComputed.value);
  state.point = { ...point, address, log: [...log] };
  state.isLoad = false;
};

const handlerHistoryLog = async ({ sensor_id, start, end }) => {
  if (state.status === "history") {
    const log = await state.providerObj.getHistoryPeriodBySensor(sensor_id, start, end);
    state.point = { ...state.point, log: [...log] };
  }
};

const handlerClose = () => {
  store.mapinactive = false;
  store.removeAllCurrentMeasures();
  store.removeActiveCurrentMeasure();
  if (state.point) {
    markers.hidePath(state.point.sensor_id);
  }
  state.point = null;
  instanceMap().setActiveArea({
    position: "absolute",
    top: "0px",
    left: "0px",
    right: "0px",
    height: "100%",
  });
};

const handlerCloseInfo = () => {
  state.isShowInfo = false;
  store.mapinactive = false;
};

const handlerModal = (modal) => {
  if (modal === "info") {
    state.isShowInfo = true;
  }
};

// Устанавливаем тип провайдера
setTypeProvider(props.provider);

onMounted(async () => {
  document.querySelector("#app").classList.add("map");

  // Настраиваем BroadcastChannel для получения данных о сенсорах
  const bcnewsensor = new BroadcastChannel("sensors");
  const bcclearsensors = new BroadcastChannel("sensorsremoved");
  store.sensors = [];

  bcnewsensor.onmessage = (e) => {
    if (e.data) {
      let unique = true;
      store.sensors.forEach((i) => {
        if (e.data.sensor_id === i.sensor_id) {
          unique = false;
        }
      });
      if (unique) {
        store.sensors.push(e.data);
      }
    }
  };

  bcclearsensors.onmessage = (e) => {
    if (e.data) {
      store.sensors = [];
    }
  };

  // Инициализируем объект провайдера
  if (props.provider === "remote") {
    state.providerObj = new providers.Remote(config.REMOTE_PROVIDER);
    if (!(await state.providerObj.status())) {
      router.push({
        name: route.name,
        params: {
          provider: "realtime",
          type: props.type,
          zoom: route.params.zoom,
          lat: route.params.lat,
          lng: route.params.lng,
          sensor: route.params.sensor,
        },
      });
      return;
    }
  } else {
    state.providerObj = new providers.Libp2p(config.LIBP2P);
  }

  state.providerObj.ready().then(() => {
    state.providerReady = true;
    state.providerObj.watch(handlerNewPoint);
  });

  if (props.provider === "remote") {
    const iRemote = setInterval(() => {
      if (state.providerObj && state.providerObj.connection && markers.isReadyLayers()) {
        clearInterval(iRemote);
        state.canHistory = true;
      }
    }, 1000);
  }

  if (props.type) {
    localStorage.setItem("currentUnit", props.type);
  }

  const instance = getCurrentInstance();
  instance?.proxy?.$matomo && instance.proxy.$matomo.disableCookies();
  instance?.proxy?.$matomo && instance.proxy.$matomo.trackPageView();
});
</script>
