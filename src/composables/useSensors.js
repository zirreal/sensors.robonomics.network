import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useMap } from "@/composables/useMap";
import { useBookmarks } from "@/composables/useBookmarks";

import { pinned_sensors } from "@config";
import * as sensorsUtils from "../utils/map/sensors";
import { clearActiveMarker, setActiveMarker } from "../utils/map/markers";
import { getSensors, getSensorDataWithCache, getMaxData, unsubscribeRealtime, saveAddressToCache, getCachedAddress, getSensorOwner } from "../utils/map/sensors/requests";
import { getAddress } from "../utils/utils";
import { hasValidCoordinates } from "../utils/utils";
import { dayBoundsUnix, getPeriodBounds } from "@/utils/date";

const COORDINATE_TOLERANCE = 0.001; // Минимальное значение координат - маркеры с координатами меньше этого значения считаются невалидными
const DEFAULT_SENSOR_MODEL = 2; // ID модели сенсора по умолчанию, если модель не указана

// Глобальное состояние для сенсоров (разделяется между всеми экземплярами composable)
const sensors = ref([]);
const sensorsNoLocation = ref([]);
const sensorsLoaded = ref(false);

const createDefaultLogsProgress = () => ({
  status: 'idle',
  active: false,
  totalDays: 0,
  cachedDays: 0,
  loadedDays: 0,
  missingDays: 0,
  percent: 0,
  mode: null
});

const logsProgress = ref(createDefaultLogsProgress());

