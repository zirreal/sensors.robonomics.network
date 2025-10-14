import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useMap } from "@/composables/useMap";
import { useBookmarks } from "@/composables/useBookmarks";

import { pinned_sensors } from "@config";
import * as sensorsUtils from "../utils/map/sensors";
import { clearActiveMarker, setActiveMarker } from "../utils/map/markers";
import { getSensors, getSensorData, getMaxData, unsubscribeRealtime, initProvider } from "../utils/map/sensors/requests";
import { getAddress } from "../utils/utils";
import { hasValidCoordinates } from "../utils/utils";
import { dayBoundsUnix } from "@/utils/date";
import { enrichLogsWithDewPoint } from "../utils/calculations/dew_point";

const COORDINATE_TOLERANCE = 0.001; // Минимальное значение координат - маркеры с координатами меньше этого значения считаются невалидными
const DEFAULT_SENSOR_MODEL = 2; // ID модели сенсора по умолчанию, если модель не указана

// Глобальное состояние для сенсоров (разделяется между всеми экземплярами composable)
const sensors = ref([]);
const sensorsNoLocation = ref([]);
const sensorsLoaded = ref(false);

export function useSensors(localeComputed) {
  const mapState = useMap();
  const { idbBookmarks } = useBookmarks();
  const router = useRouter();
  const route = useRoute();

  // Локальное состояние компонента
  const sensorPoint = ref(null);
  const isUpdatingPopup = ref(false); // Флаг для предотвращения повторных вызовов updateSensorPopup

  const isSensor = computed(() => {
    return !!(route.query.sensor && sensorPoint.value && sensorPoint.value.sensor_id);
  });

  /**
   * Проверяет, открыт ли попап для указанного сенсора
   * @param {string} sensorId - ID сенсора для проверки
   * @returns {boolean} true если попап открыт для этого сенсора
   */
  const isSensorOpen = (sensorId) => {
    return sensorPoint.value && sensorPoint.value.sensor_id === sensorId;
  };

  /**
   * Обновляет данные сенсора в массиве sensors
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
    // Если мы мутируем существующий массив (sensors.value), Vue не увидит изменения
    // и watcher на sensors не сработает. Создание нового массива гарантирует
    // что setSensors() получит новую ссылку и реактивность сработает корректно
    const existingSensors = [...(sensors.value || [])];
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
      const sensorData = formatPointForSensor(updatedSensor, { calculateValue: false });
      existingSensors[sensorIndex] = sensorData;
    } else {
      // Добавляем новый сенсор
      const sensorData = formatPointForSensor({
        sensor_id: sensorId,
        geo: data.geo || { lat: 0, lng: 0 },
        maxdata: data.maxdata || {},
        data: data.data || {},
        logs: data.logs || []
      });
      existingSensors.push(sensorData);
    }
    
    setSensors(existingSensors);
  };

  /**
   * Обновляет логи сенсора для открытого попапа
   * @param {string} sensorId - ID сенсора для обновления логов
   * @throws {Error} При ошибке загрузки логов устанавливает пустой массив
   */
  const updateSensorLogs = async (sensorId) => {
    if (!isSensorOpen(sensorId)) return;
    
    try {
      const { start, end } = dayBoundsUnix(mapState.currentDate.value);
      
      let logArray = [];
      
      // Загружаем логи через API
      logArray = await getSensorData(
        sensorId,
        start,
        end,
        mapState.currentProvider.value
      );

      
      // Обогащаем логи данными о точке росы
      enrichLogsWithDewPoint(logArray);
      
      // Обновляем только логи
      sensorPoint.value = { ...sensorPoint.value, logs: [...logArray] };

      // Сохраняем логи
      setSensorData(sensorId, {
        logs: logArray
      });
    } catch (error) {
      console.error('Error updating sensor logs:', error);
      // При ошибке устанавливаем пустые логи
      sensorPoint.value = { ...sensorPoint.value, logs: [] };
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
  const updateSensorPopup = (point) => {
    // Защита от повторных вызовов
    if (isUpdatingPopup.value) {
      return;
    }

    if (!point.sensor_id) {
      return;
    }
    
    try {
        isUpdatingPopup.value = true;

        // Получаем адрес сенсора асинхронно, если его нет
        if(!point.address && hasValidCoordinates(point.geo)){
            point.address = `Loading address...`;
            getAddress(point.geo.lat, point.geo.lng, localeComputed.value).then(address => {
                if (sensorPoint.value && sensorPoint.value.sensor_id === point.sensor_id &&  address) {
                    sensorPoint.value.address = address;
                }
            });
        }

        // Проверяем есть ли изменения в данных сенсора
        const foundSensor = sensors.value.find(s => s.sensor_id === point.sensor_id);
        const isNewPopup = !isSensorOpen(point.sensor_id);
        const hasDataChanges = !foundSensor || 
            !foundSensor.geo || 
            !point.geo ||
            foundSensor.geo.lat !== point.geo.lat || 
            foundSensor.geo.lng !== point.geo.lng ||
            foundSensor.address !== point.address;

        // Если попап не открыт для того же сенсора ИЛИ есть изменения в данных
        if (isNewPopup || hasDataChanges) {
            
            if (isNewPopup) {
                mapState.mapinactive.value = true;
            }

            sensorPoint.value = formatPointForSensor({
                ...point,
                geo: point.geo,
                zoom: point.zoom
            });

            // sensors
            setSensorData(point.sensor_id, {
                geo: point.geo,
                zoom: point.zoom,
                address: point.address
            });

            // Устанавливаем активный маркер и двигаем карту
            setActiveMarker(point.sensor_id);
        }
  
        // Обновляем логи асинхронно для быстрого открытия попапа
        updateSensorLogs(point.sensor_id);

    } catch (error) {
      console.error('Error updating sensor popup:', error);
      // Сбрасываем состояние при ошибке
      sensorPoint.value = null;
      mapState.mapinactive.value = false;
    } finally {
      isUpdatingPopup.value = false;
    }
  };

  /**
   * Создает унифицированный объект point для сенсора
   * @param {Object} basePoint - Базовые данные сенсора
   * @param {Object} options - Дополнительные опции
   * @param {boolean} [options.calculateValue] - Вычислять ли значение и isEmpty
   * @returns {Object} Унифицированный объект point
   */
  const formatPointForSensor = (basePoint, options = {}) => {
    const { calculateValue = false } = options;
    
    const point = {
      sensor_id: basePoint.sensor_id,
      geo: basePoint.geo,
      model: basePoint.model || DEFAULT_SENSOR_MODEL,
      maxdata: basePoint.maxdata || {},
      data: basePoint.data || {},
      address: basePoint.address || null,
      isBookmarked: basePoint.isBookmarked || false,
      logs: basePoint.logs || [],
      iconLocal: pinned_sensors[basePoint.sensor_id]?.icon || null
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
    const currentUnit = mapState.currentUnit.value;
    
    if (mapState.currentProvider.value === "remote") {
      // Remote режим: используем maxdata
      const value = point?.maxdata?.[currentUnit];
      
      
      if (value !== null && value !== undefined && !isNaN(Number(value))) {
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
  const updateSensorMarker = (point) => {
    if (!point.model || !sensorsUtils.isReadyLayer()) return;

    try {
      // Нормализуем данные
      point.data = point.data
        ? Object.fromEntries(Object.entries(point.data).map(([k, v]) => [k.toLowerCase(), v]))
        : {};

      // Устанавливаем закладку
      point.isBookmarked = idbBookmarks.value?.some(bookmark => bookmark.id === point.sensor_id) || false;

      // Обновляем маркер с правильным цветом
      const unifiedPoint = formatPointForSensor(point, { calculateValue: true });

      sensorsUtils.upsertPoint(unifiedPoint, mapState.currentUnit.value);
    } catch (error) {
      console.error('Error updating marker:', error, point);
    }
  };

  const handlerCloseSensor = (unwatchRealtime) => {
    mapState.mapinactive.value = false;
    
    // Сначала отписываемся от realtime
    if (unwatchRealtime) {
      unsubscribeRealtime(unwatchRealtime);
    }
    
    // Затем очищаем состояние попапа сенсора
    sensorPoint.value = null;
    
    // Очищаем активный маркер (также сбрасывает активную область карты)
    clearActiveMarker();
    
    // Убираем sensor из URL при закрытии попапа
    const currentQuery = { ...route.query };
    delete currentQuery.sensor;
    router.replace({ query: currentQuery });
    
    sensorsUtils.refreshClusters();
  };

  // Переменная для предотвращения race conditions при загрузке сенсоров
  let currentRequestId = null;

  /**
   * Обновляет maxdata для существующих сенсоров при смене currentUnit
   */
  const updateSensorMaxData = async () => {
    // Проверяем, что это remote режим и есть сенсоры
    if (mapState.currentProvider.value !== 'remote' || sensors.value.length === 0) {
      return;
    }
    
    const { start, end } = dayBoundsUnix(mapState.currentDate.value);

    try {
      // Получаем обновленные сенсоры с maxdata
      const updatedSensors = await getMaxData(start, end, mapState.currentUnit.value, sensors.value);
      
      // Обновляем сенсоры
      setSensors(updatedSensors);
      
      // Обновляем маркеры после обновления maxdata
      updateSensorMarkers(false);
    } catch (error) {
      console.error('Error updating maxdata:', error);
    }
  };

  const loadSensors = async () => {
    // Получаем start и end для текущей даты
    const { start, end } = dayBoundsUnix(mapState.currentDate.value);

    // Отменяем предыдущий запрос если он еще выполняется
    currentRequestId = Math.random().toString(36);
    const requestId = currentRequestId;
    
    // Очищаем список сенсоров в приложении
    clearSensors();
    
    // Получаем список сенсоров для обоих режимов
    try {
      // Получаем базовые данные сенсоров (координаты, адреса)
      const { sensors: sensorsData, sensorsNoLocation: sensorsNoLocationData } = await getSensors(start, end, mapState.currentProvider.value);
      
      // Проверяем, не был ли запрос отменен
      if (currentRequestId !== requestId) {
        return;
      }
      
      // Обновляем список сенсоров в приложении
      if (sensorsData && Array.isArray(sensorsData)) {
        setSensors(sensorsData);
      }
      if (sensorsNoLocationData && Array.isArray(sensorsNoLocationData)) {
        setSensorsNoLocation(sensorsNoLocationData);
      }
    } catch (error) {
      console.error('Error fetching sensor history:', error);
    }
  };

  let lastUpdateKey = '';

  /**
   * Обновляет все маркеры сенсоров на карте на основе данных из sensors
   * Очищает старые маркеры, создает новые с правильными цветами и обновляет кластеры
   * @param {boolean} clear - Очищать ли все маркеры перед обновлением (по умолчанию true)
   * @throws {Error} При ошибке логирует ошибку в консоль
   */
  const updateSensorMarkers = (clear = true) => {
    const sensorsData = sensors.value;
    const currentUnit = mapState.currentUnit.value;
    const currentDate = mapState.currentDate.value;

    // Создаем ключ для предотвращения дублирующихся запросов
    const updateKey = `${currentDate}-${currentUnit}-${sensors.value.length}`;
    if (updateKey === lastUpdateKey) {
      return;
    }
    lastUpdateKey = updateKey;

    try {
      // Очищаем все маркеры перед обновлением только если нужно
      if (clear) {
        sensorsUtils.clearAllMarkers();
      }
      
      let markersCreated = 0;
      let markersSkipped = 0;
      
      // Используем данные из sensors (уже содержат координаты и данные)
      for (const sensor of sensorsData) {
        if (!sensor.sensor_id) continue;
        
        // Проверяем координаты перед созданием маркера
        const lat = Number(sensor.geo.lat);
        const lng = Number(sensor.geo.lng);
        if (Math.abs(lat) < COORDINATE_TOLERANCE && Math.abs(lng) < COORDINATE_TOLERANCE) {
          markersSkipped++;
          continue;
        }
        
        // Создаем маркер с правильным цветом
        const point = formatPointForSensor(sensor, { calculateValue: true });
          
        // Используем updateSensorMarker для единообразной логики
        updateSensorMarker(point);
        markersCreated++;
      }
      
      // Обновляем кластеры после добавления всех маркеров
      try {
        sensorsUtils.refreshClusters();
      } catch (error) {
        console.warn('refreshClusters: Map context not ready yet');
      }
      
    } catch (error) {
      console.error('Error updating markers:', error);
    }
  };

  // Функции для управления локальными данными
  const setSensors = (sensorsArr) => {
    sensors.value = sensorsArr;
    sensorsLoaded.value = true;
  };

  const setSensorsNoLocation = (sensorsArr) => {
    sensorsNoLocation.value = sensorsArr;
  };

  const clearSensors = () => {
    sensors.value = [];
    sensorsNoLocation.value = [];
    sensorsLoaded.value = false;
  };

  return {
    // State
    sensorPoint,
    sensors,
    sensorsNoLocation,
    sensorsLoaded,
    
    // Computed
    isSensor,
    
    // Functions
    isSensorOpen,
    setSensorData,
    updateSensorLogs,
    updateSensorPopup,
    formatPointForSensor,
    calculateMarkerValue,
    updateSensorMarker,
    handlerCloseSensor,
    updateSensorMaxData,
    loadSensors,
    updateSensorMarkers,
    setSensors,
    setSensorsNoLocation,
    clearSensors,
  };
}
