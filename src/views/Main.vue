<template>
  <MetaInfo
    :pageTitle= "settings.TITLE"
    :pageDescription = "settings.DESC"
  />
  <Header />

  <MessagePopup v-if="isMessage" @close="handlerClose" :data="state.point.measurement" />

  <!-- TODO: @getScope временно отключен, но оставлен для будущего использования -->
  <SensorPopup
    v-if="isSensor"
    :type="mapStore.currentUnit"
    :point="state?.point"
    @close="handlerClose"
    @history="handlerHistoryLog"
    :startTime="state?.start"
  />

  <Map
    :measuretype="route.query.type"
    :historyready="state.canHistory"
    :historyhandler="handlerHistory"
    :isLoad="state.isLoad"
    @clickMarker="handlerClick"
    @activateMarker="handleActivePoint"
    @typeChanged="handleTypeChange"
  />
</template>

<script setup>
import { reactive, computed, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useMapStore } from "@/stores/map";
import { useBookmarksStore } from "@/stores/bookmarks";

import { dayISO, dayBoundsUnix } from "@/utils/date";

import Header from "../components/header/Header.vue";
import Map from "../components/Map.vue";
import MessagePopup from "../components/message/MessagePopup.vue";
import SensorPopup from "../components/sensor/SensorPopup.vue";
import MetaInfo from '../components/MetaInfo.vue';

import { settings } from "@config";
import * as providers from "../providers";
import { instanceMap } from "../utils/map/instance";
import * as markers from "../utils/map/markers";
import { getAddressByPos } from "../utils/map/utils";
import { syncMapSettings } from "../utils/utils";
import { useI18n } from "vue-i18n";

// Props убраны - используем route.query напрямую

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
  providerObj: null,
  geoLocationOptions: {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0,
  },
  start: route.query.date || mapStore.currentDate || null,
  end: null,
  isLoad: false,
  clusterUpdateScheduled: false,
  isSyncing: false, // Флаг для предотвращения циклических вызовов syncMapSettings
});

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");

// Синхронизация данных происходит в watcher'е route.query с immediate: true

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
 * TODO: временно отключено для getScope, оставить для будущего использования
 */

// const getRollingMonthRange = (targetDate = new Date()) => {
//   const end = new Date(
//     targetDate.getFullYear(),
//     targetDate.getMonth(),
//     targetDate.getDate(),
//     23, 59, 59, 999
//   );

//   let start = new Date(
//     targetDate.getFullYear(),
//     targetDate.getMonth() - 1,
//     targetDate.getDate(),
//     0, 0, 0, 0
//   );

//   if (start.getMonth() === targetDate.getMonth()) {
//     start = new Date(
//       targetDate.getFullYear(),
//       targetDate.getMonth(),
//       0, 
//       0, 0, 0, 0
//     );
//   }

//   return { start, end };
// }


/**
 * Returns the start and end of the last 7 days (rolling week)
 * End = today, start = 7 days ago
 * TODO: временно отключено для getScope, оставить для будущего использования
 */
// function getRollingWeekRange(date = new Date()) {
//   const end = new Date(date);
//   end.setHours(23, 59, 59, 999);

//   const start = new Date(date);
//   start.setDate(start.getDate() - 7 + 1);
//   start.setHours(0, 0, 0, 0);

//   return { start, end };
// }

// Управление активными маркерами теперь в marker.js
const handleActivePoint = (id) => {
  markers.toggleActiveMarker(id);
}

// Переменная для отмены текущих запросов
let currentRequestId = null;

