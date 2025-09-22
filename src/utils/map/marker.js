/**
 * REMOVED FUNCTIONALITY:
 * - moveLayer and moveMarkerTime: Marker animation functionality (added in commit 7f8e804, never used)
 * - pathsLayer and path functions: Path drawing functionality (addPointPath, showPath, hidePath)
 * 
 * These features were added for mobile marker animation but were never fully 
 * implemented in the UI or caused more complexity than benefit. Removed to reduce code 
 * complexity and maintainability.
 */

import { sensors } from "@config";
import Queue from "js-queue";
import L from "leaflet";
import "leaflet-arrowheads";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import * as colors from "./marker_color";
import * as icons from "./marker_icons";

const MARKER_CLASSES = {
  active: "marker-point-active",
  hovered: "is-hovered",
  hoverable: "hoverable",
  tapHighlight: "tap-highlight",
  updating: "updating"
};

const POINT_MODELS = {
  1: { 
    name: 'unimplemented', 
    handler: null,
    isUserMessage: false,
    needsScatter: false
  },
  2: { 
    name: 'sensor', 
    handler: 'addMarker',
    isUserMessage: false,
    needsScatter: true
  },
  3: { 
    name: 'sensor', 
    handler: 'addMarker',
    isUserMessage: false,
    needsScatter: true
  },
  4: { 
    name: 'user_message', 
    handler: 'addMarkerUser',
    isUserMessage: true,
    needsScatter: false
  }
};

const messageTypes = {
  0: "text",
  1: "air",
  2: "garbage",
  3: "water",
  4: "fire",
  5: "forest",
  6: "alert",
  7: "notif",
  8: "recycle",
  9: "parking",
  42: "gank",
};

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const queue = new Queue();
let markersLayer;
let map;
let markerClickHandler;
let activeMarker = null; // Текущий активный маркер

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

let messageIconName = {};
let messageIconType = {};
const messagesLayers = Object.values(messageTypes).reduce((result, item) => {
  result[item] = null;
  return result;
}, {});


const IS_TOUCH =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);



/*
  Less aggressive clustering + "spiderfying" nearby points.
  We override default MarkerClusterGroup settings so that:
   - Clusters form later (smaller radius).
   - At high zoom levels clustering is disabled.
   - Spiderfy is used instead of zoom-to-bounds on click.
*/
function createClusterGroup(iconCreateFn, unit = null) {
  return new L.MarkerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius(zoom) {
      // Smaller radius → clusters form later; radius shrinks as zoom increases
      return Math.max(6, 20 - zoom * 3.2);
    },
    disableClusteringAtZoom: 18,
    spiderfyOnEveryZoom: false,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.8,
    zoomToBoundsOnClick: false, // we implement custom click handling
    spiderfyOnClick: false, // we handle spiderfy manually
    chunkedLoading: true, // performance boost for many markers
    chunkDelay: 30,
    chunkInterval: 200,
    removeOutsideVisibleBounds: true,
    iconCreateFunction: (cluster) => iconCreateFn(cluster, unit),
  });
}


/**
 * Прикрепляет все события к маркеру (включая клик)
 */
