<template>
  <MetaInfo
    :pageTitle= "settings.TITLE"
    :pageDescription = "settings.DESC"
  />
  <Header />

  <MessagePopup 
    v-if="isMessage"
    :data="state.point.measurement"
    @close="handlerClose" />

  <SensorPopup
    v-if="isSensor"
    :point="state?.point"
    @close="handlerClose"
  />

  <Map
    @clickMarker="updateSensorPopup"
  />
</template>

<script setup>
import { reactive, computed, watch, onMounted, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useMapStore } from "@/stores/map";
import { useBookmarksStore } from "@/stores/bookmarks";

import { dayBoundsUnix } from "@/utils/date";

import Header from "../components/header/Header.vue";
import Map from "../components/Map.vue";
import MessagePopup from "../components/message/MessagePopup.vue";
import SensorPopup from "../components/sensor/SensorPopup.vue";
import MetaInfo from '../components/MetaInfo.vue';

import { settings } from "@config";
import * as providers from "../providers";
import * as markers from "../utils/map/markers";
import { clearActiveMarker } from "../utils/map/markers";
import { moveMap } from "../utils/map/instance";
import { getAddress } from "../utils/map/markers/requests";
import { syncMapSettings, hasValidCoordinates } from "../utils/utils";
import { useI18n } from "vue-i18n";
import { getSensors, getSensorData, getMaxData } from "../utils/map/markers/requests";

const COORDINATE_TOLERANCE = 0.001; // Минимальное значение координат - маркеры с координатами меньше этого значения считаются невалидными
const DEFAULT_SENSOR_MODEL = 2; // ID модели сенсора по умолчанию, если модель не указана
const RETRY_TIMEOUT = 300; // Задержка в миллисекундах для повторных попыток загрузки данных (geo, sensors, popup)

const mapStore = useMapStore();
const bookmarksStore = useBookmarksStore();
const router = useRouter();
const route = useRoute();
const { locale } = useI18n();

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");

const isMessage = computed(() => {
  return state.point?.model === 3;
});

const isSensor = computed(() => {
  // return state.point?.model === 2 || !!route.query.sensor;
  return !!route.query.sensor;
});

/**
 * Проверяет, открыт ли попап для указанного сенсора
 * @param {string} sensorId - ID сенсора для проверки
 * @returns {boolean} true если попап открыт для этого сенсора
 */
const isSensorOpen = (sensorId) => {
  return state.point && state.point.sensor_id === sensorId;
};

// Локальное состояние компонента
const state = reactive({
  point: null,
  providerObj: null,
  isSyncing: false, // Флаг для предотвращения циклических вызовов syncMapSettings
  isUpdatingPopup: false, // Флаг для предотвращения повторных вызовов updateSensorPopup
});

/**
 * Рассчитывает точку росы по температуре и влажности
 * @param {number} temperature - Температура в градусах Цельсия
 * @param {number} humidity - Влажность в процентах (0-100)
 * @returns {number|null} Точка росы в градусах Цельсия или null при неверных данных
 */
const calculateDewPoint = (temperature, humidity) => {
  if (typeof temperature !== 'number' || typeof humidity !== 'number' || humidity <= 0 || humidity > 100) {
    return null;
  }

  const a = 17.27;
  const b = 237.7;
  const gamma = (a * temperature) / (b + temperature) + Math.log(humidity / 100);
  const dewPoint = (b * gamma) / (a - gamma);

  return parseFloat(dewPoint.toFixed(2));
};

/**
 * Обогащает данные сенсора точкой росы, если доступны температура и влажность
 * @param {Object} data - Объект с данными сенсора
 * @returns {Object} Обогащенные данные с точкой росы (если возможно)
 */
const enrichWithDewPoint = (data) => {
  if (data && typeof data.temperature === 'number' && typeof data.humidity === 'number') {
    const dew = calculateDewPoint(data.temperature, data.humidity);
    if (dew !== null) {
      return { ...data, dewpoint: dew };
    }
  }
  return data;
};

/**
 * Обогащает массив логов данными о точке росы
 * @param {Array} logArr - Массив логов сенсора
 */
const enrichLogsWithDewPoint = (logArr) => {
  if (!Array.isArray(logArr)) return;
  
  logArr.forEach(entry => {
    if (entry?.data) {
      entry.data = enrichWithDewPoint(entry.data);
    }
  });
};

