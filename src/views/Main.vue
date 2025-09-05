<template>
  <MetaInfo
    :pageTitle= "settings.TITLE"
    :pageDescription = "settings.DESC"
  />
  <Header />

  <MessagePopup v-if="isMessage" @close="handlerClose" :data="state.point.measurement" />

  <SensorPopup
    v-if="isSensor"
    :type="props?.type?.toLowerCase()"
    :point="state?.point"
    @modal="handlerModal"
    @close="handlerClose"
    @history="handlerHistoryLog"
    @getScope="getScope"
    :startTime="state?.start"
  />

  <Map
    :measuretype="props.type"
    :historyready="state.canHistory"
    :historyhandler="handlerHistory"
    :isLoad="state.isLoad"
    @clickMarker="handlerClick"
    @activateMarker="handleActivePoint"
    @typeChanged="handleTypeChange"
  />
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, getCurrentInstance } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useMapStore } from "@/stores/map";
import { useBookmarksStore } from "@/stores/bookmarks";

import moment from "moment";

import Header from "../components/header/Header.vue";
import Map from "../components/Map.vue";
import MessagePopup from "../components/message/MessagePopup.vue";
import SensorPopup from "../components/sensor/SensorPopup.vue";
import MetaInfo from '../components/MetaInfo.vue';

import { settings } from "@config";
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

const mapStore = useMapStore();
const bookmarksStore = useBookmarksStore();
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
  clusterUpdateScheduled: false,
});

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");
const zoom = computed(() => mapStore.mapposition.zoom);
const lat = computed(() => mapStore.mapposition.lat);
const lng = computed(() => mapStore.mapposition.lng);


// (logs cache and preload removed)

/* + Realtime watch */
let unwatchRealtime = null;

function subscribeRealtime() {
  if (state.providerObj && !unwatchRealtime) {
    unwatchRealtime = state.providerObj.watch(handlerNewPoint);
  }
}

function unsubscribeRealtime() {
  if (state.providerObj && unwatchRealtime) {
    state.providerObj.watch(null);
    unwatchRealtime = null;
  }
}
/* - Realtime watch */

const isMessage = computed(() => {
  return state.point && state.point.measurement && state.point.measurement.message;
});

// Отображаем попап сенсора только когда в состоянии есть выбранная точка
// (URL с sensor оставляем как есть; это не влияет на видимость попапа)
const isSensor = computed(() => {
  return !!(state.point && !(state.point.measurement && state.point.measurement.message));
});


/**
 * Returns the start and end of the last month (rolling month)
 */

const getRollingMonthRange = (targetDate = new Date()) => {
  const end = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23, 59, 59, 999
  );

  let start = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth() - 1,
    targetDate.getDate(),
    0, 0, 0, 0
  );

  if (start.getMonth() === targetDate.getMonth()) {
    start = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      0, 
      0, 0, 0, 0
    );
  }

  return { start, end };
}


/**
 * Returns the start and end of the last 7 days (rolling week)
 * End = today, start = 7 days ago
 */
function getRollingWeekRange(date = new Date()) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const start = new Date(date);
  start.setDate(start.getDate() - 7 + 1);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

const removeAllActivePoints = () => {
  document.querySelectorAll('.current-active-marker').forEach(el => {
    el.classList.remove('current-active-marker');
  });
};

const handleActivePoint = (id) => {
  const el = document.querySelector(`[data-id="${id}"]`);
  removeAllActivePoints();
  if(el) {
    if(!el.classList.contains('current-active-marker')) {
      el.classList.add('current-active-marker')
    } else {
      el.classList.remove('current-active-marker')
    }
  }

}

