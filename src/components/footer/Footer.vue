
<template>
  <div class="mapcontrols">
    <div class="flexline">
      <ToggleButton
          v-if="settings.WIND_PROVIDER"
          v-model="wind"
          icon-class="fa-solid fa-wind"
          class="wind-toggle"
          :disabled="!realtime"
          :title="$t('layer.wind')"
        />

      <ToggleButton
        v-if="hasMessagesData"
        v-model="messages"
        :icon-class="messages ? 'fa-solid fa-comment' : 'fa-regular fa-comment'"
        class="messages-toggle"
        :title="$t('layer.messages')"
      />

      <div id="mapsettings" class="popover-bottom-left popover" popover>
        <section>
          <h3>{{ $t("history.title") }}</h3>
          <HistoryImport />
        </section>
      </div>
       <button class="popovercontrol" popovertarget="mapsettings">
         <font-awesome-icon icon="fa-solid fa-download" />
       </button>
    </div>

    <div class="flexline">

      <ProviderType />

      <!-- выбор даты -->
      <input
        type="date"
        v-model="start"
        :max="maxDate"
        :disabled="realtime"
      />

      <!-- выбор измерения -->
      <select v-model="type" v-if="sensorsUI.sensors.length > 0 && availableOptions?.length > 0">
        <option v-for="opt in availableOptions" :key="opt.value" :value="opt.value">
          {{ opt.name }}
        </option>
      </select>
    </div>

    <div class="flexline">
      <div class="mapcontrols-geo">
        <button 
          v-if="settings.MAP?.theme?.satellite"
          @click="toggleMapTheme" 
          :title="mapTheme === 'satellite' ? 'Switch to default theme' : 'Switch to satellite view'"
        >
          <font-awesome-icon :icon="mapTheme === 'default' ? 'fa-solid fa-satellite' : 'fa-regular fa-map'" />
        </button>

        <button
          v-if="geoavailable"
          class="geolocation"
          @click.prevent="centerOnUser"
          :area-label="$t('showlocation')"
          :title="geoisloading ? $t('locationloading') : $t('showlocation')"
          >
          <font-awesome-icon icon="fa-solid fa-location-arrow" :fade="geoisloading" />

          <div class="geolocation-tip" v-if="geomsg !== ''" :class="geomsgopened ? 'opened' : 'closed'">
            {{ geomsg }}
            <font-awesome-icon
              icon="fa-solid fa-xmark"
              class="geolocation-tipclose"
              @click.stop="geomsg = ''"
            />
          </div>
        </button>

        <button @click="zoomOut" :disabled="isMinZoom" title="Zoom out">
          <font-awesome-icon icon="fa-solid fa-minus" />
        </button>
        
        <button @click="zoomIn" :disabled="isMaxZoom" title="Zoom in">
          <font-awesome-icon icon="fa-solid fa-plus" />
        </button>
        
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, defineProps, defineEmits, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { dayISO, dayBoundsUnix, parseInputDate } from "@/utils/date";
import { settings } from "@config";
import HistoryImport from "./HistoryImport.vue";
import ToggleButton from "../controls/ToggleButton.vue";
import { instanceMap, setTheme } from "../../utils/map/map";
import { initWindLayer, switchWindLayer, destroyWindLayer } from "../../utils/map/wind";
import measurements from "../../measurements";
// import { getTypeProvider } from "../../utils/utils"; // deprecated
import { Remote } from "../../providers";
import ProviderType from "../ProviderType.vue";
// import { setMapSettings, getPriorityValue } from "../../utils/utils"; // Перенесено в useMap

import { useMap } from "@/composables/useMap";
import { useMessages } from "../../composables/useMessages";
import { useSensors } from "../../composables/useSensors";

// Переменные для геолокации (должны быть объявлены рано для CSS v-bind)
const geomsg = ref("");
const geomsgopened = ref(false);
const geomsgopenedtime = ref(5000); // 5 seconds
const geomsgopenedtimer = ref(null);

// props и emits
const props = defineProps({
  geoavailable: {
    type: Boolean,
    default: false
  },
  geoisloading: {
    type: Boolean,
    default: false
  },
  mapRef: {
    type: Object,
    default: null
  },
});

const emit = defineEmits(["center-on-user", "opengeotip", "clickMessage"]);

// инстансы
const mapState = useMap();
const router = useRouter();
const route = useRoute();
const { locale: i18nLocale, t } = useI18n();

