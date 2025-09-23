/**
 * Icon creation utilities for markers and clusters
 * Centralized icon creation logic for consistent UI across the application
 */

import L from "leaflet";
import { DEFAULT_COLORS } from "./colors";

// Icon configuration
export const ICON_CONFIG = {
  cluster: {
    iconSize: new L.Point(40, 40),
    className: "marker-cluster",
    ...DEFAULT_COLORS.cluster
  },
  point: {
    iconSize: new L.Point(30, 30),
    className: "marker-point",
    ...DEFAULT_COLORS.point
  }
};

/**
 * Creates HTML for icon content
 * @param {Object} params - Parameters for icon creation
 * @param {string|number} text - Text to display (will be wrapped in span)
 * @param {string} image - Image URL (will be wrapped in img)
 * @param {string} color - Icon color (will be passed as CSS variable --color)
 * @param {Object} container - Container parameters
 * @param {string} container.class - CSS class for wrapper
 * @param {string} container.style - Inline styles for wrapper
 * @param {Object} container.attributes - Attributes for wrapper (data-*, id, etc.)
 * @returns {string} HTML string
 */
export function createIconHTML({ text, image, color, container = {} }) {
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
 * Creates default cluster icon
 * @param {Object} cluster - Leaflet cluster object
 * @param {string} unit - Measurement unit
 * @param {Function} getClusterWinningColor - Function to get winning color
 * @param {Function} getBorderColor - Function to get border color
 * @param {Function} isDarkColor - Function to check if color is dark
 * @returns {L.DivIcon} Cluster icon
 */
export function createIconClusterDefault(cluster, unit = null, getClusterWinningColor, getBorderColor, isDarkColor) {
  try {
    const markers = cluster.getAllChildMarkers();
    const childCount = cluster.getChildCount();
    let childCountCalc = 0;
    const markersId = [];
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
  
    // Use new color calculation functions
    const validMarkers = markers.filter(marker => {
      const data = marker.options.data;
      if (!data || data.value === undefined || data.value === "") return false;
      markersId.push(data._id);
      childCountCalc++;
      return true;
    });
    
    let color = ICON_CONFIG.cluster.initColor; // default color
    let colorBorder = ICON_CONFIG.cluster.initBorderColor;
    let isDark = false;
    
    if (unit && childCountCalc > 0) {
      // Get winning color using new function
      color = getClusterWinningColor(validMarkers, unit);
      colorBorder = getBorderColor(color);
      isDark = isDarkColor(color);
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
    console.error("Error creating cluster icon:", error);
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

/**
 * Creates message cluster icon
 * @param {Object} cluster - Leaflet cluster object
 * @param {string} type - Message type
 * @param {Object} messageIconName - Message icon mapping
 * @returns {L.DivIcon} Message cluster icon
 */
export function createIconClusterMessages(cluster, type = "text", messageIconName) {
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

/**
 * Creates default point icon
 * @param {Object} colors - Colors object
 * @param {boolean} isBookmarked - Whether point is bookmarked
 * @param {string} id - Point ID
 * @returns {L.DivIcon} Point icon
 */
export function createIconPointDefault(colors, isBookmarked, id) {
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

/**
 * Creates image point icon
 * @param {string} sensor_id - Sensor ID
 * @param {Object} sensors - Sensors data
 * @returns {L.DivIcon} Image point icon
 */
export function createIconPointImage(sensor_id, sensors) {
  return L.divIcon({
    html: createIconHTML({
      image: sensors[sensor_id].icon
    }),
    iconSize: ICON_CONFIG.point.iconSize,
    className: ICON_CONFIG.point.className,
  });
}

/**
 * Creates message point icon
 * @param {number} type - Message type
 * @param {Object} messageIconType - Message icon type mapping
 * @returns {L.DivIcon} Message point icon
 */
export function createIconPointMessage(type = 0, messageIconType) {
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

/**
 * Creates wind arrow point icon
 * @param {number} dir - Wind direction
 * @param {number} speed - Wind speed
 * @param {string} color - Arrow color
 * @returns {L.DivIcon} Wind arrow icon
 */
export function createIconPointWind(dir, speed, color) {
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
    className: ICON_CONFIG.point.className,
  });
}

/**
 * Creates brand marker
 * @param {Array} coord - Coordinates [lat, lng]
 * @param {Object} data - Marker data
 * @param {Object} colors - Colors object
 * @param {Object} sensors - Sensors data
 * @returns {L.Marker} Brand marker
 */
export function createMarkerBrand(coord, data, colors, sensors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointImage(data.sensor_id, sensors),
    data: data,
    typeMarker: "brand",
  });
}

/**
 * Creates arrow marker
 * @param {Array} coord - Coordinates [lat, lng]
 * @param {Object} data - Marker data
 * @param {Object} colors - Colors object
 * @returns {L.Marker} Arrow marker
 */
export function createMarkerArrow(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointWind(data.data.windang, data.data.windspeed, colors.basic),
    data: data,
    typeMarker: "arrow",
  });
}

/**
 * Creates circle marker
 * @param {Array} coord - Coordinates [lat, lng]
 * @param {Object} data - Marker data
 * @param {Object} colors - Colors object
 * @returns {L.Marker} Circle marker
 */
export function createMarkerCircle(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointDefault(colors, data.isBookmarked, data.sensor_id),
    data: data,
    typeMarker: "circle",
  });
}

/**
 * Creates user message marker
 * @param {Array} coord - Coordinates [lat, lng]
 * @param {Object} data - Marker data
 * @param {Object} messageIconType - Message icon type mapping
 * @returns {L.Marker} User message marker
 */
export function createMarkerUser(coord, data, messageIconType) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPointMessage(data.measurement?.type || 0, messageIconType),
    data: data,
    typeMarker: "msg",
  });
}