const handlerHistory = async ({ start, end }) => {
  state.isLoad = true;
  state.start = start;
  state.end = end;
  state.status = "history";
  unsubscribeRealtime();

  handlerClose();
  markers.clear();
  state.providerObj.setStartDate(start);
  state.providerObj.setEndDate(end);
  const today = moment().format("YYYY-MM-DD");
  const startDate = moment.unix(start).format("YYYY-MM-DD");
  
  if (props.type === 'aqi') {
    // For AQI, we need to load PM2.5 and PM10 data and calculate AQI for each sensor
    try {
      // Get PM2.5 and PM10 data
      let pm25Data, pm10Data;
      if (today === startDate) {
        pm25Data = await state.providerObj.lastValuesForPeriod(start, end, 'pm25');
        pm10Data = await state.providerObj.lastValuesForPeriod(start, end, 'pm10');
      } else {
        pm25Data = await state.providerObj.maxValuesForPeriod(start, end, 'pm25');
        pm10Data = await state.providerObj.maxValuesForPeriod(start, end, 'pm10');
      }
      
      // Combine data from both measurements
      const combinedData = {};
      
      // Add PM2.5 data
      for (const sensor in pm25Data) {
        if (!combinedData[sensor]) {
          combinedData[sensor] = [];
        }
        for (const item of pm25Data[sensor]) {
          combinedData[sensor].push(item);
        }
      }
      
      // Add PM10 data
      for (const sensor in pm10Data) {
        if (!combinedData[sensor]) {
          combinedData[sensor] = [];
        }
        for (const item of pm10Data[sensor]) {
          combinedData[sensor].push(item);
        }
      }
      
      // First, show all sensors as gray points immediately
      const sensorIds = Object.keys(combinedData);
      for (const sensor of sensorIds) {
        const point = {
          sensor_id: sensor,
          geo: combinedData[sensor][0]?.geo || { lat: 0, lng: 0 },
          model: 2,
          data: {},
          logs: [] // Empty logs initially
        };
        
        // Show gray point immediately
        markers.addPoint({
          ...point,
          isEmpty: true, // Gray loading state
          value: null,
        });
      }
      
      // Then load logs and update colors as they become available
      const logsPromises = sensorIds.map(async (sensor) => {
        try {
          const logs = await state.providerObj.getHistoryPeriodBySensor(sensor, start, end);
          return { sensor, logs: logs || [] };
        } catch (error) {
          console.warn(`Failed to get logs for sensor ${sensor}:`, error);
          return { sensor, logs: [] };
        }
      });
      
      // Update points with colors as logs become available
      for (const promise of logsPromises) {
        promise.then(async ({ sensor, logs }) => {
          const point = {
            sensor_id: sensor,
            geo: combinedData[sensor][0]?.geo || { lat: 0, lng: 0 },
            model: 2,
            data: {},
            logs: logs
          };
          
          
          // Update point with calculated color
          await handlerNewPoint(point);
        }).catch(error => {
          console.warn(`Failed to process sensor ${sensor}:`, error);
        });
      }
      
      // Wait for all requests to complete
      await Promise.all(logsPromises);
    } catch (error) {
      console.error('Failed to load AQI data:', error);
    }
  } else {
    // For regular measurements, load data normally
    let sensorsData;
    if (today === startDate) {
      sensorsData = await state.providerObj.lastValuesForPeriod(start, end, props.type);
    } else {
      sensorsData = await state.providerObj.maxValuesForPeriod(start, end, props.type);
    }
    
    // Process sensor data incrementally (display points as they become available)
    const allItems = [];
    for (const sensor in sensorsData) {
      for (const item of sensorsData[sensor]) {
        allItems.push(item);
      }
    }
    
    // Start processing all items in parallel but don't wait for all to complete
    const itemPromises = allItems.map(async (item) => {
      try {
        await handlerNewPoint(item);
      } catch (error) {
        console.warn(`Failed to process item:`, error);
      }
    });
    
    // Wait for all items to be processed (but points are already being displayed)
    await Promise.all(itemPromises);
  }
  const messages = await state.providerObj.messagesForPeriod(start, end);
  const messagePromises = Object.values(messages).map(async (message) => {
    try {
      await handlerNewPoint(message);
    } catch (error) {
      console.warn(`Failed to process message:`, error);
    }
  });
  await Promise.all(messagePromises);
  state.isLoad = false;
};

