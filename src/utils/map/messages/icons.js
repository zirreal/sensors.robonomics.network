/**
 * Message icon creation utilities
 * Handles creation of message markers and clusters with Font Awesome icons
 */

import L from "leaflet";

// Message icon configuration
export const ICON_CONFIG = {
  cluster: {
    iconSize: new L.Point(50, 50),
    className: "msg-cluster"
  },
  point: {
    iconSize: new L.Point(35, 35),
    className: "msg-point"
  }
};

/**
 * Creates HTML for message icon content
 * @param {Object} params - Parameters for icon creation
 * @param {string|number} text - Text to display (for clusters with count)
 * @param {Object} container - Container parameters
 * @param {string} container.class - CSS class for wrapper
 * @param {string} container.style - Inline styles for wrapper
 * @param {Object} container.attributes - Attributes for wrapper (data-*, id, etc.)
 * @returns {string} HTML string with Font Awesome message icon
 */
export function createIconHTML({ text, container = {} }) {
  const { class: wrapperClass = '', style: wrapperStyle = '', attributes = {} } = container;
  
  // Определяем содержимое
  let content = '';
  if (text !== null && text !== undefined) {
    // Кластер: иконка комментария + цифра сверху
    content = `
      <div class="msg-cluster-content">
        <svg viewBox="0 0 512 512" fill="currentColor"><path d="M144 208c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32zm112 0c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32zm112 0c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32zM256 32C114.6 32 0 125.1 0 240c0 47.6 19.9 91.2 52.9 126.6C38 405.7 7 439.1 6.5 439.5c-6.6 7-8.4 17.2-4.6 26S14.4 480 24 480c61.5 0 110-25.7 139.1-46.3C192 442.8 223.2 448 256 448c141.4 0 256-93.1 256-208S397.4 32 256 32z"/></svg>
        <span class="msg-count">${text}</span>
      </div>
    `;
  } else {
    // Одиночная точка: только иконка комментария
    content = `<svg viewBox="0 0 512 512" fill="currentColor"><path d="M144 208c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32zm112 0c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32zm112 0c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32zM256 32C114.6 32 0 125.1 0 240c0 47.6 19.9 91.2 52.9 126.6C38 405.7 7 439.1 6.5 439.5c-6.6 7-8.4 17.2-4.6 26S14.4 480 24 480c61.5 0 110-25.7 139.1-46.3C192 442.8 223.2 448 256 448c141.4 0 256-93.1 256-208S397.4 32 256 32z"/></svg>`;
  }
  
  // Формируем атрибуты
  const attrsString = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  const html = `<div class="msg-icon ${wrapperClass}" style="${wrapperStyle}" ${attrsString}>${content}</div>`;
  
  return html;
}

/**
 * Creates message cluster icon
 * @param {Object} cluster - Leaflet cluster object
 * @param {string} unit - Measurement unit (unused, kept for compatibility)
 * @returns {L.DivIcon} Message cluster icon with count and Font Awesome icon
 */
export function createIconCluster(cluster, unit = null) {
  try {
    const childCount = cluster.getChildCount();
    
    // Early return if no markers
    if (childCount === 0) {
      return new L.DivIcon({
        html: createIconHTML({
          text: childCount
        }),
        className: ICON_CONFIG.cluster.className,
        iconSize: ICON_CONFIG.cluster.iconSize,
      });
    }

    return new L.DivIcon({
      html: createIconHTML({
        text: childCount
      }),
      className: ICON_CONFIG.cluster.className,
      iconSize: ICON_CONFIG.cluster.iconSize,
    });
  } catch (error) {
    console.error("Error creating cluster icon:", error);
    return new L.DivIcon({
      html: createIconHTML({
        text: cluster.getChildCount()
      }),
      className: ICON_CONFIG.cluster.className,
      iconSize: ICON_CONFIG.cluster.iconSize,
    });
  }
}

/**
 * Creates message point icon
 * @param {Object} params - Parameters for icon creation
 * @param {string} params.id - Message ID
 * @returns {L.DivIcon} Message point icon with Font Awesome icon
 */
export function createIconPoint({ id }) {
  // Container parameters for message point
  const container = {
    attributes: { 'data-id': id ?? "" }
  };
  
  const html = createIconHTML({
    text: null,
    container: container
  });
  
  const icon = new L.DivIcon({
    html: html,
    className: ICON_CONFIG.point.className,
    iconSize: ICON_CONFIG.point.iconSize,
  });
  
  
  return icon;
}


/**
 * Creates message marker
 * @param {Array} coord - Coordinates [lat, lng]
 * @param {Object} data - Marker data
 * @returns {L.Marker} Message marker
 */
export function createMarker(coord, data) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconPoint({
      id: data.sensor_id || data.message_id
    }),
    data: data,
    typeMarker: "message",
  });
}