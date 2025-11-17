import { ref } from "vue";
import { settings } from "@config";
import { dayISO } from "@/utils/date";

// Глобальное состояние карты (разделяется между всеми экземплярами composable)
const mapposition = ref({
  zoom: settings?.MAP.zoom || "4",
  lat: settings?.MAP.position.lat || "0",
  lng: settings?.MAP.position.lng || "0",
});

const mapinactive = ref(false);

// Безопасная инициализация currentUnit
const getCurrentUnitValue = () => {
  const stored = localStorage.getItem("currentUnit");
  const config = settings?.MAP?.measure;
  const fallback = "pm25";

  // Если в localStorage есть строка - используем её
  if (stored && typeof stored === "string") {
    return stored.toLowerCase();
  }

  // Если в конфиге есть строка - используем её
  if (config && typeof config === "string") {
    return config.toLowerCase();
  }

  // Иначе fallback
  return fallback;
};

const currentUnit = ref(getCurrentUnitValue());
const currentDate = ref(dayISO());
const aqiVersion = ref(localStorage.getItem("aqiVersion") || "us");
const currentProvider = ref(
  localStorage.getItem("provider_type") || settings?.DEFAULT_TYPE_PROVIDER || "remote"
);
const timelineMode = ref("day");

export function useMap() {
  const setmapposition = (lat, lng, zoom, save = true) => {
    mapposition.value.lat = lat;
    mapposition.value.lng = lng;
    mapposition.value.zoom = zoom;

    if (save) {
      localStorage.setItem("map-position", JSON.stringify({ lat, lng, zoom }));
    }
  };

  const setCurrentUnit = (unit) => {
    const u = String(unit || "").toLowerCase();
    currentUnit.value = u;
    try {
      localStorage.setItem("currentUnit", u);
    } catch {}
  };

  const setCurrentDate = (date) => {
    const d = String(date || dayISO());
    currentDate.value = d;
  };

  const setAQIVersion = (version) => {
    const v = String(version || "us");
    if (["us", "eu"].includes(v)) {
      aqiVersion.value = v;
      try {
        localStorage.setItem("aqiVersion", v);
      } catch {}
    }
  };

  const setCurrentProvider = (provider) => {
    const p = String(provider || "remote");
    if (["realtime", "remote"].includes(p)) {
      currentProvider.value = p;
      try {
        localStorage.setItem("provider_type", p);
      } catch {}
    }
  };

  const setTimelineMode = (mode) => {
    const m = String(mode || "day");
    if (["day", "week", "month", "realtime"].includes(m)) {
      timelineMode.value = m;
    }
  };

  /**
   * Получает приоритетное значение по схеме: URL > store > localStorage > default
   */
  const getPriorityValue = (urlValue, storeValue, localStorageKey, defaultValue) => {
    if (urlValue !== undefined && urlValue !== null && urlValue !== "") {
      return urlValue;
    }
    if (storeValue !== undefined && storeValue !== null && storeValue !== "") {
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
  };

  /**
   * Устанавливает конкретные настройки карты и синхронизирует их
   */
  const setMapSettings = (route, router, settings = {}) => {
    const { type, date, provider, lat, lng, zoom, sensor } = settings;

    // Обновляем composable с новыми значениями
    if (type !== undefined) {
      setCurrentUnit(type);
    }
    if (date !== undefined) {
      setCurrentDate(date);
    }
    if (provider !== undefined) {
      setCurrentProvider(provider);
    }
    if (lat !== undefined && lng !== undefined && zoom !== undefined) {
      setmapposition(lat, lng, zoom, false);
    }

    // Синхронизируем URL
    const currentUnitValue = type || currentUnit.value;
    const currentDateValue = date || currentDate.value;
    const currentProviderValue = provider || currentProvider.value;
    const mapPosition = mapposition.value;

    const newQuery = {
      ...route.query,
      type: currentUnitValue,
      date: currentDateValue,
      provider: currentProviderValue,
      lat: mapPosition.lat,
      lng: mapPosition.lng,
      zoom: mapPosition.zoom,
    };

    // Добавляем sensor если он передан
    if (sensor !== undefined) {
      newQuery.sensor = sensor;
    }

    router.replace({ query: newQuery }).catch(() => {});
  };

  /**
   * Синхронизирует настройки карты между URL, composable и localStorage
   */
  const syncMapSettings = (route, router) => {
    const currentUnitValue = getPriorityValue(
      route.query.type,
      currentUnit.value,
      "currentUnit",
      "pm25"
    ).toLowerCase();

    const currentDateValue = getPriorityValue(route.query.date, currentDate.value, null, dayISO());

    const mapPositionValue = getPriorityValue(
      route.query.lat && route.query.lng && route.query.zoom
        ? {
            lat: route.query.lat,
            lng: route.query.lng,
            zoom: route.query.zoom,
          }
        : null,
      mapposition.value,
      "map-position",
      mapposition.value
    );

    const currentProviderValue = getPriorityValue(
      route.query.provider,
      currentProvider.value,
      "provider_type",
      "remote"
    );

    // Обновляем composable
    setCurrentUnit(currentUnitValue);
    setCurrentDate(currentDateValue);
    setCurrentProvider(currentProviderValue);

    if (mapPositionValue && mapPositionValue !== mapposition.value) {
      setmapposition(mapPositionValue.lat, mapPositionValue.lng, mapPositionValue.zoom, false);
    }

    // Синхронизируем URL если нужно
    const urlNeedsUpdate =
      route.query.type !== currentUnitValue ||
      route.query.date !== currentDateValue ||
      route.query.provider !== currentProviderValue ||
      route.query.lat !== mapPositionValue.lat ||
      route.query.lng !== mapPositionValue.lng ||
      route.query.zoom !== mapPositionValue.zoom;

    if (urlNeedsUpdate) {
      const newQuery = {
        ...route.query,
        type: currentUnitValue,
        date: currentDateValue,
        provider: currentProviderValue,
        lat: mapPositionValue.lat,
        lng: mapPositionValue.lng,
        zoom: mapPositionValue.zoom,
      };

      // Сохраняем sensor если он есть в route.query
      if (route.query.sensor) {
        newQuery.sensor = route.query.sensor;
      }

      router.replace({ query: newQuery }).catch(() => {});
    }
  };

  return {
    // State
    mapposition,
    mapinactive,
    currentUnit,
    currentDate,
    aqiVersion,
    currentProvider,
    timelineMode,

    // Actions
    setmapposition,
    setCurrentUnit,
    setCurrentDate,
    setAQIVersion,
    setCurrentProvider,
    setTimelineMode,
    setMapSettings,
    syncMapSettings,
  };
}