const handlerHistory = async ({ start, end }) => {
  
  // Отменяем предыдущий запрос если он еще выполняется
  currentRequestId = Math.random().toString(36);
  const requestId = currentRequestId;
  
  state.isLoad = true;
  state.start = start;
  state.end = end;
  state.status = "history";
  unsubscribeRealtime();

  // Не закрываем попап при смене даты - оставляем его активным
  // handlerClose();
  
  // Преобразуем timestamp в дату для кеша (используем локальную дату)
  const startDate = new Date(start * 1000);
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  const startDateString = `${year}-${month}-${day}`;
  
  
  // Очищаем сенсоры чтобы показать 0 во время загрузки
  mapStore.clearSensors();
  
  // Полностью очищаем все маркеры
  markers.clearAllMarkers();
  state.providerObj.setStartDate(start);
  state.providerObj.setEndDate(end);
  
  // Сначала получаем список всех сенсоров с последними данными
  try {
    const allSensorData = await state.providerObj.getHistoryPeriod(start, end);
    
    // Проверяем, не был ли запрос отменен
    if (currentRequestId !== requestId) {
      return;
    }
    
    if (allSensorData && typeof allSensorData === 'object') {
      const sensorsFromAPI = [];
      const sensorIds = Object.keys(allSensorData);
      
      
      // Сначала обновляем mapStore.sensors для показа счетчика и селекта единиц измерения
      const initialSensors = sensorIds.map(sensorId => {
        const lastData = allSensorData[sensorId];
        if (lastData && lastData.length > 0) {
          const lastLog = lastData[lastData.length - 1];
          return {
            sensor_id: sensorId,
            geo: lastLog.geo || { lat: 0, lng: 0 },
            model: lastLog.model || 2,
            data: {
              ...lastLog.data,
              aqi: null // AQI будет рассчитан позже при получении полных логов
            },
            logs: [] // Пока пустые логи
          };
        }
        return null;
      }).filter(Boolean);
      
      // Проверяем, не был ли запрос отменен
      if (currentRequestId !== requestId) {
        return;
      }
      
      // Обновляем mapStore.sensors сразу для показа счетчика
      mapStore.setSensors(initialSensors);
      
      // Обрабатываем данные в зависимости от выбранной единицы измерения
      let fullSensorData;
      
        // Для не-AQI измерений используем данные из общего запроса
        fullSensorData = sensorIds.map(sensorId => {
          const sensorLogs = allSensorData[sensorId];
          if (sensorLogs && sensorLogs.length > 0) {
            // Берем последнюю запись как основную информацию о сенсоре
            const lastLog = sensorLogs[sensorLogs.length - 1];
            
            return {
              sensor_id: sensorId,
              geo: lastLog.geo || { lat: 0, lng: 0 },
              model: lastLog.model || 2,
              data: {
                ...lastLog.data,
                aqi: null // AQI не нужен для не-AQI измерений
              },
              log: sensorLogs, // Полные логи
              logs: sensorLogs // Дублируем для совместимости
            };
          }
          return null;
        });
      
      // Проверяем, не был ли запрос отменен
      if (currentRequestId !== requestId) {
        return;
      }
      
      const validSensors = fullSensorData.filter(Boolean);
      
      // Обновляем mapStore.sensors с полными данными
      mapStore.setSensors(validSensors);
      
      // Проверяем, не был ли запрос отменен перед добавлением точек
      if (currentRequestId !== requestId) {
        return;
      }
      
      markers.refreshClusters();
      
    }
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    
    // Fallback: очищаем сенсоры если запрос не удался
    mapStore.clearSensors();
  }
  
  // Load messages if needed (this might still make API calls, but it's for messages, not sensor data)
  try {
    const messages = await state.providerObj.messagesForPeriod(start, end);
    const messagePromises = Object.values(messages).map(async (message) => {
      try {
        // Only process messages that have logs for AQI calculation
        if (message.logs && message.logs.length > 0) {
          await handlerNewPoint(message);
        }
      } catch (error) {
        console.warn(`Failed to process message:`, error);
      }
    });
    await Promise.all(messagePromises);
  } catch (error) {
    console.warn('Failed to load messages:', error);
  }
  
  // Принудительно обновляем кластеры с новыми цветами после загрузки
  setTimeout(() => {
    markers.refreshClusters();
  }, 100);
  
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
  }, mapStore.currentUnit);
  
  // Force immediate refresh to show gray markers
  markers.refreshClusters();
  
  // Then asynchronously calculate and update the color
  setTimeout(async () => {
    // Handle value calculation based on mode and type
    let isEmpty = false;
    let value = null;
   
    
      if (state.status === "history") {
        // Daily recap mode: calculate average for the day
        if (point.logs && point.logs.length > 0) {
          const measurementType = (route.query.type || '').toLowerCase();
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
          const v = point?.data?.[(route.query.type || '').toLowerCase()];
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
        const lastValue = point?.data?.[(route.query.type || '').toLowerCase()];
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
    
    

    // Update point with calculated color
    markers.addPoint({
      ...point,
      isEmpty: isEmpty,
      value: value,
    }, mapStore.currentUnit);
  }, 0); // Use setTimeout to make it asynchronous
  
  // Batch cluster updates for better performance
  if (!state.clusterUpdateScheduled) {
    state.clusterUpdateScheduled = true;
    setTimeout(() => {
      markers.refreshClusters();
      state.clusterUpdateScheduled = false;
    }, 100); // Update clusters every 100ms
  }

  if (point.sensor_id === route.query.sensor) {
    await handlerClick(point);
  }

  if (state.point && state.point.sensor_id === point.sensor_id) {
    state.point.logs = [...state.point.logs, { data: point.data, timestamp: point.timestamp }];
  }

  if (
    Object.prototype.hasOwnProperty.call(point.data, (route.query.type || '').toLowerCase()) ||
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
    }, mapStore.currentUnit);
  }, 0); // Use setTimeout to make it asynchronous
  
  // Batch cluster updates for better performance
  if (!state.clusterUpdateScheduled) {
    state.clusterUpdateScheduled = true;
    setTimeout(() => {
      markers.refreshClusters();
      state.clusterUpdateScheduled = false;
    }, 100); // Update clusters every 100ms
  }

  if (point.sensor_id === route.query.sensor) {
    await handlerClick(point);
  }

  if (state.point && state.point.sensor_id === point.sensor_id) {
    state.point.logs = [...state.point.logs, { data: point.data, timestamp: point.timestamp }];
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
  
  // Get logs from API for current date
  let log = [];
  try {
    // Always use current date range to get data for specific date
    const startTimestamp = dayBoundsUnix(mapStore.currentDate).start;
    const endTimestamp = dayBoundsUnix(mapStore.currentDate).end;
    
    log = await state.providerObj.getHistoryPeriodBySensor(
      point.sensor_id,
      startTimestamp,
      endTimestamp
    );
    
    if (state.status === "history") {
      mapStore.mapinactive = true;
    }
  } catch (error) {
    console.error('Error fetching sensor history:', error);
  }
  
  const address = await getAddressByPos(point.geo.lat, point.geo.lng, localeComputed.value);
  state.point = { ...point, address, logs: [...log] };
  state.isLoad = false;

  handleActivePoint(point.sensor_id)
};

