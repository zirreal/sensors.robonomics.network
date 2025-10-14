import Provider from "@/providers/remote";
import Libp2pProvider from "@/providers/libp2p";
import { getConfigBounds, filterByBounds } from "../map";
import { hasValidCoordinates } from "../../utils";
import { settings } from "@config";

// Глобальные константы провайдеров
const REMOTE_PROVIDER = new Provider(settings.REMOTE_PROVIDER);
const LIBP2P_PROVIDER = new Libp2pProvider(settings.LIBP2P);

// Глобальный объект провайдера
let providerObj = null;


/**
 * Получает максимальные значения с проверкой кэша и обновлением сенсоров
 * Проверяет, есть ли уже данные в sensors, и делает запрос только при необходимости
 * @param {number} start - начальный timestamp
 * @param {number} end - конечный timestamp
 * @param {string} unit - единица измерения (pm10, pm25, etc.)
 * @param {Array} sensors - массив сенсоров
 * @returns {Array} обновленный массив сенсоров с maxdata
 */
export async function getMaxData(start, end, unit, sensors) {
  // Проверяем, есть ли уже данные для этого типа измерения
  const hasExistingData = sensors.some(sensor => 
    sensor.maxdata && sensor.maxdata[unit] !== undefined
  );
  
  if (hasExistingData) {
    // Данные уже есть, возвращаем копию существующих сенсоров для реактивности
    return [...sensors];
  }
  
  // Делаем API запрос
  const maxValues = await REMOTE_PROVIDER.maxValuesForPeriod(start, end, unit);
  
  // Обновляем maxdata для существующих сенсоров
  const updatedSensors = sensors.map(sensor => {
    const sensorId = sensor.sensor_id;
    const hasMaxData = maxValues[sensorId];
    
    if (hasMaxData) {
      // Новая структура API: {model, geo, timestamp, value}
      const currentUnitValue = maxValues[sensorId].value;
      
      return {
        ...sensor,
        maxdata: {
          ...sensor.maxdata, // Сохраняем существующие данные
          [unit]: currentUnitValue || null
        }
      };
    }
    return sensor;
  });
  
  return updatedSensors;
}


/**
 * Получает сенсоры с данными для карты
 * @param {number} start - начальный timestamp
 * @param {number} end - конечный timestamp
 * @param {string} provider - тип провайдера ('remote' или 'realtime')
 * @returns {Object} объект с sensors (с валидными координатами) и sensorsNoLocation (с нулевыми координатами)
 */
export async function getSensors(start, end, provider = 'remote') {
  if (provider === 'realtime') {
    // Для realtime провайдера сенсоры приходят через WebSocket
    // и обрабатываются в Main.vue через handlerNewPoint
    // Здесь возвращаем пустые массивы, так как данные уже есть в composable
    return { sensors: [], sensorsNoLocation: [] };
  } else {
    // Для remote получаем базовые данные сенсоров
    const historyData = await REMOTE_PROVIDER.getSensorsForPeriod(start, end);
     
    // Обрабатываем данные прямо здесь
    const sensors = [];
    const sensorsNoLocation = [];
    
    // Новый API возвращает массив сенсоров
    if (!Array.isArray(historyData)) return { sensors, sensorsNoLocation };
    
    for (const sensorData of historyData) {
      if (!sensorData || !sensorData.sensor_id || !sensorData.geo) continue;
      
      // Проверяем валидность координат
      const lat = parseFloat(sensorData.geo.lat);
      const lng = parseFloat(sensorData.geo.lng);
      
      const sensorInfo = {
        sensor_id: sensorData.sensor_id,
        model: sensorData.model || 2,
        geo: { lat, lng },
        address: sensorData.address || null,
        donated_by: sensorData.donated_by || null,
        timestamp: sensorData.timestamp || null
      };
      
      if (!hasValidCoordinates({ lat, lng })) {
        // Сенсоры с нулевыми координатами
        sensorsNoLocation.push(sensorInfo);
      } else {
        // Сенсоры с валидными координатами
        sensors.push(sensorInfo);
      }
    }
    
    const bounds = getConfigBounds(settings);
    return {
      sensors: filterByBounds(sensors, bounds),
      sensorsNoLocation: filterByBounds(sensorsNoLocation, bounds)
    };
  }
}