function attachMarkerEvents(marker, clickCallback) {
  if (!marker || marker.__handlersAttached) return;
  marker.__handlersAttached = true;

  marker.on("mouseover", () => {
    if (marker._icon) {
      marker._icon.classList.add(MARKER_CLASSES.hovered);
    }
  });

  marker.on("mouseout", () => {
    if (marker._icon) {
      marker._icon.classList.remove(MARKER_CLASSES.hovered);
    }
  });

  marker.on("add", () => {
    if (marker._icon) {
      marker._icon.style.pointerEvents = "auto";
      marker._icon.style.zIndex = marker._icon.style.zIndex || "500000";
      marker._icon.classList.add(MARKER_CLASSES.hoverable);
    }
  });

  // Обработка клика
  marker.on("click", (event) => {
    // Touch highlight для мобильных устройств
    if (IS_TOUCH && marker._icon) {
      marker._icon.classList.add(MARKER_CLASSES.tapHighlight);
      setTimeout(() => marker._icon.classList.remove(MARKER_CLASSES.tapHighlight), 550);
    }

    // Устанавливаем активную область карты
    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ) {
      map.setActiveArea({
        position: "absolute",
        top: "90px",
        left: "0px",
        right: "0px",
        height: "20%",
      });
    } else {
      map.setActiveArea({
        position: "absolute",
        top: "0px",
        left: "0px",
        right: "50%",
        height: "100%",
      });
    }

    map.panTo(event.latlng);

    
    if (clickCallback) {
      clickCallback(event.target.options.data);
    }
  });
}


/**
 * Прикрепляет события к кластеру
 */
function attachClusterEvents(layer, clickHandler) {

  layer.on("clusterclick", (e) => {
    const cluster = e.layer;
    const childCount = cluster.getChildCount();
    const nowZoom = map.getZoom();
    const targetZoom = map.getBoundsZoom(cluster.getBounds(), true);
    
    // если много детей или далеко - зуммируем
    if (childCount > 15 || (targetZoom - nowZoom) > 2) {
      e.originalEvent?.preventDefault?.();
      e.originalEvent?.stopPropagation?.();
      
      map.fitBounds(cluster.getBounds(), {
        padding: [20, 20],
        animate: true,
        maxZoom: Math.min(targetZoom, 18),
      });
    } else {
      // Иначе просто spiderfy
      try { 
        cluster.spiderfy(); 
      } catch (error) {
        console.warn('Spiderfy failed:', error);
      }
    }
  });

  // Обработка spiderfied события
  layer.on("spiderfied", (e) => {
    if (Array.isArray(e.markers)) {
      e.markers.forEach((marker) => {
        attachMarkerEvents(marker, clickHandler);
      });
    }
  });

}

/**
 * Apply deterministic scatter to coordinates based on a unique seed.
 *
 * Purpose:
 *   Sensors or markers located very close to each other often overlap visually on the map.
 *   This function slightly offsets each point (by up to ~`meters`) in a deterministic way
 *   so that nearby points become distinguishable without randomly "jumping" on reload.
 *
 * How it works:
 *   - Converts input lat/lng to numbers, safely handling invalid values.
 *   - Generates a pseudo-random but deterministic hash from the `seed` (e.g. sensor_id).
 *   - Uses that hash to pick an angle and a distance within the given radius (`meters`).
 *   - Converts the offset from meters to degrees, accounting for latitude distortion.
 *   - Returns a slightly shifted [lat, lng] that is stable for the same `seed`.
 *
 * @param {[number|string, number|string]} coords  Original [lat, lng] (may be strings).
 * @param {string|number} seed  Unique identifier (e.g. sensor_id) to ensure deterministic offset.
 * @param {number} [meters=15]  Maximum scatter radius in meters.
 * @returns {[number, number]}  Adjusted coordinates with scatter applied.
 */
function scatterCoords([latRaw, lngRaw], seed, meters = 15) {
  const lat0 = Number(latRaw);
  const lng0 = Number(lngRaw);

  // If lat/lng cannot be parsed as numbers, return as-is
  if (!Number.isFinite(lat0) || !Number.isFinite(lng0)) return [lat0, lng0];

  // Create a deterministic hash from the seed
  let h = 5381 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }

  // Generate repeatable pseudo-random values in [0, 1)
  const rnd01 = (x) => ((x >>> 0) % 1000) / 1000;

  // Pick jitter direction (angle) and distance
  const ang = rnd01(h) * 2 * Math.PI;
  const dist = rnd01(h ^ 0x9e3779b9) * meters;

  // Offset in meters
  const dx = Math.cos(ang) * dist;
  const dy = Math.sin(ang) * dist;

  // Convert meter offsets to degrees
  const dLat = dy / 111111; // ~111.1 km per degree latitude
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  const denom = 111111 * (Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat); // Avoid poles
  const dLng = dx / denom;

  const lat = lat0 + dLat;
  const lng = lng0 + dLng;

  // Only return jittered coords if valid numbers
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [lat0, lng0];
}