// состояние
const start = ref(route.query.date || mapState.currentDate.value || dayISO());
const maxDate = ref(dayISO());
const realtime = computed(() => mapState.currentProvider.value === "realtime");
const wind = ref(false);
const messages = ref(settings.SERVICES?.messages || false);

// Computed для проверки, есть ли данные сообщений для отображения
const hasMessagesData = computed(() => {
  return settings.SERVICES?.messages && messagesUI.hasMessages;
});

// Инициализируем useMessages и useSensors
const localeComputed = computed(() => {
  return i18nLocale.value || localStorage.getItem("locale") || "en";
});
const messagesUI = reactive(useMessages(localeComputed));
const sensorsUI = reactive(useSensors(localeComputed));

// выбор измерения
const type = computed({
  get: () => mapState.currentUnit.value,
  set: (val) => {
    mapState.setMapSettings(route, router, { type: val });
  }
});
const availableUnits = ref(["pm10"]);
const locale = computed(() => {
  return i18nLocale.value || localStorage.getItem("locale") || "en";
});



// Check if localStorage is available
const isLocalStorageAvailable = () => {
  try {
    const test = 'localStorage_test';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

const availableOptions = computed(() => {
  let opts = availableUnits.value
    .map((key) => {
      const info = measurements[key];
      if (!info) {
        return null;
      }
      return {
        value: key,
        name: info.nameshort?.[locale.value] || info.label,
      };
    })
    .filter((item) => Boolean(item));
  
  // Add AQI option only if:
  // 1. We have PM2.5 and PM10 data
  // 2. We're in history mode (not realtime)
  // 3. localStorage is available
  if (availableUnits.value.includes('pm25') && 
      availableUnits.value.includes('pm10') && 
      !realtime.value &&
      isLocalStorageAvailable()) {
    // Ensure AQI appears first in the list
    const aqiOption = {
      value: 'aqi',
      name: measurements.aqi?.nameshort?.[locale.value] + ' (Beta)' || 'AQI',
    };
    // Avoid duplicates if any
    const filtered = opts.filter(o => o.value !== 'aqi');
    opts = [aqiOption, ...filtered];
  }
  
  // Remove "Noise" from available options
  opts = opts.filter(opt => opt.value !== 'noise');
  
  return opts;
});

// вычисления для истории
const startTimestamp = computed(() => String(dayBoundsUnix(start.value).start));
const endTimestamp = computed(() => String(dayBoundsUnix(start.value).end));



// type теперь computed, поэтому watcher не нужен

// type теперь computed, поэтому синхронизация не нужна

watch(start, async (newDate) => {
  // Безопасно парсим дату из input
  const parsedDate = parseInputDate(newDate);
  
  // Устанавливаем новую дату и синхронизируем
  mapState.setMapSettings(route, router, { date: parsedDate });
  
  // Если слой сообщений включен, обновляем данные
  if (messages.value) {
    try {
      const startTimestamp = dayBoundsUnix(parsedDate).start;
      const endTimestamp = dayBoundsUnix(parsedDate).end;
      await messagesUI.loadMessages(startTimestamp, endTimestamp);
    } catch (error) {
      console.error('Failed to update messages for new date:', error);
    }
  }
});

// Watcher для изменений даты извне (например, из SensorPopup)
watch(
  () => mapState.currentDate.value,
  (newDate) => {
    if (newDate && newDate !== start.value) {
      start.value = newDate;
    }
  }
);
// Watcher для canHistory убран - инициализация теперь происходит в Main.vue
// Это предотвращает дублирующиеся вызовы handlerHistory

// Computed для получения актуальной даты (используем уже синхронизированное значение из mapState)
const currentDate = computed(() => {
  return mapState.currentDate.value;
});

// Единый watcher для синхронизации даты из любого источника
watch(
  currentDate,
  (newDate) => {
    if (newDate && newDate !== start.value) {
      start.value = newDate;
    }
  },
  { immediate: true }
);
// Watcher для ветра
watch(wind, async (enabled) => {
  // Проверяем, что карта инициализирована
  if (!instanceMap()) {
    console.warn('Wind layer: Map not initialized yet');
    return;
  }
  
  if (enabled && settings.WIND_PROVIDER) {
    try {
      await initWindLayer();
      switchWindLayer(instanceMap(), true);
    } catch (error) {
      console.error('Failed to initialize wind layer:', error);
      wind.value = false; // Отключаем checkbox при ошибке
    }
  } else {
    // При отключении ветра сначала скрываем слой, затем полностью очищаем ресурсы
    switchWindLayer(instanceMap(), false);
    if (!enabled) {
      console.log('Wind disabled, cleaning up resources');
      destroyWindLayer();
    }
  }
});

// watch(messages, (v) => switchMessagesLayer(instanceMap(), v));

// Watch for realtime mode changes
watch(
  () => mapState.currentProvider.value,
  (newProvider, oldProvider) => {
    // If switching to realtime mode and current type is AQI, switch to PM2.5
    if (newProvider === 'realtime' && type.value === 'aqi') {
      type.value = 'pm25';
    }
    
    // Очищаем ветер при переключении с realtime на другой провайдер
    if (oldProvider === 'realtime' && newProvider !== 'realtime') {
      console.log('Cleaning up wind layer when switching away from realtime');
      destroyWindLayer();
      wind.value = false; // Отключаем checkbox
    }
    
    // При переключении на realtime автоматически включаем ветер, если он был включен ранее
    if (newProvider === 'realtime' && wind.value && settings.WIND_PROVIDER) {
      // Небольшая задержка для инициализации карты
      setTimeout(() => {
        if (instanceMap()) {
          initWindLayer().then(() => {
            switchWindLayer(instanceMap(), true);
          }).catch(error => {
            console.error('Failed to initialize wind layer on realtime switch:', error);
          });
        }
      }, 100);
    }
  }
);

// загрузка списка измерений из API
onMounted(async () => {
  try {
    const arr = await Remote.getMeasurements(startTimestamp.value, endTimestamp.value);
    const toMove = ["pm10", "pm25"];
    const head = arr.filter((v) => toMove.includes(v));
    const tail = arr.filter((v) => !toMove.includes(v));
    availableUnits.value = [...head, ...tail];
    
    // Respect external unit (composable) as the single source of truth
    const preferred = mapState.currentUnit.value;
    if (preferred === 'aqi' && !isLocalStorageAvailable()) {
      type.value = 'pm25';
    } else {
      type.value = preferred;
    }
    
    // Инициализируем ветер если он был включен и мы в realtime режиме
    if (wind.value && mapState.currentProvider.value === 'realtime' && settings.WIND_PROVIDER) {
      // Небольшая задержка для инициализации карты
      setTimeout(async () => {
        if (instanceMap()) {
          try {
            await initWindLayer();
            switchWindLayer(instanceMap(), true);
          } catch (error) {
            console.error('Failed to initialize wind layer on mount:', error);
            wind.value = false;
          }
        }
      }, 500); // Увеличиваем задержку для гарантии инициализации карты
    }
    
    // Инициализируем слой сообщений если поддерживается
    if (settings.SERVICES?.messages) {
      setTimeout(async () => {
        if (instanceMap()) {
          try {
            // Инициализируем слой сообщений
            messagesUI.initMessagesLayer((messageData) => {
              // Обработчик клика по маркеру сообщения
              handleMessageClick(messageData);
            });
            
            // Загружаем сообщения за текущий период для проверки наличия данных
            const startTimestamp = dayBoundsUnix(start.value).start;
            const endTimestamp = dayBoundsUnix(start.value).end;
            await messagesUI.loadMessages(startTimestamp, endTimestamp);
            
            // Показываем слой на карте только если тогл включен
            if (messages.value) {
              messagesUI.toggleMessagesLayer(true);
            }
            
          } catch (error) {
            console.error('Failed to initialize messages layer on mount:', error);
            messages.value = false;
          }
        }
      }, 500);
    }
  } catch (e) {
    console.error(e);
  }
});

// type теперь computed, поэтому синхронизация не нужна

// Watcher для переключения слоя сообщений
watch(messages, async (enabled) => {
  if (enabled) {
    try {
      // Сначала инициализируем слой сообщений
      messagesUI.initMessagesLayer((messageData) => {
        // Обработчик клика по маркеру сообщения
        handleMessageClick(messageData);
      });
      
      
      // Показываем слой на карте
      messagesUI.toggleMessagesLayer(true);
      
      // Затем загружаем сообщения
      const startTimestamp = dayBoundsUnix(start.value).start;
      const endTimestamp = dayBoundsUnix(start.value).end;
      const result = await messagesUI.loadMessages(startTimestamp, endTimestamp);
      
      
    } catch (error) {
      console.error('Failed to initialize messages layer:', error);
      messages.value = false;
    }
  } else {
    // Скрываем слой сообщений
    messagesUI.toggleMessagesLayer(false);
    messagesUI.clearMessagesMarkers();
  }
});

// Функции для расширенной панели
const zoomIn = () => {
  const map = instanceMap();
  if (map) {
    map.zoomIn();
  }
};

const zoomOut = () => {
  const map = instanceMap();
  if (map) {
    map.zoomOut();
  }
};

// Проверяем граничные значения зума
const isMaxZoom = computed(() => {
  const currentZoom = Number(mapState.mapposition.value.zoom);
  return currentZoom >= 18;
});

const isMinZoom = computed(() => {
  const currentZoom = Number(mapState.mapposition.value.zoom);
  return currentZoom <= 3;
});

// Состояние темы карты
const mapTheme = ref(localStorage.getItem('mapTheme') || 'default'); // 'default' или 'satellite'

// Функция переключения темы карты
const toggleMapTheme = () => {
  if (mapTheme.value === 'default') {
    // Переключаемся на спутниковую карту из конфига
    mapTheme.value = 'satellite';
    localStorage.setItem('mapTheme', 'satellite');
    // Обновляем тему через глобальную функцию
    if (window.mapUpdateTheme) {
      window.mapUpdateTheme(settings.MAP.theme.satellite);
    }
  } else {
    // Возвращаемся к дефолтной теме (светлой/темной)
    mapTheme.value = 'default';
    localStorage.setItem('mapTheme', 'default');
    // Определяем системную тему
    const isDarkMode = window?.matchMedia("(prefers-color-scheme: dark)").matches;
    const defaultTheme = isDarkMode ? 'dark' : 'light';
    // Обновляем тему через глобальную функцию
    if (window.mapUpdateTheme) {
      window.mapUpdateTheme(defaultTheme);
    }
  }
};

// Переменные для геолокации (перемещены в начало файла)

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

// Функция позиционирования
const centerOnUser = () => {
  emit('center-on-user');
  opengeotip(t('locationloading'));
};

// Обработчик клика на маркер сообщения
const handleMessageClick = (messageData) => {
  // Эмитим событие для Main.vue
  emit('clickMessage', messageData);
};

// Делаем функции доступными для родительского компонента
defineExpose({
  opengeotip,
  closegeotip
});
</script>

<style>
.popovercontrol.active {
  border-color: var(--color-blue);
}

.popovercontrol.active path {
  fill: var(--color-blue) !important;
}
</style>

<style scoped>
.mapcontrols {
  bottom: 0;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  left: 0;
  padding: 0 var(--app-controlsgap) var(--app-controlsgap);
  position: absolute;
  right: 0;
  z-index: 12;
  pointer-events: none;
}

.mapcontrols > * {
  pointer-events: all;
}

.popover-bottom-right,
.popover-bottom-left {
  bottom: calc(var(--app-inputheight) + var(--app-controlsgap) * 2);
  max-width: calc(100vw - var(--app-controlsgap) * 2);
}

.popover-bottom-right {
  right: var(--app-controlsgap);
}

.popover-bottom-left {
  left: var(--app-controlsgap);
}


#mapsettings {
  min-width: 20vw;
}

@media screen and (max-width: 820px) {
  .mapcontrols, .mapcontrols .flexline {
    flex-direction: column;
    gap: var(--gap);
    align-items: end;
  }
}


.geolocation {
  position: relative;
}

.geolocation-tip {
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

.geolocation-tip:before {
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

.geolocation-tip:after {
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


.geolocation-tipclose {
  position: absolute;
  top: 5px;
  right: 5px;
}

.mapcontrols-geo {
  display: flex;
  gap: var(--gap);
  background-color: var(--color-light);
  color: var(--color-dark);
  border-radius: 40px;
  font-weight: bold;
  border: 2px solid var(--color-dark);
  padding: calc(var(--gap) * 0.5) var(--gap);
}

.mapcontrols-geo button {
  background-color: transparent;
  color: var(--color-dark);
  border: 0;
  cursor: pointer;
}

.mapcontrols-geo button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

input[type="date"][disabled] {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