const handlerNewPoint = async (point) => {

  if (!point.model || !markers.isReadyLayers()) return;

  point.data = point.data
    ? Object.fromEntries(Object.entries(point.data).map(([k, v]) => [k.toLowerCase(), v]))
    : {};


  point.isBookmarked = bookmarksStore.idbBookmarks?.some(bookmark => bookmark.id === point.sensor_id) || false;

  // First, add point as gray (loading state)
  markers.addPoint({
    ...point,
    isEmpty: true, // Always start as gray
    value: null,
  });
  
  // Then asynchronously calculate and update the color
  setTimeout(async () => {
    // Handle value calculation based on mode and type
    let isEmpty = false;
    let value = null;
    
    if ((props.type || '').toLowerCase() === 'aqi') {
      // For AQI, we need logs to calculate the index
      if (point.logs && point.logs.length > 0) {
        isEmpty = false;
        value = null; // AQI will be calculated in getColorForValue function
      } else {
        isEmpty = true;
        value = null;
      }
    } else {
      // For regular measurements
      if (state.status === "history") {
        // Daily recap mode: calculate average for the day
        if (point.logs && point.logs.length > 0) {
          const measurementType = (props.type || '').toLowerCase();
          const values = point.logs
            .map(log => log?.data?.[measurementType])
            .filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
          
          if (values.length > 0) {
            value = values.reduce((sum, v) => sum + Number(v), 0) / values.length;
            isEmpty = false;
          } else {
            isEmpty = true;
            value = null;
          }
        } else {
          // Fallback to last value if no logs
          const v = point?.data?.[(props.type || '').toLowerCase()];
          if (v !== null && v !== undefined && !isNaN(Number(v))) {
            value = Number(v);
            isEmpty = false;
          } else {
            value = null;
            isEmpty = true;
          }
        }
      } else {
        // Realtime mode: use last value if not older than 20 minutes
        const lastValue = point?.data?.[(props.type || '').toLowerCase()];
        const timestamp = point.timestamp;
        const now = Math.floor(Date.now() / 1000);
        const twentyMinutesAgo = now - (20 * 60);
        
        if (lastValue !== null && lastValue !== undefined && !isNaN(Number(lastValue)) && timestamp && timestamp > twentyMinutesAgo) {
          value = Number(lastValue);
          isEmpty = false;
        } else {
          isEmpty = true;
          value = null;
        }
      }
    }

    

    // Update point with calculated color
    markers.addPoint({
      ...point,
      isEmpty: isEmpty,
      value: value,
    });
  }, 0); // Use setTimeout to make it asynchronous
  
  // Batch cluster updates for better performance
  if (!state.clusterUpdateScheduled) {
    state.clusterUpdateScheduled = true;
    setTimeout(() => {
      markers.refreshClusters();
      state.clusterUpdateScheduled = false;
    }, 100); // Update clusters every 100ms
  }

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

const handlerNewPointWithType = async (point, measurementType) => {

  if (!point.model || !markers.isReadyLayers()) return;

  point.data = point.data
    ? Object.fromEntries(Object.entries(point.data).map(([k, v]) => [k.toLowerCase(), v]))
    : {};


  point.isBookmarked = bookmarksStore.idbBookmarks?.some(bookmark => bookmark.id === point.sensor_id) || false;

  // First, add point as gray (loading state)
  markers.addPoint({
    ...point,
    isEmpty: true, // Always start as gray
    value: null,
  });
  
  // Then asynchronously calculate and update the color
  setTimeout(async () => {
    // Handle value calculation based on mode and type
    let isEmpty = false;
    let value = null;
    const typeKey = (measurementType || '').toLowerCase();
    
    if (typeKey === 'aqi') {
      // For AQI, we need logs to calculate the index
      if (point.logs && point.logs.length > 0) {
        isEmpty = false;
        value = null; // AQI will be calculated in getColorForValue function
      } else {
        isEmpty = true;
        value = null;
      }
    } else {
      // For regular measurements
      if (state.status === "history") {
        // Daily recap mode: calculate average for the day
        if (point.logs && point.logs.length > 0) {
          const values = point.logs
            .map(log => log?.data?.[typeKey])
            .filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
          
          if (values.length > 0) {
            value = values.reduce((sum, v) => sum + Number(v), 0) / values.length;
            isEmpty = false;
          } else {
            isEmpty = true;
            value = null;
          }
        } else {
          // Fallback to last value if no logs
          const v = point?.data?.[typeKey];
          if (v !== null && v !== undefined && !isNaN(Number(v))) {
            value = Number(v);
            isEmpty = false;
          } else {
            value = null;
            isEmpty = true;
          }
        }
      } else {
        // Realtime mode: use last value if not older than 20 minutes
        const lastValue = point?.data?.[typeKey];
        const timestamp = point.timestamp;
        const now = Math.floor(Date.now() / 1000);
        const twentyMinutesAgo = now - (20 * 60);
        
        if (lastValue !== null && lastValue !== undefined && !isNaN(Number(lastValue)) && timestamp && timestamp > twentyMinutesAgo) {
          value = Number(lastValue);
          isEmpty = false;
        } else {
          isEmpty = true;
          value = null;
        }
      }
    }

    

    // Update point with calculated color
    markers.addPoint({
      ...point,
      isEmpty: isEmpty,
      value: value,
    });
  }, 0); // Use setTimeout to make it asynchronous
  
  // Batch cluster updates for better performance
  if (!state.clusterUpdateScheduled) {
    state.clusterUpdateScheduled = true;
    setTimeout(() => {
      markers.refreshClusters();
      state.clusterUpdateScheduled = false;
    }, 100); // Update clusters every 100ms
  }

  if (point.sensor_id === props.sensor) {
    await handlerClick(point);
  }

  if (state.point && state.point.sensor_id === point.sensor_id) {
    state.point.log = [...state.point.log, { data: point.data, timestamp: point.timestamp }];
  }

  if (
    Object.prototype.hasOwnProperty.call(point.data, measurementType.toLowerCase()) ||
    Object.prototype.hasOwnProperty.call(point.data, "message")
  ) {
    state.points[point.sensor_id] = point.data;
  }
};

const handlerClick = async (point) => {
  state.isLoad = true;
  state.point = [];
  let log = [];
  if (state.status === "history") {
    log = await state.providerObj.getHistoryPeriodBySensor(
      point.sensor_id,
      state.providerObj.start,
      state.providerObj.end
    );
    mapStore.mapinactive = true;
  } else {
    log = await state.providerObj.getHistoryBySensor(point.sensor_id);
  }
  document.querySelectorAll('.with-active-sensor').forEach(el => {
    el.classList.remove('with-active-sensor');
  });
  const address = await getAddressByPos(point.geo.lat, point.geo.lng, localeComputed.value);
  state.point = { ...point, address, log: [...log] };
  state.isLoad = false;

  handleActivePoint(point.sensor_id)
};

const handlerHistoryLog = async ({ sensor_id, start, end }) => {
  if (state.status === "history") {
    const log = await state.providerObj.getHistoryPeriodBySensor(sensor_id, start, end);
    state.point = { ...state.point, log: [...log] };
  }
};

/* Returns scope depending on type ('week' or 'month') */
const getScope = async (type) => {

  const range = type === "week"
    ? getRollingWeekRange(new Date())
    : getRollingMonthRange(new Date());

  const { start, end } = range;

  if (state.status === "history") {
    const log = await state.providerObj.getHistoryPeriodBySensor(state.point.sensor_id, Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000));
    state.point = { ...state.point, scopeLog: [...log] };
  }
}