// createIconHTML is now imported from marker_icons.js

/**
 * Устанавливает защиту от рекурсии для map.panInsideBounds и map.setView (это нужно после того, как ввелся функционал ограничения карты для форков)
 * Предотвращает бесконечную рекурсию при вызовах этих методов в обработчиках событий
 * @param {Object} mapInstance - Экземпляр карты Leaflet
 */
function setupRecursionProtection(mapInstance) {
  let isPanningInsideBounds = false;
  let isSettingView = false;
  
  const originalPanInsideBounds = mapInstance.panInsideBounds;
  mapInstance.panInsideBounds = function(bounds, options) {
    if (isPanningInsideBounds) {
      console.warn('Prevented recursive panInsideBounds call');
      return this;
    }
    isPanningInsideBounds = true;
    try {
      const result = originalPanInsideBounds.call(this, bounds, options);
      return result;
    } finally {
      setTimeout(() => {
        isPanningInsideBounds = false;
      }, 50); // Оптимизированная задержка
    }
  };
  
  const originalSetView = mapInstance.setView;
  mapInstance.setView = function(center, zoom, options) {
    if (isSettingView) {
      console.warn('Prevented recursive setView call');
      return this;
    }
    isSettingView = true;
    try {
      const result = originalSetView.call(this, center, zoom, options);
      return result;
    } finally {
      setTimeout(() => {
        isSettingView = false;
      }, 50); // Оптимизированная задержка
    }
  };
}

/**
 * Проверяет, готовы ли слои маркеров для работы
 * @returns {boolean} true если слои инициализированы
 */
export function isReadyLayers() {
  return !!markersLayer;
}

/**
 * Upsert маркер: создает новый или обновляет существующий
 * @param {Object} point - Данные точки
 * @param {Object} colors - Цвета для маркера
 * @param {string} [sensor_id] - ID сенсора для поиска существующего маркера (опционально)
 * @returns {Object} - { marker: Object, isNew: boolean } - Обработанный маркер и флаг новизны
 */
function upsertMarker(point, colors, sensor_id = null) {
  const modelConfig = POINT_MODELS[point.model] || {};
  
  // Вычисляем координаты
  const coord = modelConfig.needsScatter 
    ? scatterCoords([point.geo.lat, point.geo.lng], point.sensor_id)
    : [point.geo.lat, point.geo.lng];
  
  // Определяем тип маркера
  let markerType;
  if (sensors[point.sensor_id] && sensors[point.sensor_id].icon) {
    markerType = "brand";
  } else if (point.data && point.data.windang) {
    markerType = "arrow";
  } else if (modelConfig.isUserMessage) {
    markerType = "msg";
      } else {
    markerType = "circle";
  }

  // Ищем существующий маркер
  const existingMarker = sensor_id ? findMarker(sensor_id) : null;
  
  // Если маркер существует, обновляем его
  if (existingMarker) {
    // Update marker data first
    existingMarker.options.data = point;
    existingMarker.options.typeMarker = markerType;
    
    // Обновляем иконку в зависимости от типа
    if (markerType === "brand") {
      existingMarker.setIcon(icons.createIconPointImage(point.sensor_id, sensors));
    } else if (markerType === "arrow" && point.data && Object.prototype.hasOwnProperty.call(point.data, "windang")) {
      existingMarker.setIcon(icons.createIconPointWind(point.data.windang, point.data.windspeed, colors.basic));
    } else if (markerType === "msg") {
      existingMarker.setIcon(icons.createIconPointMessage(point.measurement?.type || 0, messageIconType));
    } else {
      existingMarker.setIcon(icons.createIconPointDefault(colors, point.isBookmarked, point.sensor_id));
    }
    
    // Применяем вычисленные координаты
    existingMarker.setLatLng(new L.LatLng(coord[0], coord[1]));
    
    return { marker: existingMarker, isNew: false };
  }
  
  // Создаем новый маркер
  let marker;
  if (markerType === "brand") {
    marker = icons.createMarkerBrand(coord, point, colors, sensors);
  } else if (markerType === "arrow") {
    marker = icons.createMarkerArrow(coord, point, colors);
  } else if (markerType === "msg") {
    marker = icons.createMarkerUser(coord, point, messageIconType);
        } else {
    marker = icons.createMarkerCircle(coord, point, colors);
  }
  
  return { marker, isNew: true };
}