const handlerHistoryLog = async ({ sensor_id, start, end }) => {
  // Get fresh logs from API for the new date range
  let log = [];
  try {
    log = await state.providerObj.getHistoryPeriodBySensor(sensor_id, start, end);
  } catch (error) {
    // Silently handle error - log will remain empty
  }
  
  if (state.point && state.point.sensor_id === sensor_id) {
    state.point = { ...state.point, logs: [...log] };
  }
};

/* Returns scope depending on type ('week' or 'month') */
// TODO: временно отключено, оставить для будущего использования
// const getScope = async (type) => {

//   const range = type === "week"
//     ? getRollingWeekRange(new Date())
//     : getRollingMonthRange(new Date());

//   const { start, end } = range;

//   if (state.status === "history") {
//     // Use existing logs from mapStore.sensors - no API calls needed
//     const sensorData = mapStore.sensors.find(s => s.sensor_id === state.point.sensor_id);
//     if (sensorData && sensorData.logs) {
//       state.point = { ...state.point, scopeLog: [...sensorData.logs] };
//     }
//   }
// }

const handlerClose = () => {
  mapStore.mapinactive = false;

  // Здесь был markers.hidePath(state.point.sensor_id), но в связи с тем, что он ни разу не использовался, я пока удалила
  state.point = null;
  instanceMap().setActiveArea({
    position: "absolute",
    top: "0px",
    left: "0px",
    right: "0px",
    height: "100%",
  });
  unsubscribeRealtime();
  // Don't repaint markers when closing - they should stay as they are
};

const handleTypeChange = async (newType) => {
  // Update localStorage
  localStorage.setItem("currentUnit", newType);
  
  markers.clearAllMarkers();
  
  // Use data from mapStore.sensors - no API calls needed
  const sensorData = mapStore.sensors || [];
  
  // Only process if sensors are loaded
  if (mapStore.sensorsLoaded && sensorData.length > 0) {
    // Process each sensor with existing data
    for (const sensor of sensorData) {
      if (!sensor.sensor_id) continue;
      
      // Create point with existing data
      const point = {
        sensor_id: sensor.sensor_id,
        geo: sensor.geo || { lat: 0, lng: 0 },
        model: 2,
        data: sensor.data || {},
        logs: sensor.logs || []
      };
      
      // Update point with new type
      await handlerNewPointWithType(point, newType);
    }
  }
  
  // Refresh clusters to update their colors based on new measurement type
  markers.refreshClusters();
};