const handlerClose = () => {
  mapStore.mapinactive = false;

  if (state.point) {
    markers.hidePath(state.point.sensor_id);
    handleActivePoint(state.point.sensor_id)
  }
  state.point = null;
  instanceMap().setActiveArea({
    position: "absolute",
    top: "0px",
    left: "0px",
    right: "0px",
    height: "100%",
  });
  unsubscribeRealtime();
  // Repaint markers to match the latest selected unit (from store) once popup is closed
  const u = (mapStore.currentUnit || props.type || '').toLowerCase();
  if (u) {
    handleTypeChange(u);
  }
};

const handleTypeChange = async (newType) => {
  // Update localStorage
  localStorage.setItem("currentUnit", newType);
  
  // For AQI, don't clear markers - just update their colors
  if (newType !== 'aqi') {
    markers.clear();
  }
  
  if (state.providerObj && state.providerReady) {
    if (state.status === "history") {
      if (newType === 'aqi') {
        // For AQI, we need to load PM2.5 and PM10 data and calculate AQI for each sensor
        try {
          // Get PM2.5 and PM10 data
          const pm25Data = await state.providerObj.lastValuesForPeriod(state.start, state.end, 'pm25');
          const pm10Data = await state.providerObj.lastValuesForPeriod(state.start, state.end, 'pm10');
          
          // Combine data from both measurements
          const combinedData = {};
          
          // Add PM2.5 data
          for (const sensor in pm25Data) {
            if (!combinedData[sensor]) {
              combinedData[sensor] = [];
            }
            for (const item of pm25Data[sensor]) {
              combinedData[sensor].push(item);
            }
          }
          
          // Add PM10 data
          for (const sensor in pm10Data) {
            if (!combinedData[sensor]) {
              combinedData[sensor] = [];
            }
            for (const item of pm10Data[sensor]) {
              combinedData[sensor].push(item);
            }
          }
          
          // First, show all sensors as gray points immediately
          const sensorIds = Object.keys(combinedData);
          for (const sensor of sensorIds) {
            const point = {
              sensor_id: sensor,
              geo: combinedData[sensor][0]?.geo || { lat: 0, lng: 0 },
              model: 2,
              data: {},
              logs: [] // Empty logs initially
            };
            
            // Show gray point immediately
            markers.addPoint({
              ...point,
              isEmpty: true, // Gray loading state
              value: null,
            });
          }
          
          // Then load logs and update colors as they become available
          const logsPromises = sensorIds.map(async (sensor) => {
            try {
              const logs = await state.providerObj.getHistoryPeriodBySensor(sensor, state.start, state.end);
              return { sensor, logs: logs || [] };
            } catch (error) {
              console.warn(`Failed to get logs for sensor ${sensor}:`, error);
              return { sensor, logs: [] };
            }
          });
          
          // Update points with colors as logs become available
          for (const promise of logsPromises) {
            promise.then(async ({ sensor, logs }) => {
              const point = {
                sensor_id: sensor,
                geo: combinedData[sensor][0]?.geo || { lat: 0, lng: 0 },
                model: 2,
                data: {},
                logs: logs
              };
              
              
              // Update point with calculated color
              await handlerNewPointWithType(point, newType);
            }).catch(error => {
              console.warn(`Failed to process sensor ${sensor}:`, error);
            });
          }
          
          // Wait for all requests to complete
          await Promise.all(logsPromises);
        } catch (error) {
          console.error('Failed to load AQI data:', error);
        }
      } else {
        // For regular measurements, reload all data with new type
        const sensorsData = await state.providerObj.lastValuesForPeriod(state.start, state.end, newType);
        
        for (const sensor in sensorsData) {
          for (const item of sensorsData[sensor]) {
            await handlerNewPointWithType(item, newType);
          }
        }
      }
    } else {
      // For realtime mode, we can't easily update data without time range
      // Skip updating for now - realtime data will be updated automatically
      console.warn('Realtime mode: cannot update measurement type without time range');
      return;
    }
  }
  
  // Refresh clusters to update their colors based on new measurement type
  markers.refreshClusters();
  
  // For AQI, force cluster refresh multiple times to ensure colors update
  if (newType === 'aqi') {
    setTimeout(() => {
      markers.refreshClusters();
    }, 100);
    setTimeout(() => {
      markers.refreshClusters();
    }, 300);
  }
};