/**
 * Обновляет данные сенсора в ad
 * @param {string} sensorId - ID сенсора
 * @param {Object} data - Данные для обновления
 * @param {Object} [data.geo] - Координаты {lat, lng}
 * @param {number} [data.model] - Модель сенсора
 * @param {Object} [data.maxdata] - Максимальные данные
 * @param {Object} [data.data] - Текущие данные
 * @param {Array} [data.logs] - Логи сенсора
 */
const setSensorData = (sensorId, data) => {
  if (!sensorId || !data) return;
  
  // existingSensors: Создаем копию массива для обеспечения реактивности Vue
  // Если мы мутируем существующий массив (mapStore.sensors), Vue не увидит изменения
  // и watcher на mapStore.sensors не сработает. Создание нового массива гарантирует
  // что mapStore.setSensors() получит новую ссылку и реактивность сработает корректно
  const existingSensors = [...(mapStore.sensors || [])];
  const sensorIndex = existingSensors.findIndex(s => s.sensor_id === sensorId);
  
  if (sensorIndex >= 0) {
    // Обновляем существующий сенсор - мержим данные вместо замены
    const existingSensor = existingSensors[sensorIndex];
    const updatedSensor = {
      ...existingSensor,
      geo: data.geo || existingSensor.geo,
      model: data.model || existingSensor.model,
      maxdata: { ...existingSensor.maxdata, ...(data.maxdata || {}) },
      data: { ...existingSensor.data, ...(data.data || {}) }, // Мержим данные!
      logs: data.logs || existingSensor.logs
    };
    
    // Создаем унифицированную точку с мерженными данными
    const sensorData = createUnifiedPoint(updatedSensor, { calculateValue: false });
    existingSensors[sensorIndex] = sensorData;
  } else {
    // Добавляем новый сенсор
    const sensorData = createUnifiedPoint({
      sensor_id: sensorId,
      geo: data.geo || { lat: 0, lng: 0 },
      maxdata: data.maxdata || {},
      data: data.data || {},
      logs: data.logs || []
    });
    existingSensors.push(sensorData);
  }
  
  mapStore.setSensors(existingSensors);
};

/* + Realtime watch */
let unwatchRealtime = null;

function subscribeRealtime() {
  if (state.providerObj && !unwatchRealtime) {
      unwatchRealtime = state.providerObj.watch(async (point) => {
        
      // Обогащаем текущие данные точкой росы
      point.data = enrichWithDewPoint(point.data);
        
      // Обновляем данные для realtime
      setSensorData(point.sensor_id, {
        geo: point.geo,
        model: point.model,
        data: point.data
      });

      // Обновляем маркер
      updateMarker(point);
      
      // Если попап открыт для этого сенсора, обновляем его
      if (isSensorOpen(point.sensor_id)) {
        updateSensorPopup(point);
      }
    });
  }
}

function unsubscribeRealtime() {
  if (state.providerObj && unwatchRealtime) {
    state.providerObj.watch(null);
    unwatchRealtime = null;
  }
}
/* - Realtime watch */



/**
 * Обновляет логи сенсора для открытого попапа
 * @param {string} sensorId - ID сенсора для обновления логов
 * @throws {Error} При ошибке загрузки логов устанавливает пустой массив
 */
const updateSensorLogs = async (sensorId) => {
  if (!isSensorOpen(sensorId)) return;
  
  try {
    const { start, end } = dayBoundsUnix(mapStore.currentDate);
    
    let logArray = [];
    
    // Загружаем логи через API
    logArray = await getSensorData(
      sensorId,
      start,
      end,
      mapStore.currentProvider,
      state.providerObj
    );
    
    // Обогащаем логи данными о точке росы
    enrichLogsWithDewPoint(logArray);
    
    // Обновляем только логи
    state.point = { ...state.point, logs: [...logArray] };

    // Сохраняем логи
    setSensorData(sensorId, {
      logs: logArray
    });
  } catch (error) {
    console.error('Error updating sensor logs:', error);
    // При ошибке устанавливаем пустые логи
    state.point = { ...state.point, logs: [] };
  }
};

/**
 * Открывает попап сенсора с данными и адресом
 * @param {Object} point - Данные сенсора
 * @param {string} point.sensor_id - ID сенсора
 * @param {Object} [point.geo] - Координаты {lat, lng}
 * @param {number} [point.model] - Модель сенсора
 * @param {Object} [point.maxdata] - Максимальные данные
 * @param {Object} [point.data] - Текущие данные
 * @throws {Error} При ошибке сбрасывает состояние попапа
 */
