// import { settings } from "@config";
import { dayISO } from "@/utils/date";

/**
 * Universal fetch method for JSON data
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options (optional)
 * @returns {Promise<object>} Parsed JSON data
 */
export async function fetchJson(url, options = {}) {
  const defaultOptions = { 
    credentials: "omit", 
    cache: "no-cache" 
  };
  const res = await fetch(url, { ...defaultOptions, ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}



/*
 * @deprecated Use mapStore.currentProvider instead
 * Stores the provider type in localStorage if it's valid.
 * @param {string} type – the provider key, e.g. 'realtime' or 'remote'
 */
/*
export function setTypeProvider(type) {
  const candidate =
    type ||
    localStorage.getItem('provider_type') ||
    settings.DEFAULT_TYPE_PROVIDER;

  // Only proceed if the provided type is one of the valid keys
  if (Object.prototype.hasOwnProperty.call(settings.VALID_DATA_PROVIDERS, candidate)) {
    localStorage.setItem('provider_type', candidate);
    return candidate;
  } else {
    console.warn(
      `setTypeProvider: invalid provider_type "${type}". Expected one of [${Object.keys(
        settings.VALID_DATA_PROVIDERS
      ).join(', ')}].`
    )
    // Optionally, you could reset to the default provider here:
    // localStorage.setItem('provider_type', settings.DEFAULT_TYPE_PROVIDER)
  }
}
*/

/*
 * @deprecated Use mapStore.currentProvider instead
 * Retrieves a valid provider type from route parameters, localStorage, or default.
 * @param {object} [routeParams] – optional object that may contain a `provider` field
 * @returns {string} – a valid provider key (e.g. 'realtime' or 'remote')
 */
/*
export function getTypeProvider(routeParams) {

  // We need to check settings.VALID_DATA_PROVIDERS list in case of broken value
  // For routeParams maybe we can find something better

  const candidate =
    routeParams?.provider ||
    localStorage.getItem('provider_type') ||
    settings.DEFAULT_TYPE_PROVIDER;

  if (Object.prototype.hasOwnProperty.call(settings.VALID_DATA_PROVIDERS, candidate)) {
    return candidate;
  }
}
*/


export function mergeDeep(target, source) {
  const isObject = (obj) => obj && typeof obj === "object";

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      // target[key] = targetValue.concat(sourceValue);
      target[key] = sourceValue;
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

/**
 * Получает приоритетное значение по схеме: URL > store > localStorage > default
 */
export function getPriorityValue(urlValue, storeValue, localStorageKey, defaultValue) {
  if (urlValue !== undefined && urlValue !== null && urlValue !== '') {
    return urlValue;
  }
  if (storeValue !== undefined && storeValue !== null && storeValue !== '') {
    return storeValue;
  }
  if (localStorageKey) {
    try {
      const stored = localStorage.getItem(localStorageKey);
      if (stored) return stored;
    } catch (e) {
      console.warn(`Failed to get ${localStorageKey} from localStorage:`, e);
    }
  }
  return defaultValue;
}

/**
 * Устанавливает конкретные настройки карты и синхронизирует их
 */
export function setMapSettings(route, router, mapStore, settings = {}) {
  const {
    type,
    date,
    provider,
    lat,
    lng,
    zoom
  } = settings;

  // Обновляем store с новыми значениями
  if (type !== undefined) {
    mapStore.setCurrentUnit(type);
  }
  if (date !== undefined) {
    mapStore.setCurrentDate(date);
  }
  if (provider !== undefined) {
    mapStore.setCurrentProvider(provider);
  }
  if (lat !== undefined && lng !== undefined && zoom !== undefined) {
    mapStore.setmapposition(lat, lng, zoom, false);
  }

  // Синхронизируем URL
  const currentUnit = type || mapStore.currentUnit;
  const currentDate = date || mapStore.currentDate;
  const currentProvider = provider || mapStore.currentProvider;
  const mapPosition = mapStore.mapposition;

  router.replace({
    query: {
      ...route.query,
      type: currentUnit,
      date: currentDate,
      provider: currentProvider,
      lat: mapPosition.lat,
      lng: mapPosition.lng,
      zoom: mapPosition.zoom
    }
  }).catch(() => {});
}

/**
 * Синхронизирует настройки карты между URL, store и localStorage
 */
export function syncMapSettings(route, router, mapStore) {
  const currentUnit = getPriorityValue(
    route.query.type,
    mapStore.currentUnit,
    'currentUnit',
    'pm25'
  ).toLowerCase();

  const currentDate = getPriorityValue(
    route.query.date,
    mapStore.currentDate,
    null,
    dayISO()
  );

  const mapPosition = getPriorityValue(
    route.query.lat && route.query.lng && route.query.zoom ? {
      lat: route.query.lat,
      lng: route.query.lng,
      zoom: route.query.zoom
    } : null,
    mapStore.mapposition,
    'map-position',
    mapStore.mapposition
  );

  const currentProvider = getPriorityValue(
    route.query.provider,
    mapStore.currentProvider,
    'provider_type',
    'remote'
  );

  // Обновляем store
  mapStore.setCurrentUnit(currentUnit);
  mapStore.setCurrentDate(currentDate);
  mapStore.setCurrentProvider(currentProvider);
  
  if (mapPosition && mapPosition !== mapStore.mapposition) {
    mapStore.setmapposition(mapPosition.lat, mapPosition.lng, mapPosition.zoom, false);
  }

  // Синхронизируем URL если нужно
  const urlNeedsUpdate = 
    route.query.type !== currentUnit ||
    route.query.date !== currentDate ||
    route.query.provider !== currentProvider ||
    route.query.lat !== mapPosition.lat ||
    route.query.lng !== mapPosition.lng ||
    route.query.zoom !== mapPosition.zoom;

  if (urlNeedsUpdate) {
    router.replace({
      query: {
        ...route.query,
        type: currentUnit,
        date: currentDate,
        provider: currentProvider,
        lat: mapPosition.lat,
        lng: mapPosition.lng,
        zoom: mapPosition.zoom
      }
    }).catch(() => {});
  }
}

/**
 * Проверяет, являются ли координаты валидными (не нулевыми)
 * @param {Object} geo - Объект с координатами {lat, lng}
 * @returns {boolean} true если координаты валидны, false если нулевые или отсутствуют
 */
export function hasValidCoordinates(geo) {
  if (!geo || !geo.lat || !geo.lng) {
    return false;
  }
  
  const lat = Number(geo.lat);
  const lng = Number(geo.lng);
  
  return Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
}