/**
 * Добавляет маркер на карту (обычный или пользовательский)
 * @param {Object} point - Данные точки
 * @param {string} [unit] - Единица измерения
 * @param {string} [markerType='sensor'] - Тип маркера: 'sensor' или 'userMessage'
 */
async function addMarker(point, unit = null, markerType = 'sensor') {
  // пропускаем датчики с «нулевой» геопозицией
  const tolerance = 0.001;
  const lat = Number(point.geo.lat);
  const lng = Number(point.geo.lng);
  if (Math.abs(lat) < tolerance && Math.abs(lng) < tolerance) {
    return;
  }

  // Определяем цвета в зависимости от типа маркера
  const isUserMessage = markerType === 'userMessage';
  const markerColors = colors.getMarkerColors(point, unit, isUserMessage);
  
  const { marker, isNew } = upsertMarker(point, markerColors, point.sensor_id);
  
  if (isNew) {
    // Добавляем класс обновления для визуальной обратной связи
    const iconElement = marker.getElement();
    if (iconElement) {
      iconElement.classList.add(MARKER_CLASSES.updating);
    }
    
    // Прикрепляем все события включая клик для нового маркера
    attachMarkerEvents(marker, markerClickHandler);

    // Определяем слой для добавления маркера
    if (isUserMessage && point.measurement && messageTypes[point.measurement.type]) {
      // Для пользовательских сообщений добавляем в соответствующий слой сообщений
      const messageLayer = messagesLayers[messageTypes[point.measurement.type]];
      if (messageLayer) {
        messageLayer.addLayer(marker);
      }
  } else {
      // Для обычных маркеров добавляем в основной слой
      if (markersLayer) {
        markersLayer.addLayer(marker);
      }
    }
    
    // Убираем класс обновления после добавления на карту
    setTimeout(() => {
      if (iconElement) {
        iconElement.classList.remove(MARKER_CLASSES.updating);
      }
    }, 800);
  }
  // Для существующего маркера ничего дополнительного не нужно - он уже обновлен
}



function findMarker(sensor_id) {
  if (!markersLayer) return false;
  
      let found = false;
      markersLayer.eachLayer((m) => {
    if (!found && m.options.data?.sensor_id === sensor_id) {
          found = m;
        }
      });
  
  return found || false;
}


/**
 * Очищает все маркеры с карты (основные и сообщения)
 */
export function clearAllMarkers() {
  if (markersLayer) {
    markersLayer.clearLayers();
  }
  for (const messagesLayer of Object.values(messagesLayers)) {
    if (messagesLayer) {
      messagesLayer.clearLayers();
    }
  }
}