export function useSensors(localeComputed) {
  const mapState = useMap();
  const { idbBookmarks } = useBookmarks();
  const router = useRouter();
  const route = useRoute();

  // Локальное состояние компонента
  const sensorPoint = ref(null);

  const resetLogsProgress = () => {
    logsProgress.value = createDefaultLogsProgress();
  };
  const isUpdatingPopup = ref(false); // Флаг для предотвращения повторных вызовов updateSensorPopup
  const ownerPromises = new Map();

  const ensureOwnerLoaded = (sensorId) => {
    if (!sensorId) return;

    // Проверяем, есть ли owner уже в списке сенсоров
    const existing = sensors.value.find(s => s.sensor_id === sensorId);
    if (existing && existing.owner) {
      return Promise.resolve(existing.owner);
    }

    // Если уже есть активный запрос, возвращаем его
    if (ownerPromises.has(sensorId)) {
      return ownerPromises.get(sensorId);
    }

    const promise = getSensorOwner(sensorId)
      .then(owner => {
        if (owner) {
          setSensorData(sensorId, { owner });
          if (sensorPoint.value && sensorPoint.value.sensor_id === sensorId) {
            sensorPoint.value = {
              ...sensorPoint.value,
              owner
            };
          }
        }
        return owner;
      })
      .catch(error => {
        console.warn('Failed to load owner for sensor', sensorId, error);
        return null;
      })
      .finally(() => {
        ownerPromises.delete(sensorId);
      });

    ownerPromises.set(sensorId, promise);
    return promise;
  };


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
        logs: data.logs !== undefined ? data.logs : (existingSensor.logs ?? null),
        owner: data.owner !== undefined ? data.owner : existingSensor.owner
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
        logs: data.logs ?? null,
        owner: data.owner || null
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
    
    // Для remote провайдера: если логи уже загружены (массив), не делаем повторный запрос
    // Логи обновляются только при смене даты/периода (через clearSensorLogs)
    if (mapState.currentProvider.value === 'remote') {
      const currentLogs = sensorPoint.value?.logs;
      if (Array.isArray(currentLogs)) {
        // Логи уже загружены для remote - не делаем повторный запрос
        resetLogsProgress();
        return;
      }
    }
    
    try {
      // Определяем режим таймлайна и получаем соответствующие границы
      const timelineMode = mapState.timelineMode.value;
      let start, end;
      
      if (timelineMode === 'day') {
        // Для дня используем точные границы дня
        const bounds = dayBoundsUnix(mapState.currentDate.value);
        start = bounds.start;
        end = bounds.end;
        resetLogsProgress();
      } else {
        // Для week/month используем getPeriodBounds
        const bounds = getPeriodBounds(mapState.currentDate.value, timelineMode);
        start = bounds.start;
        end = bounds.end;

        logsProgress.value = {
          status: 'loading',
          active: true,
          totalDays: 0,
          cachedDays: 0,
          loadedDays: 0,
          missingDays: 0,
          percent: 0,
          mode: timelineMode
        };
      }
      
      // Отменяем предыдущий запрос логов если он еще выполняется
      if (currentLogsAbortController) {
        currentLogsAbortController.abort();
      }
      
      currentLogsRequestId = Math.random().toString(36);
      const requestId = currentLogsRequestId;
      
      // Создаем новый AbortController для этого запроса
      currentLogsAbortController = new AbortController();
      
      // Загружаем логи через API с поддержкой отмены и кэшированием
      // НЕ инициализируем logArray как [], чтобы не создавать промежуточное состояние
      const handleProgressUpdate = (payload) => {
        if (!['week', 'month'].includes(mapState.timelineMode.value)) return;
        const current = logsProgress.value;
        const totalDays = payload.totalDays ?? current.totalDays;
        const loadedDays = payload.loadedDays ?? current.loadedDays;
        const cachedDays = payload.cachedDays ?? current.cachedDays;
        const missingDays = payload.missingDays ?? Math.max(totalDays - loadedDays, 0);
        const percent = totalDays > 0 ? Math.round((loadedDays / totalDays) * 100) : 0;
        const nextStatus = payload.status || current.status;

        logsProgress.value = {
          status: nextStatus,
          active: nextStatus === 'loading' || nextStatus === 'progress' || nextStatus === 'init',
          totalDays,
          cachedDays,
          loadedDays,
          missingDays,
          percent,
          mode: mapState.timelineMode.value
        };
      };

      const logArray = await getSensorDataWithCache(
        sensorId,
        start,
        end,
        mapState.currentProvider.value,
        null, // onRealtimePoint
        currentLogsAbortController.signal,
        handleProgressUpdate
      );

      // Проверяем, не был ли запрос отменен
      if (currentLogsRequestId !== requestId) {
        resetLogsProgress();
        return;
      }
      
      // Обогащаем логи данными о точке росы
      
      // Проверяем, есть ли кэшированный адрес
      const cachedAddress = logArray && logArray._cachedAddress;
      if (cachedAddress && sensorPoint.value) {
        // Обновляем адрес из кэша
        sensorPoint.value = { ...sensorPoint.value, address: cachedAddress };
      }
      
      // Обновляем только логи
      // logArray может быть:
      // - массивом (даже пустым) = данные загружены
      // - null = данные не загружены (ошибка или отмена)
      if (logArray === null) {
        // Запрос не выполнен - оставляем logs как есть (null или undefined)
        sensorPoint.value = { ...sensorPoint.value, logs: sensorPoint.value?.logs ?? null };
        resetLogsProgress();
      } else if (Array.isArray(logArray)) {
        // Данные загружены (даже если пустой массив)
        sensorPoint.value = { ...sensorPoint.value, logs: [...logArray] };
        
        // Сохраняем логи
        setSensorData(sensorId, {
          logs: logArray
        });

        if (['week', 'month'].includes(mapState.timelineMode.value)) {
          logsProgress.value = {
            status: 'done',
            active: false,
            totalDays: logsProgress.value.totalDays || logsProgress.value.loadedDays,
            cachedDays: logsProgress.value.cachedDays,
            loadedDays: logsProgress.value.totalDays || logsProgress.value.loadedDays,
            missingDays: 0,
            percent: 100,
            mode: mapState.timelineMode.value
          };
        } else {
          resetLogsProgress();
        }
      }
    } catch (error) {
      console.error('Error updating sensor logs:', error);
      // При ошибке устанавливаем null (логи не загружены)
      sensorPoint.value = { ...sensorPoint.value, logs: null };
      logsProgress.value = {
        status: 'error',
        active: false,
        totalDays: logsProgress.value.totalDays,
        cachedDays: logsProgress.value.cachedDays,
        loadedDays: logsProgress.value.loadedDays,
        missingDays: logsProgress.value.missingDays,
        percent: logsProgress.value.percent,
        mode: mapState.timelineMode.value
      };
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

        // Получаем адрес сенсора - сначала из кэша, потом из API
        if(!point.address && hasValidCoordinates(point.geo) && point.address !== 'Loading address...'){
            point.address = `Loading address...`;
            
            // Сначала проверяем кэшированный адрес
            getCachedAddress(point.sensor_id).then(cachedAddress => {
                if (cachedAddress && sensorPoint.value && sensorPoint.value.sensor_id === point.sensor_id) {
                    sensorPoint.value.address = cachedAddress;
                } else {
                    // Если в кэше нет, получаем из API
                    getAddress(point.geo.lat, point.geo.lng, localeComputed.value).then(address => {
                        if (sensorPoint.value && sensorPoint.value.sensor_id === point.sensor_id &&  address) {
                            sensorPoint.value.address = address;
                            // Сохраняем адрес в кэш
                            saveAddressToCache(point.sensor_id, address);
                        }
                    });
                }
            });
        }

        // Загружаем owner, если он отсутствует
        if (!point.owner) {
          ensureOwnerLoaded(point.sensor_id);
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

            // Если логи есть в foundSensor, добавляем их в point
            // НО: если массив пустой, не копируем - оставляем null,
            // чтобы различать "не загружено" (null) и "загружено, но пусто" ([])
            const hasLogsInPoint = point.logs && Array.isArray(point.logs);
            const hasLogsInSensor = foundSensor && foundSensor.logs && Array.isArray(foundSensor.logs) && foundSensor.logs.length > 0;
            if (hasLogsInSensor && !hasLogsInPoint) {
                point.logs = foundSensor.logs;
            }
            
            // Убеждаемся что logs не undefined
            if (point.logs === undefined) {
                point.logs = null;
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
        // Для remote: если логи уже загружены (массив), не делаем повторный запрос
        // Для realtime: всегда обновляем (данные приходят в реальном времени)
        const currentLogs = sensorPoint.value?.logs;
        if (mapState.currentProvider.value === 'remote' && Array.isArray(currentLogs)) {
          // Логи уже загружены для remote - не делаем повторный запрос
        } else {
          // Логи не загружены или это realtime - загружаем/обновляем
          updateSensorLogs(point.sensor_id);
        }

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
      owner: basePoint.owner || null,
      isBookmarked: basePoint.isBookmarked || false,
      logs: basePoint.logs ?? null,
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

  /**
   * Очищает логи сенсора (устанавливает null - логи не загружены)
   * @param {string} sensorId - ID сенсора (опционально, если не указан, очищает текущий открытый попап)
   */
  const clearSensorLogs = (sensorId = null) => {
    if (sensorId && isSensorOpen(sensorId)) {
      // Очищаем логи для конкретного сенсора
      if (sensorPoint.value && sensorPoint.value.sensor_id === sensorId) {
        sensorPoint.value = { ...sensorPoint.value, logs: null };
      }
      // Очищаем логи в массиве sensors
      const sensorIndex = sensors.value.findIndex(s => s.sensor_id === sensorId);
      if (sensorIndex >= 0) {
        const updatedSensors = [...sensors.value];
        updatedSensors[sensorIndex] = { ...updatedSensors[sensorIndex], logs: null };
        setSensors(updatedSensors);
      }
    } else if (sensorPoint.value) {
      // Очищаем логи для текущего открытого попапа
      sensorPoint.value = { ...sensorPoint.value, logs: null };
    }

    resetLogsProgress();
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

  // Переменные для предотвращения race conditions при загрузке сенсоров и логов
  let currentRequestId = null;
  let currentLogsRequestId = null;
  let currentLogsAbortController = null;

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
    // Определяем режим таймлайна и получаем соответствующие границы
    const timelineMode = mapState.timelineMode.value;
    let start, end;
    
    if (timelineMode === 'day') {
      // Для дня используем точные границы дня
      const bounds = dayBoundsUnix(mapState.currentDate.value);
      start = bounds.start;
      end = bounds.end;
    } else {
      // Для week/month используем getPeriodBounds
      const bounds = getPeriodBounds(mapState.currentDate.value, timelineMode);
      start = bounds.start;
      end = bounds.end;
    }

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

  /**
   * Проверяет наличие значения в данных (не undefined и не null)
   * @param {*} value - Значение для проверки
   * @returns {boolean} true если значение существует
   */
  const hasValue = (value) => {
    return value !== undefined && value !== null;
  };

  /**
   * Проверяет наличие co2 в данных лога
   * @param {Object} logItem - Элемент лога
   * @returns {boolean} true если есть co2
   */
  const hasCo2InLog = (logItem) => {
    return hasValue(logItem?.data?.co2);
  };

  /**
   * Проверяет наличие шума (noiseavg или noisemax) в данных лога
   * @param {Object} logItem - Элемент лога
   * @returns {boolean} true если есть шум
   */
  const hasNoiseInLog = (logItem) => {
    return hasValue(logItem?.data?.noiseavg) || hasValue(logItem?.data?.noisemax);
  };

  /**
   * Определяет наличие co2 и шума в массиве логов
   * @param {Array} logs - Массив логов
   * @returns {Object} Объект с hasCo2 и hasNoise
   */
  const checkLogsData = (logs) => {
    if (!Array.isArray(logs) || logs.length === 0) {
      return { hasCo2: false, hasNoise: false };
    }
    
    return {
      hasCo2: logs.some(hasCo2InLog),
      hasNoise: logs.some(hasNoiseInLog)
    };
  };

  /**
   * Определяет наличие co2 и шума в текущих данных (для realtime)
   * @param {Object} data - Текущие данные сенсора
   * @returns {Object} Объект с hasCo2 и hasNoise
   */
  const checkCurrentData = (data) => {
    if (!data) {
      return { hasCo2: false, hasNoise: false };
    }
    
    return {
      hasCo2: hasValue(data.co2),
      hasNoise: hasValue(data.noiseavg) || hasValue(data.noisemax)
    };
  };

  /**
   * Определяет тип сенсора на основе owner и данных
   * @param {Object} point - Данные сенсора
   * @returns {string} Тип сенсора: 'diy', 'insight', 'urban', 'altruist'
   */
  const getSensorType = (point) => {
    if (!point) return 'diy';
    
    // Если нет owner -> 'diy'
    if (!point.owner) {
      return 'diy';
    }
    
    // Проверяем логи для определения типа
    const logs = point.logs;
    const isRealtime = mapState.currentProvider.value === 'realtime';
    
    let hasCo2 = false;
    let hasNoise = false;
    
    // Приоритет: сначала проверяем логи, если есть
    if (Array.isArray(logs) && logs.length > 0) {
      const logsData = checkLogsData(logs);
      hasCo2 = logsData.hasCo2;
      hasNoise = logsData.hasNoise;
    } else if (isRealtime && point.data) {
      // Для realtime, если нет логов, проверяем текущие данные
      const currentData = checkCurrentData(point.data);
      hasCo2 = currentData.hasCo2;
      hasNoise = currentData.hasNoise;
    }
    
    // Определяем тип на основе наличия co2 и шума
    if (hasCo2 && !hasNoise) {
      return 'insight';
    }
    
    if (!hasCo2 && hasNoise) {
      return 'urban';
    }
    
    // Если есть owner, но нет данных для определения типа -> 'altruist'
    return 'altruist';
  };

  return {
    // State
    sensorPoint,
    sensors,
    sensorsNoLocation,
    sensorsLoaded,
    logsProgress,
    
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
    clearSensorLogs,
    getSensorType,
  };
}
