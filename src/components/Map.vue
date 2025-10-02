<template>
  <div :class="{ inactive: mapStore.mapinactive }" class="mapcontainer" id="map"></div>
  <Footer
    :currentProvider="provider"
  >
    <button
      class="popovercontrol popoovergeo"
      v-if="geoavailable"
      @click.prevent="resetgeo"
      :area-label="$t('showlocation')"
      :title="geoisloading ? $t('locationloading') : $t('showlocation')"
    >
      <font-awesome-icon icon="fa-solid fa-location-arrow" :fade="geoisloading" />

      <div class="popoovergeo-tip" v-if="geomsg !== ''" :class="geomsgopened ? 'opened' : 'closed'">
        {{ geomsg }}
        <font-awesome-icon
          icon="fa-solid fa-xmark"
          class="popoovergeo-tipclose"
          @click.stop="geomsg = ''"
        />
      </div>
    </button>
  </Footer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { settings } from "@config";
import { toRaw } from "vue";
import Footer from "../components/footer/Footer.vue";
import { drawuser, init, removeMap, setTheme, moveMap } from "../utils/map/instance";
import { init as initMarkers } from "../utils/map/markers";
import { init as initWind } from "../utils/map/wind";
import { setMapSettings } from "@/utils/utils";
import { useMapStore } from "@/stores/map";
import { useBookmarksStore } from "@/stores/bookmarks";

// Props and emits
const emit = defineEmits(["clickMarker"]);

// Composables
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const mapStore = useMapStore();
const bookmarksStore = useBookmarksStore();

// Reactive state
const userposition = ref(null);
const geoavailable = ref(false);
const geoisloading = ref(false);
const geomsg = ref("");
const geomsgopened = ref(false);
const geomsgopenedtime = ref(5000); // 5 seconds
const geomsgopenedtimer = ref(null);
const map = ref(null);
const currentTheme = ref(window?.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

// Computed properties
const theme = computed(() => currentTheme.value);

// Functions
const themelistener = ({ matches, media }) => {
  if (!matches) {
    // Not matching anymore = not interesting
    return;
  }

  if (media === "(prefers-color-scheme: dark)") {
    currentTheme.value = "dark";
  } else if (media === "(prefers-color-scheme: light)") {
    currentTheme.value = "light";
  }

  setTheme(theme.value);
};

// Обновляет позицию карты и синхронизирует с URL
const relocatemap = (lat, lng, zoom, type = "default") => {

  if (router.currentRoute.value.name === "main") {
    // Используем setMapSettings для обновления позиции карты
    setMapSettings(route, router, mapStore, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zoom: parseInt(zoom)
    });
    
           if (type === "reload") {
             moveMap([lat, lng], zoom);
           }
  }
};

// Закрывает tooltip с сообщением о геолокации
const closegeotip = () => {
  geomsg.value = "";
  geomsgopened.value = false;
  geomsgopenedtimer.value && clearTimeout(geomsgopenedtimer.value);
};

// Показывает tooltip с сообщением о геолокации на 5 секунд
const opengeotip = (msg) => {
  closegeotip();
  geomsg.value = msg;
  geomsgopened.value = true;
  geomsgopenedtimer.value = setTimeout(closegeotip, geomsgopenedtime.value);
};

// Загружает позицию карты из localStorage или использует настройки по умолчанию
const getlocalmappos = () => {
  const hasStoredPosition = !!localStorage.getItem("map-position");
  const lastsettings = localStorage.getItem("map-position") || JSON.stringify({
    lat: settings.MAP.position.lat,
    lng: settings.MAP.position.lng,
    zoom: settings.MAP.zoom,
  });

  const { lat, lng, zoom } = JSON.parse(lastsettings);
  mapStore.setmapposition(lat, lng, zoom, hasStoredPosition);
};

// Проверяет, есть ли координаты в URL
const checkPosFromURI = () => {
  return !!(route.query.lat || route.query.lng || route.query.zoom);
};

// Загружает позицию карты из URL параметров
const setPosFromURI = () => {
  const lat = route.query.lat || settings.MAP.position.lat;
  const lng = route.query.lng || settings.MAP.position.lng;
  const zoom = route.query.zoom || settings.MAP.zoom;
  mapStore.setmapposition(lat, lng, zoom, true);
};

// Устанавливает позицию карты по умолчанию из настроек
const setPosDefault = () => {
  mapStore.setmapposition(
    settings.MAP.position.lat,
    settings.MAP.position.lng,
    settings.MAP.zoom,
    true
  );
};


// Инициализирует позицию карты: URL → localStorage → настройки по умолчанию
const initializeMapPosition = () => {
  if (checkPosFromURI()) {
    setPosFromURI();
    return t("geolocationfromparams");
  } else if (localStorage.getItem("map-position")) {
    getlocalmappos();
    return t("geolocationlocal");
  } else {
    setPosDefault();
    return t("geolocationdefault");
  }
};