export async function addPoint(point, unit = null) {
  queue.add(makeRequest.bind(queue, point, unit));
  async function makeRequest(point, unit) {
    try {
      const modelConfig = POINT_MODELS[point.model];
      
      if (!modelConfig) {
        console.warn(`Unknown model ${point.model} for sensor ${point.sensor_id}`);
        return;
      }
      
      if (!modelConfig.handler) {
        console.warn(`Model ${point.model} (${modelConfig.name}) not implemented for sensor ${point.sensor_id}`);
        return;
      }
      
      // Вызываем соответствующий обработчик
      if (modelConfig.handler === 'addMarker') {
        await addMarker(point, unit, 'sensor');
      } else if (modelConfig.handler === 'addMarkerUser') {
        await addMarker(point, unit, 'userMessage');
      }
      
    } catch (error) {
      console.error(`Error processing point for sensor ${point.sensor_id}:`, error);
    }
    this.next();
  }
}


export function switchMessagesLayer(map, enabled = false) {
  for (const messagesLayer of Object.values(messagesLayers)) {
    if (messagesLayer) {
      if (enabled) {
        map.addLayer(messagesLayer);
    } else {
        map.removeLayer(messagesLayer);
      }
    }
  }
}


export function refreshClusters() {
  if (markersLayer) {
    markersLayer.refreshClusters();
  }
}

/**
 * Устанавливает активный маркер по sensor_id
 * @param {string} sensorId - ID сенсора
 */
export function setActiveMarker(sensorId) {
  // Убираем активность с предыдущего маркера
  clearActiveMarker();
  
  // Находим маркер по sensor_id
  const marker = findMarker(sensorId);
  if (marker) {
    // Добавляем CSS класс для активного маркера
    const element = marker.getElement();
    if (element) {
      element.classList.add(MARKER_CLASSES.active);
      activeMarker = marker;
    }
  }
}

/**
 * Убирает активность с текущего маркера
 */
export function clearActiveMarker() {
  if (activeMarker) {
    const element = activeMarker.getElement();
    if (element) {
      element.classList.remove(MARKER_CLASSES.active);
    }
    activeMarker = null;
  }
}

/**
 * Переключает активность маркера (если уже активен - убирает, если нет - делает активным)
 * @param {string} sensorId - ID сенсора
 */
export function toggleActiveMarker(sensorId) {
  const marker = findMarker(sensorId);
  if (marker && activeMarker === marker) {
    // Если маркер уже активен - убираем активность
    clearActiveMarker();
  } else {
    // Иначе делаем его активным
    setActiveMarker(sensorId);
  }
}

/**
 * Инициализирует систему маркеров на карте
 * @param {Object} mapInstance - Экземпляр карты Leaflet
 * @param {Function} cb - Callback функция для обработки кликов по маркерам
 * @param {string} unit - Единица измерения (pm10, pm25, temperature, etc.)
 */
export async function init(mapInstance, cb, unit = null) {
  map = mapInstance;
  
  // Загружаем иконки сообщений
  for (const index of Object.keys(messageTypes)) {
    try {
      messageIconType[index] = (
        await import(`../../assets/images/message/msg-${messageTypes[index]}.png`)
      ).default;
      } catch (error) {
      messageIconType[index] = (await import(`../../assets/images/message/msg-text.png`)).default;
    }
    messageIconName[messageTypes[index]] = messageIconType[index];
  }

  // Создаем основной слой маркеров
  markersLayer = createClusterGroup((cluster) => icons.createIconClusterDefault(cluster, unit, colors.getClusterWinningColor, colors.getBorderColor, colors.isDarkColor), unit);
  map.addLayer(markersLayer);

  // Создаем обработчик клика для маркеров
  markerClickHandler = (data) => cb(data);

  // Устанавливаем защиту от рекурсии
  setupRecursionProtection(map);
  
  // Создаем слои для сообщений и сразу прикрепляем события
  for (const type of Object.values(messageTypes)) {
    const layer = createClusterGroup((cluster) => icons.createIconClusterMessages(cluster, type, messageIconName), unit);
    messagesLayers[type] = layer;
    attachClusterEvents(layer, markerClickHandler);
  }

  // Прикрепляем события к основному слою маркеров
  attachClusterEvents(markersLayer, markerClickHandler);

}