const updateSensorPopup = async (point) => {
  // Защита от повторных вызовов
  if (state.isUpdatingPopup) {
    return;
  }
  
  // Если geo нет, устанавливаем нулевые координаты
  if (!point.geo) {
    point.geo = { lat: 0, lng: 0 };
  }
  
  // Определяем зум в зависимости от типа сенсора
  const zoom = hasValidCoordinates(point.geo) ? 18 : 3;
  
  state.isUpdatingPopup = true;
  
  try {
    // Если попап уже открыт для того же сенсора, обновляем только логи
    if (isSensorOpen(point.sensor_id)) {
      await updateSensorLogs(point.sensor_id);
    } else {
      
    mapStore.mapinactive = true;
  
    // Обновляем URL с параметром sensor и координатами сенсора
    if (route.query.sensor !== point.sensor_id) {
      const currentQuery = { ...route.query };
      currentQuery.sensor = point.sensor_id;
      
      // Если есть валидные координаты, обновляем их в URL
      if (hasValidCoordinates(point.geo)) {
        currentQuery.lat = point.geo.lat;
        currentQuery.lng = point.geo.lng;
      }
      
      // Устанавливаем зум в зависимости от того есть ли координаты
      currentQuery.zoom = zoom;
      
      router.replace({ query: currentQuery });
    }
  
    // Получаем данные сенсора из mapStore.sensors или используем переданные данные
    const foundSensor = mapStore.sensors.find(s => s.sensor_id === point.sensor_id);
    
    // Получаем адрес - для сенсоров с нулевыми координатами используем sensor_id
    let address;
    if (hasValidCoordinates(point.geo)) {
      address = await getAddress(point.geo.lat, point.geo.lng, localeComputed.value);
    } else {
      address = `Sensor ID: ${point.sensor_id}`;
    }
  
    // Открываем попап с базовыми данными
    state.point = createUnifiedPoint({
      ...point,
      geo: point.geo,
      maxdata: point.maxdata || foundSensor?.maxdata || {},
      data: point.data || foundSensor?.data || {},
      address: address
    });
  
    // Синхронизируем базовые данные с mapStore.sensors
    setSensorData(point.sensor_id, {
      geo: point.geo,
      model: state.point.model,
      maxdata: state.point.maxdata,
      data: state.point.data
    });
    
    // Загружаем логи асинхронно
    await updateSensorLogs(point.sensor_id);

    // Устанавливаем активный маркер
    markers.setActiveMarker(point.sensor_id);

    // Центрируем карту на сенсоре с учетом попапа
    moveMap(point.geo, zoom, { popup: true, setZoom: true });
  }
  } catch (error) {
    console.error('Error updating sensor popup:', error);
    // Сбрасываем состояние при ошибке
    state.point = null;
    mapStore.mapinactive = false;
  } finally {
    state.isUpdatingPopup = false;
  }
};

// Переменная для предотвращения race conditions при загрузке сенсоров
// Когда пользователь быстро меняет дату, старые запросы могут завершиться после новых
// currentRequestId позволяет отменить обработку результатов устаревших запросов
let currentRequestId = null;

/**
 * Загружает список сенсоров для текущей даты и провайдера
 * @async
 * @throws {Error} При ошибке загрузки логирует ошибку в консоль
 */
/**
 * Обновляет maxdata для существующих сенсоров при смене currentUnit
 */
const updateMaxData = async () => {
  // Проверяем, что это remote режим и есть сенсоры
  if (mapStore.currentProvider !== 'remote' || mapStore.sensors.length === 0) {
    return;
  }
  
  const { start, end } = dayBoundsUnix(mapStore.currentDate);
  
  try {
    const updatedSensors = await getMaxData(start, end, mapStore.currentUnit, mapStore);
    
    // Обновляем сенсоры
    mapStore.setSensors(updatedSensors);
    
    // Обновляем маркеры после обновления maxdata
    updateMarkers(false);
  } catch (error) {
    console.error('Error updating maxdata:', error);
  }
};