// Получает текущую геолокацию пользователя через браузер
const getUserGeolocation = () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userposition.value = [position.coords.latitude, position.coords.longitude];
        mapStore.setmapposition(userposition.value[0], userposition.value[1], 20);

        if (userposition.value && map.value) {
          drawuser(userposition.value, mapStore.mapposition.zoom);
        }

        resolve(t("geolocationisdetermined"));
      },
      (e) => reject(`${t("geolocationerror")} ${e.code}]`),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  });
};

// Устанавливает позицию карты: инициализация или принудительная геолокация
const setgeo = (force = false) => {
  return new Promise((resolve, reject) => {
    geoisloading.value = true;

    if (!("geolocation" in navigator)) {
      geoavailable.value = false;
      reject(t("geolocationnotavailable"));
      return;
    }

    geoavailable.value = true;

    if (force) {
      getUserGeolocation().then(resolve).catch(reject);
    } else {
      const message = initializeMapPosition();
      resolve(message);
    }
  });
};

// Принудительно определяет геолокацию пользователя и обновляет карту
const resetgeo = async () => {
  closegeotip();

  try {
    const message = await setgeo(true);
    relocatemap(mapStore.mapposition.lat, mapStore.mapposition.lng, mapStore.mapposition.zoom, "reload");
    opengeotip(message);
  } catch (error) {
    opengeotip(error);
  } finally {
    geoisloading.value = false;
  }
};

// Обновляет позицию карты при изменении зума или перемещении
const updateMapPosition = (e) => {
  const newLat = e.target.getCenter().lat.toFixed(4);
  const newLng = e.target.getCenter().lng.toFixed(4);
  const newZoom = e.target.getZoom();
  relocatemap(newLat, newLng, newZoom);
};

// Настраивает обработчики событий карты (зум, перемещение)
const setupMapEventHandlers = () => {
  map.value.on("zoomend", updateMapPosition);
  map.value.on("moveend", (e) => {
    // setTimeout for mobiles (when swiping up app, it causes unpleasant map moving before closing app)
    setTimeout(() => updateMapPosition(e), 50);
  });
};

// Инициализирует компоненты карты: маркеры, ветер, закладки
const initializeMapComponents = async () => {
  initMarkers(toRaw(map.value), (data) => {
    emit("clickMarker", data);
  }, mapStore.currentUnit);

  if (mapStore.currentProvider === "realtime") {
    await initWind();
  }

  await bookmarksStore.idbBookmarkGet();
};

// Загружает и инициализирует карту со всеми компонентами
const loadMap = async () => {
  geoisloading.value = false;

  map.value = init([mapStore.mapposition.lat, mapStore.mapposition.lng], mapStore.mapposition.zoom, theme.value);
  relocatemap(mapStore.mapposition.lat, mapStore.mapposition.lng, mapStore.mapposition.zoom, "reload");

  setupMapEventHandlers();
  await initializeMapComponents();
};

// Watchers
watch(geoisloading, (v) => {
  console.debug("geoisloading changed", v);
});

watch(geomsg, (v) => {
  console.debug("geomsg changed", v);
});


// Настраивает слушатели изменения темы системы
const setupThemeListeners = () => {
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", themelistener);
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", themelistener);
  }
};

// Инициализирует карту с определением геолокации
const initializeMapWithGeolocation = async () => {
  try {
    const message = await setgeo();
    opengeotip(message);
  } catch (error) {
    opengeotip(error + `, ${t("geolocationdefaultsetup")}`);
  }
  
  await loadMap();
};

onMounted(async () => {
  setupThemeListeners();
  await initializeMapWithGeolocation();
});

onUnmounted(() => {
  removeMap();
});
</script>


<style scoped>
.mapcontainer {
  background-color: var(--color-light-gray);
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  width: 100%;
  height: 100svh;
  overflow: hidden;
}


.popoovergeo {
  position: relative;
}

.popoovergeo-tip {
  --gettime: v-bind("geomsgopenedtime");
  --openedtime: calc(var(--gettime) / 1000 * 1s);
  position: absolute;
  padding: 5px 25px 5px 10px;
  background-color: color-mix(in srgb, var(--color-dark) 70%, transparent);
  color: var(--color-light);
  backdrop-filter: blur(5px);
  font-weight: bold;
  border-radius: 2px;
  bottom: calc(var(--app-inputheight) + 10px);
  width: 220px;
  right: -10px;
  font-size: 0.9em;
}

/* .popoovergeo-tip.opened {
  animation: fadeOut 0.3s linear var(--openedtime) forwards;
} */

.popoovergeo-tip:before {
  content: "";
  height: 2px;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--color-light);
  animation: rolldownLeft var(--openedtime) linear 0s forwards;
  transform-origin: 0 50%;
}

.popoovergeo-tip:after {
  content: "";
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid color-mix(in srgb, var(--color-dark) 70%, transparent);
  position: absolute;
  bottom: -10px;
  right: 15px;
}

.popoovergeo-tipclose {
  position: absolute;
  top: 5px;
  right: 5px;
}
</style>
