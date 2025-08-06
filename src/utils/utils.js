import config from "@config";


/**
 * Stores the provider type in localStorage if it's valid.
 * @param {string} type – the provider key, e.g. 'realtime' or 'remote'
 */
export function setTypeProvider(type) {
  const candidate =
    type ||
    localStorage.getItem('provider_type') ||
    config.DEFAULT_TYPE_PROVIDER;

  // Only proceed if the provided type is one of the valid keys
  if (Object.prototype.hasOwnProperty.call(config.VALID_DATA_PROVIDERS, candidate)) {
    localStorage.setItem('provider_type', candidate);
    return candidate;
  } else {
    console.warn(
      `setTypeProvider: invalid provider_type "${type}". Expected one of [${Object.keys(
        config.VALID_DATA_PROVIDERS
      ).join(', ')}].`
    )
    // Optionally, you could reset to the default provider here:
    // localStorage.setItem('provider_type', config.DEFAULT_TYPE_PROVIDER)
  }
}

/**
 * Retrieves a valid provider type from route parameters, localStorage, or default.
 * @param {object} [routeParams] – optional object that may contain a `provider` field
 * @returns {string} – a valid provider key (e.g. 'realtime' or 'remote')
 */
export function getTypeProvider(routeParams) {

  // We need to check config.VALID_DATA_PROVIDERS list in case of broken value
  // For routeParams maybe we can find something better

  const candidate =
    routeParams?.provider ||
    localStorage.getItem('provider_type') ||
    config.DEFAULT_TYPE_PROVIDER;

  if (Object.prototype.hasOwnProperty.call(config.VALID_DATA_PROVIDERS, candidate)) {
    return candidate;
  }
}

/**
 * Fetches sensor data for the given period.
 * @param {number|string} start – start timestamp in seconds
 * @param {number|string} end – end timestamp in seconds
 * @returns {Promise<Array>} – flat array of sensor items
 */
export async function getSensorsForPeriod(start, end) {
  const from = String(start).trim();
  const to = String(end).trim();
  const url = `https://roseman.airalab.org/api/sensor/last/${from}/${to}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`getSensorsForPeriod: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data?.result || typeof data.result !== 'object') return [];

    // Преобразуем в массив: [{ sensorId, ...data }, ...]
    return Object.entries(data.result).flatMap(([sensorId, entries]) =>
      entries.map(entry => ({ sensorId, ...entry }))
    );

  } catch (error) {
    console.error('getSensorsForPeriod:', error);
    return [];
  }
}


/**
 * Fetches sensor data for the last 24 hours (from now - 86400 seconds).
 * @returns {Promise<object>} – parsed JSON response
 */
export async function getSensorsForLastDay() {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 86400;
  return getSensorsForPeriod(start, end);
}



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
