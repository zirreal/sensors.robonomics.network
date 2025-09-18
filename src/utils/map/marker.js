/**
 * REMOVED FUNCTIONALITY:
 * - moveLayer and moveMarkerTime: Marker animation functionality (added in commit 7f8e804, never used)
 * - pathsLayer and path functions: Path drawing functionality (addPointPath, showPath, hidePath)
 * 
 * These features were added for mobile marker animation but were never fully 
 * implemented in the UI or caused more complexity than benefit. Removed to reduce code 
 * complexity and maintainability.
 */

import { settings, sensors } from "@config";
import Queue from "js-queue";
import L from "leaflet";
import "leaflet-arrowheads";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { getMeasurementByName } from "../../measurements/tools";

// Icon configuration
const ICON_CONFIG = {
  cluster: {
    iconSize: new L.Point(40, 40),
    className: "marker-cluster",
    initColor: "#a1a1a1", // default gray color
    initBorderColor: "#999"
  },
  point: {
    iconSize: new L.Point(30, 30),
    className: "marker-point",
    initColor: "#a1a1a1", // default gray color
    initBorderColor: "#999"
  }
};

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const queue = new Queue();
let markersLayer;
let map;
let markerClickHandler;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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
function createClusterGroup(iconCreateFn) {
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
    iconCreateFunction: iconCreateFn,
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
      marker._icon.classList.add("is-hovered");
    }
  });

  marker.on("mouseout", () => {
    if (marker._icon) {
      marker._icon.classList.remove("is-hovered");
    }
  });

  marker.on("add", () => {
    if (marker._icon) {
      marker._icon.style.pointerEvents = "auto";
      marker._icon.style.zIndex = marker._icon.style.zIndex || "500000";
      marker._icon.classList.add("hoverable");
    }
  });

  // Обработка клика
  marker.on("click", (event) => {
    // Touch highlight для мобильных устройств
    if (IS_TOUCH && marker._icon) {
      marker._icon.classList.add("tap-highlight");
      setTimeout(() => marker._icon.classList.remove("tap-highlight"), 550);
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

/**
 * Создает унифицированный HTML для иконок с единой оберткой
 * @param {string|number} text - Текст для отображения (будет обернут в span)
 * @param {string} image - URL изображения (будет обернут в img)
 * @param {string} color - Цвет иконки (будет передан как CSS переменная --color)
 * @param {Object} container - Объект с параметрами контейнера
 * @param {string} container.class - CSS класс для обертки
 * @param {string} container.style - Inline стили для обертки
 * @param {Object} container.attributes - Атрибуты для обертки (data-*, id, etc.)
 * @returns {string} HTML строка
 */
function createIconHTML({ text, image, color, container = {} }) {
  const { class: wrapperClass = '', style: wrapperStyle = '', attributes = {} } = container;
  
  // Определяем содержимое
  let content = '';
  if (image) {
    content = `<img src="${image}" alt="">`;
  } else if (text !== undefined && text !== null) {
    content = `<span>${text}</span>`;
  }
  
  // Формируем атрибуты
  const attrsString = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  // Добавляем CSS переменную для цвета
  const colorStyle = color ? `--color: ${color};` : '';
  const finalStyle = `${colorStyle}${wrapperStyle}`;
  
  return `<div class="icon ${wrapperClass}" style="${finalStyle}" ${attrsString}>${content}</div>`;
}

/**
 * Устанавливает защиту от рекурсии для map.panInsideBounds и map.setView
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



function createIconClusterDefault(cluster) {
  try {
  const markers = cluster.getAllChildMarkers();
  const childCount = cluster.getChildCount();
  let childCountCalc = 0;
  const markersId = [];
    const unit = localStorage.getItem("currentUnit") ?? null;
    let winningColor = ICON_CONFIG.cluster.initColor; // default color
    
    
    
    // Early return if no markers
    if (childCount === 0 || markers.length === 0) {
      
      return new L.DivIcon({
        html: createIconHTML({
          text: childCount,
          color: ICON_CONFIG.cluster.initColor,
          container: {
            class: 'marker-cluster-circle',
            attributes: { 'data-children': '' }
          }
        }),
        className: ICON_CONFIG.cluster.className,
        iconSize: ICON_CONFIG.cluster.iconSize,
      });
    }
  
    // Regular measurement handling - count zones instead of averaging
    const zoneCounts = new Map(); // zone color -> count
    
    // Sort markers by sensor_id for consistent results across zooms
    const sortedMarkers = [...markers].sort((a, b) => {
      const idA = a.options.data?.sensor_id || '';
      const idB = b.options.data?.sensor_id || '';
      return idA.localeCompare(idB);
    });
    
    sortedMarkers.forEach((marker) => {
      // Skip markers without data
      if (marker.options.data.value === undefined || marker.options.data.value === "") {
      return;
    }

    markersId.push(marker.options.data._id);

    childCountCalc++;
      const value = marker.options.data.value;

      
      // Get color for this marker's value using unified method
      const markerColor = getColorForValue(value, unit, marker.options.data);
      
      // Count this zone
      zoneCounts.set(markerColor, (zoneCounts.get(markerColor) || 0) + 1);
    });
    
    // Find the winning zone (most common color)
    let maxCount = 0;
    for (const [color, count] of zoneCounts) {
      if (count > maxCount) {
        maxCount = count;
        winningColor = color;
    }
  }
  
  // Use the winning zone color
  let color = "#a1a1a1"; // default color
  let colorBorder = "#999";
  let isDark = false;
  
  if (unit && childCountCalc > 0) {
    // Use the winning color from zone counting
    color = winningColor;
    
    // Convert color to RGB for border calculation
    const tempEl = document.createElement('div');
    tempEl.style.color = color;
    document.body.appendChild(tempEl);
    const computedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);
    
    if (computedColor.startsWith('rgb')) {
      const rgb = computedColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = parseInt(rgb[0]);
        const g = parseInt(rgb[1]);
        const b = parseInt(rgb[2]);
        colorBorder = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
        isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 128;
      }
    }
  }


  return new L.DivIcon({
    html: createIconHTML({
      text: childCount,
      color: color,
      container: {
        class: 'marker-cluster-circle',
        attributes: { 'data-children': markersId }
      }
    }),
    className: ICON_CONFIG.cluster.className,
    iconSize: ICON_CONFIG.cluster.iconSize,
  });
  } catch (error) {
    console.error(`createIconClusterDefault error: ${error.message}`, error);
    // Return default cluster on error
    return new L.DivIcon({
      html: createIconHTML({
        text: cluster.getChildCount(),
        color: ICON_CONFIG.cluster.initColor,
        container: {
          class: 'marker-cluster-circle',
          attributes: { 'data-children': '' }
        }
      }),
      className: ICON_CONFIG.cluster.className,
      iconSize: ICON_CONFIG.cluster.iconSize,
    });
  }
}

function createIconClusterMessages(cluster, type = "text") {
  const childCount = cluster.getChildCount();
  return new L.DivIcon({
    html: createIconHTML({
      text: childCount,
      container: {
        class: 'marker-cluster-msg',
        style: `background-image: url(${messageIconName[type]});`,
        attributes: { 'data-count-type': type }
      }
    }),
    className: ICON_CONFIG.cluster.className,
    iconSize: ICON_CONFIG.cluster.iconSize,
  });
}



function createIconPointDefault(colors, isBookmarked, id) {
  return new L.DivIcon({
    html: createIconHTML({
      color: colors.basic,
      container: {
        class: `marker-cluster-circle ${isBookmarked ? "sensor-bookmarked" : ""}`,
        attributes: { 'data-id': id ?? "" }
      }
    }),
    className: ICON_CONFIG.point.className,
    iconSize: ICON_CONFIG.point.iconSize,
  });
}

function createIconPointImage(sensor_id) {
  return L.divIcon({
    html: createIconHTML({
      image: sensors[sensor_id].icon
    }),
    iconSize: ICON_CONFIG.point.iconSize,
    className: ICON_CONFIG.point.className,
  });
}

function createIconPointMessage(type = 0) {
  return L.divIcon({
    html: createIconHTML({
      image: messageIconType[type],
      container: {
        class: 'marker-icon-msg'
      }
    }),
    iconSize: ICON_CONFIG.point.iconSize,
    className: ICON_CONFIG.point.className,
  });
}

function createIconPointWind(dir, speed, color) {
  return L.divIcon({
    className: "",
    html: createIconHTML({
      text: `<div class="icon-arrow-container" style="transform: rotate(${dir + 90}deg);">
        <div class="icon-arrow" style="border-color: ${color} ${color} transparent transparent;">
          <div style="background-color: ${color};"></div>
        </div>
        <div class="label-arrow">${speed} m/s</div>
      </div>`
    }),
    iconSize: ICON_CONFIG.point.iconSize,
  });
}



function createMarkerBrand(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointImage(data.sensor_id),
    data: data,
    typeMarker: "brand",
  });
}

function createMarkerArrow(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointWind(data.data.windang, data.data.windspeed, colors.basic),
    data: data,
    typeMarker: "arrow",
  });
}

function createMarkerCircle(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointDefault(colors, data.isBookmarked, data.sensor_id),
    data: data,
    typeMarker: "circle",
  });
}

function createMarkerUser(coord, data) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointMessage(data.measurement?.type || 0),
    data: data,
    typeMarker: "msg",
  });
}

function createMarker(point, colors) {
  // применяем scatter для визуального разведения близких точек
  const coord = scatterCoords([point.geo.lat, point.geo.lng], point.sensor_id);
  let marker;
  if (sensors[point.sensor_id] && sensors[point.sensor_id].icon) {
    marker = createMarkerBrand(coord, point, colors);
  } else if (point.data.windang) {
    marker = createMarkerArrow(coord, point, colors);
  } else if (point.model === 4) {
    marker = createMarkerUser(coord, point);
  } else {
    marker = createMarkerCircle(coord, point, colors);
  }
  return marker;
}

function updateMarker(marker, point, colors) {
  // Update marker data first
  marker.options.data = point;
  
  if (marker.options.typeMarker === "brand") {
    marker.setIcon(createIconPointImage(point.sensor_id));
  } else if (
    marker.options.typeMarker === "arrow" &&
    Object.prototype.hasOwnProperty.call(point.data, "windang")
  ) {
    marker.setIcon(createIconPointWind(point.data.windang, point.data.windspeed, colors.basic));
  } else {
    marker.setIcon(createIconPointDefault(colors, point.isBookmarked, point.sensor_id));
  }
  if (point.model === 3) {
    const coord = scatterCoords([point.geo.lat, point.geo.lng], point.sensor_id);
    marker.setLatLng(new L.LatLng(coord[0], coord[1]));
  }
}

function findMarker(sensor_id) {
  return new Promise((resolve) => {
    if (markersLayer) {
      let found = false;
      markersLayer.eachLayer((m) => {
        if (!found && m.options.data.sensor_id === sensor_id) {
          found = m;
        }
      });
      if (found) return resolve(found);
    }
    resolve(false);
  });
}

export async function addPoint(point) {
  queue.add(makeRequest.bind(queue, point));
  async function makeRequest(point) {
    try {
      if (point.model === 1) {
        // Handle model 1 if needed
      } else if (point.model === 2) {
        await addMarker(point);
      } else if (point.model === 3) {
        await addMarker(point);
      } else if (point.model === 4) {
        await addMarkerUser(point);
      }
    } catch (error) {
      // Handle error silently
    }
    this.next();
  }
}





/**
 * Universal color calculation method for both individual markers and clusters
 * @param {number|null} value - The value to get color for
 * @param {string} unit - The measurement unit (pm10, pm25, temperature, etc.)
 * @param {Object} point - The point data
 * @returns {string} - The color for the value
 */
function getColorForValue(value, unit, point = null) {
  // Regular measurement handling
  if (value === null || value === undefined || isNaN(value)) {
    return "#a1a1a1"; // Default color for no data
  }
  
  const scaleParams = getMeasurementByName(unit);
  const zones = scaleParams?.zones || [];
  if (unit && zones.length > 0) {
    const match = zones.find((i) => value <= i?.valueMax);
    if (match) {
      return match.color;
    } else if (!zones[zones.length - 1]?.valueMax) {
      return zones[zones.length - 1].color;
    }
  }

  return "#a1a1a1"; // Default color
}

function markercolor(value, point = null) {
  const unit = localStorage.getItem("currentUnit") ?? null;
  return getColorForValue(value, unit, point);
}

async function addMarker(point) {
  // пропускаем датчики с «нулевой» геопозицией
  const tolerance = 0.001;
  const lat = Number(point.geo.lat);
  const lng = Number(point.geo.lng);
  if (Math.abs(lat) < tolerance && Math.abs(lng) < tolerance) {
    return;
  }

  const colors = {
    basic: "#a1a1a1",
    border: "#999",
    rgb: [161, 161, 161],
  };
  if (!point.isEmpty) {
    const color = markercolor(point.value, point);
    colors.basic = color;
    colors.border = color;
  }
  const marker = await findMarker(point.sensor_id);
  if (!marker) {
    const m = createMarker(point, colors);

    // Прикрепляем все события включая клик
    attachMarkerEvents(m, markerClickHandler);

    if (markersLayer) {
      markersLayer.addLayer(m);
    }
    } else {
    // Always update existing marker, even if empty
    updateMarker(marker, point, colors);
  }
}



async function addMarkerUser(point) {
  // пропускаем «нулевые» координаты
  const tolerance = 0.001;
  const lat = Number(point.geo.lat);
  const lng = Number(point.geo.lng);
  if (Math.abs(lat) < tolerance && Math.abs(lng) < tolerance) {
    return;
  }

  const colors = {
    basic: "#f99981",
    border: "#999",
    rgb: [161, 161, 161],
  };
  const marker = await findMarker(point.sensor_id);
  if (!marker) {
    const m = createMarker(point, colors);

    // figure out the layer where this user marker will live
    const layer =
      point.measurement &&
      messageTypes[point.measurement.type] &&
      messagesLayers[messageTypes[point.measurement.type]]
        ? messagesLayers[messageTypes[point.measurement.type]]
        : null;

    // Прикрепляем все события включая клик
    attachMarkerEvents(m, markerClickHandler);

    if (
      point.measurement &&
      messageTypes[point.measurement.type] &&
      messagesLayers[messageTypes[point.measurement.type]]
    ) {
      messagesLayers[messageTypes[point.measurement.type]].addLayer(m);
    }
  }
}

export function clear() {
  if (markersLayer) {
    markersLayer.clearLayers();
  }
  for (const messagesLayer of Object.values(messagesLayers)) {
    if (messagesLayer) {
      messagesLayer.clearLayers();
    }
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


// Function to set all markers to gray color (loading state)
export function setAllMarkersGray() {
  if (!markersLayer) return;
  
  const grayColors = {
    basic: "#a1a1a1",
    border: "#999",
    rgb: [161, 161, 161],
  };
  
  // Update all markers in the layer
  markersLayer.eachLayer((layer) => {
    if (layer.options.typeMarker === "brand") {
      layer.setIcon(createIconPointImage(layer.options.data.sensor_id));
    } else if (layer.options.typeMarker === "arrow") {
      layer.setIcon(createIconPointWind(0, 0, grayColors.basic));
    } else if (layer.options.typeMarker === "circle") {
      layer.setIcon(createIconPointDefault(grayColors, false, layer.options.data.sensor_id));
    }
  });
  
  // Refresh clusters to update their colors
  refreshClusters();
}

/**
 * Инициализирует систему маркеров на карте
 * @param {Object} mapInstance - Экземпляр карты Leaflet
 * @param {string} type - Тип маркеров
 * @param {Function} cb - Callback функция для обработки кликов по маркерам
 */
export async function init(mapInstance, type, cb) {
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
  markersLayer = createClusterGroup(createIconClusterDefault);
  map.addLayer(markersLayer);

  // Создаем обработчик клика для маркеров
  markerClickHandler = (data) => cb(data);

  // Устанавливаем защиту от рекурсии
  setupRecursionProtection(map);
  
  // Создаем слои для сообщений и сразу прикрепляем события
  for (const type of Object.values(messageTypes)) {
    const layer = createClusterGroup((cluster) => createIconClusterMessages(cluster, type));
    messagesLayers[type] = layer;
    attachClusterEvents(layer, markerClickHandler);
  }

  // Прикрепляем события к основному слою маркеров
  attachClusterEvents(markersLayer, markerClickHandler);

  // Добавляем слои сообщений на карту если включены
  if (settings.SHOW_MESSAGES) {
    for (const messagesLayer of Object.values(messagesLayers)) {
      map.addLayer(messagesLayer);
    }
  }
}