/**
 * Получает сообщения для realtime провайдера
 * @param {number} start - начальный timestamp
 * @param {number} end - конечный timestamp
 * @param {Object} providerObj - объект провайдера
 * @returns {Array} массив обработанных сообщений
 */
export async function getMessages(start, end) {
  try {
    return await REMOTE_PROVIDER.messagesForPeriod(start, end);
  } catch (error) {
    console.warn('Failed to load messages:', error);
    return [];
  }
}

/**
 * Получает данные для конкретного сенсора
 * @param {string} sensorId - ID сенсора
 * @param {number} startTimestamp - начальный timestamp
 * @param {number} endTimestamp - конечный timestamp
 * @param {string} provider - тип провайдера ('remote' или 'realtime')
 * @returns {Array} массив данных сенсора
 */
export async function getSensorData(sensorId, startTimestamp, endTimestamp, provider = 'remote', onRealtimePoint = null) {
  try {
    if (provider === 'realtime' && providerObj) {
      // Для realtime провайдера подписываемся на данные
      if (onRealtimePoint) {
        const unwatch = providerObj.watch(async (point) => {
          await onRealtimePoint(point);
        });
        return unwatch; // Возвращаем функцию отписки
      } else {
        // Если callback не передан, получаем исторические данные
        const historyData = await providerObj.getHistoryBySensor(sensorId);
        return historyData || [];
      }
    } else {
      const historyData = await REMOTE_PROVIDER.getHistoryPeriodBySensor(sensorId, startTimestamp, endTimestamp);
      return historyData || [];
    }
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    return [];
  }
}


/**
 * Устанавливает объект провайдера
 * @param {Object} provider - объект провайдера
 */
export function setProvider(provider) {
  providerObj = provider;
}

/**
 * Получает текущий объект провайдера
 * @returns {Object} объект провайдера
 */
export function getProvider() {
  return providerObj;
}

/**
 * Инициализирует провайдер по типу
 * @param {string} providerType - тип провайдера ('remote' или 'realtime')
 * @param {Function} onRealtimePoint - callback для realtime данных
 * @param {Function} onRemoteReady - callback для remote готовности
 * @returns {Promise<Object>} объект с результатом инициализации
 */
export async function initProvider(providerType, onRealtimePoint = null, onRemoteReady = null) {
  if (providerType === "remote") {
    setProvider(REMOTE_PROVIDER);
    
    const isReady = await REMOTE_PROVIDER.status();
    if (!isReady) {
      return { success: false, provider: null };
    }
    
    // Если передан callback для remote готовности, вызываем его
    if (onRemoteReady) {
      onRemoteReady();
    }
    
    return { success: true, provider: REMOTE_PROVIDER };
    
  } else if (providerType === "realtime") {
    setProvider(LIBP2P_PROVIDER);
    
    await LIBP2P_PROVIDER.ready();
    
    // Если передан callback для realtime, подписываемся
    let unwatch = null;
    if (onRealtimePoint) {
      unwatch = subscribeRealtime(onRealtimePoint);
    }
    
    return { success: true, provider: LIBP2P_PROVIDER, unwatch };
  }
  
  return { success: false, provider: null };
}

/**
 * Подписывается на realtime данные
 * @param {Function} onRealtimePoint - callback для обработки данных
 * @returns {Function} функция отписки
 */
export function subscribeRealtime(onRealtimePoint) {
  if (providerObj && onRealtimePoint) {
    return providerObj.watch(async (point) => {
      await onRealtimePoint(point);
    });
  }
  return null;
}

/**
 * Отписывается от realtime данных
 * @param {Function} unwatch - функция отписки
 */
export function unsubscribeRealtime(unwatch) {
  if (unwatch) {
    unwatch();
  }
}