// Синхронизируем настройки карты при изменении URL
watch(
  () => route.query,
  (newQuery, oldQuery) => {
    // Проверяем, что query действительно изменился
    if (JSON.stringify(newQuery) !== JSON.stringify(oldQuery)) {
      if (!state.isSyncing) {
        state.isSyncing = true;
        syncMapSettings(route, router, mapStore);
        state.isSyncing = false;
      }
    }
  },
  { immediate: true }
);

// Watch for currentDate changes and reload data
// Временно отключено для отладки
// watch(
//   () => mapStore.currentDate,
//   (newDate) => {
//     if (newDate) {
//       // Clear existing markers and show gray loading state
//       markers.clearAllMarkers();
//       
//       // Синхронизируем URL при изменении даты
//       if (!state.isSyncing) {
//         state.isSyncing = true;
//         syncMapSettings(route, router, mapStore);
//         state.isSyncing = false;
//       }
//       
//       // Reload data when date changes
//       const startDate = new Date(newDate);
//       const endDate = new Date(startDate);
//       endDate.setDate(endDate.getDate() + 1);
//       
//       const start = Math.floor(startDate.getTime() / 1000);
//       const end = Math.floor(endDate.getTime() / 1000);
//       
//       handlerHistory({ start, end });
//     }
//   }
// );

// Watch for currentUnit changes and refresh markers
watch(
  () => mapStore.currentUnit,
  (newUnit) => {
    if (newUnit) {
      markers.refreshClusters();
      // URL синхронизируется автоматически через route.query watcher
    }
  }
);

// Watch for provider changes and reinitialize
watch(
  () => mapStore.currentProvider,
  async (newProvider) => {
    if (newProvider) {
      // Отписываемся от старого провайдера, если он есть
      if (state.providerObj) {
        unsubscribeRealtime();
      }
      
      // Инициализируем новый провайдер
      if (newProvider === "remote") {
        state.providerObj = new providers.Remote(settings.REMOTE_PROVIDER);
        if (!(await state.providerObj.status())) {
          mapStore.setCurrentProvider("realtime");
          // URL синхронизируется автоматически через route.query watcher
          return;
        }
      } else {
        state.providerObj = new providers.Libp2p(settings.LIBP2P);
      }
      
      state.providerObj.ready().then(() => {
        state.providerReady = true;
        if (newProvider === "realtime") {
          subscribeRealtime();
        }
      });
    }
  },
  { immediate: true }
);

// Watch for sensors data and show markers
watch(
  [() => mapStore.sensors, () => mapStore.currentUnit],
  ([sensors, currentUnit]) => {
    if (sensors && sensors.length > 0 && currentUnit) {
      markers.clearAllMarkers();
      for (const sensor of sensors) {
        if (!sensor.sensor_id) continue;
        const point = {
          sensor_id: sensor.sensor_id,
          geo: sensor.geo || { lat: 0, lng: 0 },
          model: 2,
          data: sensor.data || {},
          logs: sensor.logs || []
        };
        handlerNewPointWithType(point, currentUnit);
      }
    }
  }
);

onMounted(async () => {
  // Инициализация провайдера происходит в watcher'е с immediate: true
  
  if (mapStore.currentProvider === "remote") {
    const iRemote = setInterval(() => {
      if (state.providerObj && state.providerObj.connection && markers.isReadyLayers()) {
        clearInterval(iRemote);
        state.canHistory = true;
      }
    }, 1000);
  }

  // Check if AQI is selected in realtime mode and switch to PM2.5
  if (mapStore.currentUnit === 'aqi' && mapStore.currentProvider === 'realtime') {
    mapStore.setCurrentUnit('pm25');
    // URL синхронизируется автоматически через route.query watcher
  }

  // Handle sensor parameter
  if (route.query.sensor) {
    handleActivePoint(route.query.sensor);
  }

  const waitForMatomo = setInterval(() => {
    if (
      typeof window.Matomo !== "undefined" &&
      typeof window.Matomo.getTracker === "function"
    ) {
      clearInterval(waitForMatomo);

      const trackPage = () => {
        const tracker = window.Matomo.getTracker();
        if (tracker && !tracker.isUserOptedOut()) {
          window._paq.push(["setCustomUrl", router.currentRoute.value.fullPath]);
          window._paq.push(["setDocumentTitle", document.title]);
          window._paq.push(["trackPageView"]);
        }
      };

      // Track the initial page load
      trackPage();
    }
  }, 100);
});

</script>
