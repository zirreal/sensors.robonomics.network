import Provider from "@/providers/remote";
import Libp2pProvider from "@/providers/libp2p";
import { getConfigBounds, filterByBounds } from "../utils";
import { settings } from "@config";

const remote = new Provider(settings.REMOTE_PROVIDER);
const libp2p = new Libp2pProvider(settings.LIBP2P);


/**
 * Получает максимальные значения с проверкой кэша и обновлением сенсоров
 * Проверяет, есть ли уже данные в mapStore.sensors, и делает запрос только при необходимости
 * @param {number} start - начальный timestamp
 * @param {number} end - конечный timestamp
 * @param {string} unit - единица измерения (pm10, pm25, etc.)
 * @param {Object} mapStore - store с данными сенсоров
 * @returns {Object} обновленные сенсоры с maxdata
 */
export async function getMaxData(start, end, unit, mapStore) {
  // Проверяем, есть ли уже данные для этого типа измерения
  const hasExistingData = mapStore.sensors.some(sensor => 
    sensor.maxdata && sensor.maxdata[unit] !== undefined
  );
  
  if (hasExistingData) {
    // Данные уже есть, возвращаем копию существующих сенсоров для реактивности
    return [...mapStore.sensors];
  }
  
  // Делаем API запрос
  const maxValues = await remote.maxValuesForPeriod(start, end, unit);
  
  // Обновляем maxdata для существующих сенсоров
  const updatedSensors = mapStore.sensors.map(sensor => {
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
 * @returns {Array} массив сенсоров с координатами и данными для карты
 */
export async function getSensors(start, end, provider = 'remote') {
  if (provider === 'realtime') {
    // Для realtime провайдера сенсоры приходят через WebSocket
    // и обрабатываются в Main.vue через handlerNewPoint
    // Здесь возвращаем пустой массив, так как данные уже есть в mapStore.sensors
    return [];
  } else {
    // Для remote получаем базовые данные сенсоров с pm10 (всегда есть)
    const historyData = await remote.getHistoryPeriod(start, end);
    
    // Обрабатываем данные прямо здесь
    const sensors = [];
    for (const [sensorId, sensorDataArray] of Object.entries(historyData)) {
      if (!sensorId || !Array.isArray(sensorDataArray) || sensorDataArray.length === 0) continue;
      
      // Берем последние данные из массива
      const sensorData = sensorDataArray[sensorDataArray.length - 1];
      if (!sensorData || !sensorData.geo) continue;
      
      // Проверяем валидность координат
      const lat = parseFloat(sensorData.geo.lat);
      const lng = parseFloat(sensorData.geo.lng);
      if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) continue;
      
      sensors.push({
        sensor_id: sensorId,
        model: sensorData.model || 2,
        geo: { lat, lng },
        address: sensorData.address || null,
        donated_by: sensorData.donated_by || null,
        timestamp: sensorData.timestamp || null
      });
    }
    
    const bounds = getConfigBounds(settings);
    const result = filterByBounds(sensors, bounds);
    return result;
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
    return await remote.messagesForPeriod(start, end);
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
export async function getSensorData(sensorId, startTimestamp, endTimestamp, provider = 'remote', providerObj = null) {
  try {
    if (provider === 'realtime' && providerObj) {
      const historyData = await providerObj.getHistoryBySensor(sensorId);
      return historyData || [];
    } else {
      const historyData = await remote.getHistoryPeriodBySensor(sensorId, startTimestamp, endTimestamp);
      return historyData || [];
    }
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    return [];
  }
}

/**
 * Получает адрес по координатам
 * @param {number} lat - широта
 * @param {number} lng - долгота
 * @param {string} language - язык для адреса
 * @returns {string} строка адреса или координаты через запятую
 */
export async function getAddress(lat, lng, language = 'en') {
  const zoomAddr = Number(window?.appSettings?.GEOCODER?.zoom?.address) || 18;
  const tpl = window?.appSettings?.GEOCODER?.urlTemplate ||
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&zoom={zoom}&addressdetails={addressdetails}&accept-language={lang}";
  const url = tpl
    .replace('{lat}', encodeURIComponent(lat))
    .replace('{lon}', encodeURIComponent(lng))
    .replace('{zoom}', encodeURIComponent(zoomAddr))
    .replace('{addressdetails}', '1')
    .replace('{lang}', encodeURIComponent(language));

  try {
    const response = await fetch(url);
    const data = await response.json();
    const addr = buildAddressFromAny(data);
    
    // Если получили адрес, объединяем его в строку
    if (addr && Array.isArray(addr.address) && addr.address.length > 0) {
      const parts = [];
      if (addr.country) parts.push(addr.country);
      parts.push(...addr.address);
      return parts.join(', ');
    }
  } catch {}

  // Если не удалось получить адрес, возвращаем координаты
  return `${lat}, ${lng}`;
}



function pickCity(addr) {
  return (
    addr?.city ||
    addr?.town ||
    addr?.village ||
    addr?.municipality ||
    addr?.locality ||
    addr?.suburb ||
    addr?.hamlet ||
    addr?.county ||
    addr?.state ||
    ""
  );
}

function buildFromNominatim(j) {
  const a = j?.address || {};
  const country = a.country || "";
  const city = pickCity(a);
  const hood = a.neighbourhood || a.suburb || a.city_district || a.village || "";
  const road = a.road || a.pedestrian || a.footway || a.path || a.cycleway || "";
  const house = a.house_number || "";
  const postcode = a.postcode || "";
  const address = [];
  if (city) address.push(city);
  if (hood && hood !== city) address.push(hood);
  if (road) address.push(road);
  if (house) address.push(house);
  return { country, address, postcode };
}

function buildAddressFromAny(json) {
  if (json && json.address) return buildFromNominatim(json);
  return { country: "", address: [], postcode: "" };
}