const loadSensors = async () => {
  // Получаем start и end для текущей даты
  const { start, end } = dayBoundsUnix(mapStore.currentDate);

  // Отменяем предыдущий запрос если он еще выполняется
  currentRequestId = Math.random().toString(36);
  const requestId = currentRequestId;

  // Отписываемся от realtime провайдера
  unsubscribeRealtime();
  
  // Очищаем список сенсоров в приложении
  mapStore.clearSensors();
  
  // Получаем список сенсоров для обоих режимов
  try {
    // Получаем базовые данные сенсоров (координаты, адреса)
    const { sensors, sensorsNoLocation } = await getSensors(start, end, mapStore.currentProvider);
    
    // Проверяем, не был ли запрос отменен
    if (currentRequestId !== requestId) {
      return;
    }
    
    // Обновляем список сенсоров в приложении
    if (sensors && Array.isArray(sensors)) {
      mapStore.setSensors(sensors);
    }
    if (sensorsNoLocation && Array.isArray(sensorsNoLocation)) {
      mapStore.setSensorsNoLocation(sensorsNoLocation);
    }
  } catch (error) {
    console.error('Error fetching sensor history:', error);
  }
};



/**
 * Создает унифицированный объект point для сенсора
 * @param {Object} basePoint - Базовые данные сенсора
 * @param {Object} options - Дополнительные опции
 * @param {boolean} [options.calculateValue] - Вычислять ли значение и isEmpty
 * @returns {Object} Унифицированный объект point
 */
const createUnifiedPoint = (basePoint, options = {}) => {
  const { calculateValue = false } = options;
  
  const point = {
    sensor_id: basePoint.sensor_id,
    geo: basePoint.geo,
    model: basePoint.model || DEFAULT_SENSOR_MODEL,
    maxdata: basePoint.maxdata || {},
    data: basePoint.data || {},
    address: basePoint.address || null,
    isBookmarked: basePoint.isBookmarked || false,
    logs: basePoint.logs || []
  };
  
    // Вычисляем значение и isEmpty только если нужно
    if (calculateValue) {
      const { value, isEmpty } = calculateMarkerValue(point);
      point.value = value;
      point.isEmpty = isEmpty;
    }
  
  return point;
};

/**
 * Вычисляет значение и статус пустоты для маркера на основе провайдера и единицы измерения
 * @param {Object} point - Данные сенсора
 * @param {Object} [point.maxdata] - Максимальные данные (для remote провайдера)
 * @param {Object} [point.data] - Текущие данные (для realtime провайдера)
 * @param {number} [point.timestamp] - Временная метка (для realtime провайдера)
 * @returns {Object} Объект с полями {value: number|null, isEmpty: boolean}
 */
const calculateMarkerValue = (point) => {
  const currentUnit = mapStore.currentUnit;
  
  if (mapStore.currentProvider === "remote") {
    // Remote режим: используем maxdata
    const value = point?.maxdata?.[currentUnit];
    
    
    if (value !== null && value !== undefined && !isNaN(Number(value)) && Number(value) > 0) {
      return { value: Number(value), isEmpty: false };
    }
  } else {
    // Realtime режим: используем последнее значение
    const lastValue = point?.data?.[currentUnit];
    
    if (lastValue !== null && lastValue !== undefined && !isNaN(Number(lastValue))) {
      return { value: Number(lastValue), isEmpty: false };
    }
  }
  
  return { value: null, isEmpty: true };
};

/**
 * Обновляет один маркер на карте с правильным цветом и данными
 * @param {Object} point - Данные сенсора для маркера
 * @param {string} point.sensor_id - ID сенсора
 * @param {Object} point.geo - Координаты {lat, lng}
 * @param {number} point.model - Модель сенсора
 * @param {Object} point.data - Данные сенсора
 * @param {Object} point.maxdata - Максимальные данные
 * @throws {Error} При ошибке логирует ошибку и пропускает маркер
 */
const updateMarker = (point) => {
  if (!point.model || !markers.isReadyLayers()) return;

  try {
    // Нормализуем данные
    point.data = point.data
      ? Object.fromEntries(Object.entries(point.data).map(([k, v]) => [k.toLowerCase(), v]))
      : {};

    // Устанавливаем закладку
    point.isBookmarked = bookmarksStore.idbBookmarks?.some(bookmark => bookmark.id === point.sensor_id) || false;

    // Обновляем маркер с правильным цветом
    const unifiedPoint = createUnifiedPoint(point, { calculateValue: true });
    markers.upsertPoint(unifiedPoint, mapStore.currentUnit);
  } catch (error) {
    console.error('Error updating marker:', error, point);
  }
};


