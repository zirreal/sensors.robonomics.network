

// Функции для работы с границами карты
export function getMapBounds(mapInstance) {
  if (!mapInstance) return null;
  
  const bounds = mapInstance.getBounds();
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest()
  };
}

export function isPointInBounds(lat, lng, bounds) {
  if (!bounds) return true; // Если границы не определены, показываем все точки
  
  return lat >= bounds.south && 
         lat <= bounds.north && 
         lng >= bounds.west && 
         lng <= bounds.east;
}

export function isPointInMapBounds(lat, lng, mapInstance) {
  const bounds = getMapBounds(mapInstance);
  return isPointInBounds(lat, lng, bounds);
}

/**
 * Создает границы карты на основе центра и boundsDelta из конфига
 * @param {Object} config - объект конфига с MAP.position и MAP.boundsDelta
 * @returns {Object|null} границы карты или null если boundsDelta пустые
 */
export function getConfigBounds(config) {
  const boundsDelta = config?.MAP?.boundsDelta;
  
  // Если boundsDelta пустые, возвращаем null (нет границ)
  if (!boundsDelta?.lat || !boundsDelta?.lng) {
    return null;
  }

  // Создаем границы на основе центра карты и boundsDelta
  const centerLat = Number(config?.MAP?.position?.lat || 0);
  const centerLng = Number(config?.MAP?.position?.lng || 0);
  const deltaLat = Number(boundsDelta.lat);
  const deltaLng = Number(boundsDelta.lng);

  return {
    north: centerLat + deltaLat / 2,
    south: centerLat - deltaLat / 2,
    east: centerLng + deltaLng / 2,
    west: centerLng - deltaLng / 2
  };
}

/**
 * Фильтрует массив объектов по границам карты
 * @param {Array} items - массив объектов с полем geo
 * @param {Object} bounds - границы карты
 * @returns {Array} отфильтрованный массив
 */
export function filterByBounds(items, bounds) {
  if (!bounds) return items;
  
  return items.filter(item => {
    if (!item?.geo) return false;
    const lat = Number(item.geo.lat);
    const lng = Number(item.geo.lng);
    return isPointInBounds(lat, lng, bounds);
  });
}