const handlerCloseInfo = () => {
  state.isShowInfo = false;
  mapStore.mapinactive = false;
};

const handlerModal = (modal) => {
  if (modal === "info") {
    state.isShowInfo = true;
  }
};

// Следим за изменением типа единиц измерения и сохраняем его в localStorage
watch(
  () => props.type,
  (value) => {
    if (value) {
      localStorage.setItem("currentUnit", value);
    }
  }
);

// Keep currentUnit in sync with URL param `type`
watch(
  () => route.query.type,
  (val) => {
    let u = String(val || props.type || '').toLowerCase();
    // Force AQI → PM2.5 in realtime
    if (props.provider === 'realtime' && u === 'aqi') {
      u = 'pm25';
      router.replace({
        name: route.name,
        query: { ...route.query, type: u },
      }).catch(() => {});
    }
    if (u) { try { mapStore.setCurrentUnit(u); } catch {} }
  },
  { immediate: true }
);


onMounted(async () => {

  // Устанавливаем тип провайдера
  setTypeProvider(props.provider);
  
  // (preload removed)

  // Инициализируем объект провайдера
  if (props.provider === "remote") {
    state.providerObj = new providers.Remote(settings.REMOTE_PROVIDER);
    if (!(await state.providerObj.status())) {
      router.push({
        name: route.name,
        query: {
          provider: "realtime",
          type: props.type,
          zoom: route.query.zoom,
          lat: route.query.lat,
          lng: route.query.lng,
          sensor: route.query.sensor,
        },
      });
      return;
    }
  } else {
    state.providerObj = new providers.Libp2p(settings.LIBP2P);
  }

  state.providerObj.ready().then(() => {
    state.providerReady = true;
    if (props.provider === "realtime") {
      subscribeRealtime();
    }
  });

  if (props.provider === "remote") {
    const iRemote = setInterval(() => {
      if (state.providerObj && state.providerObj.connection && markers.isReadyLayers()) {
        clearInterval(iRemote);
        state.canHistory = true;
      }
    }, 1000);
  }

  // Check if AQI is selected in realtime mode and redirect to PM2.5
  if (props.type === 'aqi' && props.provider === 'realtime') {
    router.push({
      name: route.name,
      query: {
        provider: props.provider,
        type: 'pm25',
        zoom: route.query.zoom,
        lat: route.query.lat,
        lng: route.query.lng,
        sensor: route.query.sensor,
      },
    });
    return;
  }

  if (route.query.type || props.type) {
    const initU = String(route.query.type || props.type).toLowerCase();
    localStorage.setItem("currentUnit", initU);
    try { mapStore.setCurrentUnit(initU); } catch {}
  }

  if (route.query.sensor) {
    handleActivePoint(route.query.sensor);
  }

  const instance = getCurrentInstance();
  instance?.proxy?.$matomo && instance.proxy.$matomo.disableCookies();
  instance?.proxy?.$matomo && instance.proxy.$matomo.trackPageView();
});
</script>