const handlerClose = () => {
  mapStore.mapinactive = false;
  
  // Сначала отписываемся от realtime
  unsubscribeRealtime();
  
  // Затем очищаем состояние попапа
  state.point = null;
  
  // Очищаем активный маркер (также сбрасывает активную область карты)
  clearActiveMarker();
  
  // Убираем sensor из URL при закрытии попапа
  const currentQuery = { ...route.query };
  delete currentQuery.sensor;
  router.replace({ query: currentQuery });
  
  markers.refreshClusters();
};



let lastUpdateKey = '';

/**
 * Обновляет все маркеры на карте на основе данных из mapStore.sensors
 * Очищает старые маркеры, создает новые с правильными цветами и обновляет кластеры
 * @param {boolean} clear - Очищать ли все маркеры перед обновлением (по умолчанию true)
 * @throws {Error} При ошибке логирует ошибку в консоль
 */
const updateMarkers = (clear = true) => {
  const sensors = mapStore.sensors;
  const currentUnit = mapStore.currentUnit;
  const currentDate = mapStore.currentDate;

  // Создаем ключ для предотвращения дублирующихся запросов
  const updateKey = `${currentDate}-${currentUnit}-${sensors.length}`;
  if (updateKey === lastUpdateKey) {
    return;
  }
  lastUpdateKey = updateKey;

  try {
    // Очищаем все маркеры перед обновлением только если нужно
    if (clear) {
      markers.clearAllMarkers();
    }
    
    let markersCreated = 0;
    let markersSkipped = 0;
    
    // Используем данные из mapStore.sensors (уже содержат координаты и данные)
    for (const sensor of sensors) {
      if (!sensor.sensor_id) continue;
      
      // Проверяем координаты перед созданием маркера
      const lat = Number(sensor.geo.lat);
      const lng = Number(sensor.geo.lng);
      if (Math.abs(lat) < COORDINATE_TOLERANCE && Math.abs(lng) < COORDINATE_TOLERANCE) {
        markersSkipped++;
        continue;
      }
      
      // Создаем маркер с правильным цветом
      const point = createUnifiedPoint(sensor, { calculateValue: true });
        
      // Используем updateMarker для единообразной логики
      updateMarker(point);
      markersCreated++;
    }
    
    // Обновляем кластеры после добавления всех маркеров
    markers.refreshClusters();
    
  } catch (error) {
    console.error('Error updating markers:', error);
  }
};

/**
 * Обрабатывает сенсор из URL после загрузки данных
 * @param {Object} query - объект route.query
 */
const processSensorFromQuery = (query) => {
  // Ищем сенсор в mapStore.sensors для получения правильных координат
  const foundSensor = mapStore.sensors.find(s => s.sensor_id === query.sensor);
  
  let geo;
  if (foundSensor && foundSensor.geo) {
    geo = foundSensor.geo;
  } else {
    // Fallback на координаты из URL
    geo = {
      lat: parseFloat(query.lat) || 0,
      lng: parseFloat(query.lng) || 0
    };
  }
  
  const point = createUnifiedPoint({
    sensor_id: query.sensor,
    geo: geo,
    model: foundSensor?.model || DEFAULT_SENSOR_MODEL,
    maxdata: foundSensor?.maxdata || {},
    data: foundSensor?.data || {},
    logs: foundSensor?.logs || []
  });
  
  updateSensorPopup(point);
};


/* ТУТ ИНИЦИАЛИЗАЦИЯ ПРОВАЙДЕРА */
watch(
  () => mapStore.currentProvider,
  async (newProvider) => {
    if (newProvider) {
      // Отписываемся от старого провайдера, если он есть
      unsubscribeRealtime();
      
      // Инициализируем новый провайдер
      if (newProvider === "remote") {
        state.providerObj = new providers.Remote(settings.REMOTE_PROVIDER);
        if (!(await state.providerObj.status())) {
          mapStore.setCurrentProvider("realtime");
          // URL синхронизируется автоматически через route.query watcher
          return;
        }
        
        // Инициализация для remote провайдера
        const iRemote = setInterval(() => {
          if (state.providerObj && markers.isReadyLayers()) {
            clearInterval(iRemote);
            // Если есть активный сенсор в URL, обновляем попап после инициализации провайдера
            if (route.query.sensor) {
              updateSensorPopup({ sensor_id: route.query.sensor });
            }
          }
        }, 1000);
        
      } else if (newProvider === "realtime") {
        state.providerObj = new providers.Libp2p(settings.LIBP2P);
        state.providerObj.ready().then(() => {
          subscribeRealtime();
        });
      }
      
      // Check if AQI is selected in realtime mode and switch to PM2.5
      if (mapStore.currentUnit === 'aqi' && newProvider === 'realtime') {
        mapStore.setCurrentUnit('pm25');
        // URL синхронизируется автоматически через route.query watcher
      }
      
    }
  },
  { immediate: true }
);


/**
 * Центральный watcher для обработки изменений URL параметров
 * 
 * Отслеживает изменения в route.query и выполняет следующие действия:
 * 
 * 1. Синхронизация настроек карты (provider, type, date, zoom, lat, lng)
 *    - Обновляет mapStore с текущими значениями из URL
 *    - Предотвращает циклические вызовы через флаг isSyncing
 * 
 * 2. Перезагрузка данных сенсоров при изменении даты
 *    - Вызывает loadSensors() для получения новых данных с сервера
 * 
 * 3. Обновление маркеров при изменении type, date или provider
 *    - Очищает все маркеры с карты
 *    - Перерисовывает маркеры с новым типом измерения
 *    - Обновляет цвета кластеров
 * 
 * 4. Обновление попапа сенсора при изменении:
 *    - sensor: открытие попапа для нового сенсора
 *    - provider: переключение между remote/realtime режимами
 *    - date: обновление данных для текущего сенсора
 *    - Ищет данные сенсора в mapStore.sensors или использует fallback из URL
 */
watch(
  () => route.query,
  (newQuery, oldQuery) => {
    // Синхронизируем настройки карты
    if (!state.isSyncing) {
      const queryChanged = JSON.stringify(newQuery) !== JSON.stringify(oldQuery);
      
      if (queryChanged) {
        state.isSyncing = true;
        syncMapSettings(route, router, mapStore);
        state.isSyncing = false;
      }
    }
    
    // Определяем, что изменилось
    const sensorChanged = newQuery.sensor !== (oldQuery?.sensor);
    const providerChanged = newQuery.provider !== (oldQuery?.provider);
    const dateChanged = newQuery.date !== (oldQuery?.date);
    const typeChanged = newQuery.type !== (oldQuery?.type);
    
    
    // Перезагружаем данные сенсоров при изменении даты, провайдера или при первом заходе с сенсором
    if ((dateChanged && newQuery.date) || providerChanged || (sensorChanged && !mapStore.sensors.length)) {
      loadSensors().then(async () => {
        // После загрузки сенсоров обновляем попап, если есть сенсор в URL
        if (newQuery.sensor) {
          processSensorFromQuery(newQuery);
        }

        if(mapStore.currentProvider === 'remote') {
          // Для realtime маркеры обновляются по мере прихода данных
          await updateMaxData();
          updateMarkers();
        }
      });
    }
    
    // Обновляем maxdata и маркеры при изменении type (без date и provider, так как они обрабатываются через loadSensors)
    if (typeChanged) {
      if (mapStore.currentProvider === 'remote') {
        // Для remote обновляем maxdata и маркеры
        updateMaxData().then(() => {
          updateMarkers(false);
        });
      } else {
        // Для realtime просто обновляем цвета маркеров (данные уже приходят по мере поступления)
        updateMarkers(false);
      }
    }
    
    // Обновляем попап сенсора при изменении sensor, provider или date (только если сенсоры уже загружены)
    if ((sensorChanged || providerChanged || dateChanged) && newQuery.sensor && mapStore.sensors.length > 0) {
      processSensorFromQuery(newQuery);
    }
  },
  { immediate: true }
);

// это не удаляем, почти всегда нужно для отладки
// watch(
//   () => mapStore.sensors,
//   () => {
//     console.log('mapStore.sensors changed', mapStore.sensors);
//   }
// );


onMounted(async () => {
  // Вся логика инициализации перенесена в соответствующие watcher'ы:
  // - Инициализация провайдера: watcher для currentProvider
  // - Инициализация сенсоров: watcher для route.query и currentDate
  // - Обработка sensor параметра: watcher для currentProvider

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
