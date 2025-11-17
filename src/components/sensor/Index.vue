<template>
  <div class="popup-js active">
    <section class="sensor-header">
      <div class="sensor-type">
        <a
          v-if="log !== null && sensorTypeImage"
          :href="sensorTypeLink"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img :src="sensorTypeImage" :alt="sensorType" />
        </a>
      </div>

      <div class="sensor-info-title">
        <img v-if="sensorAvatar" :src="sensorAvatar" :alt="sensor_id" class="sensor-avatar" />

        <h3>
          <template v-if="point?.address">{{ point.address }}</template>
          <span v-else class="skeleton skeleton-text"></span>
        </h3>
      </div>

      <button @click.prevent="closesensor" aria-label="Close sensor" class="localbutton-close">
        <font-awesome-icon icon="fa-solid fa-xmark" />
      </button>
    </section>

    <!-- <div class="sensor-info-desc">Here you'll see some custom description</div> -->

    <div class="sensor-panel">
      <button
        class="panel-button"
        :class="{ active: activeTab === 'chart' }"
        @click.prevent="activeTab = 'chart'"
        :title="'Analytics'"
      >
        <font-awesome-icon icon="fa-solid fa-chart-line" />
      </button>
      <button
        class="panel-button"
        :class="{ active: activeTab === 'info' }"
        @click.prevent="activeTab = 'info'"
        :title="t('sensorpopup.infotitle')"
      >
        <font-awesome-icon icon="fa-regular fa-file-lines" />
      </button>
      <button
        class="panel-button"
        :class="{ active: activeTab === 'sharelink' }"
        @click.prevent="activeTab = 'sharelink'"
        :title="t('sensorpopup.sharedefault')"
      >
        <font-awesome-icon icon="fa-solid fa-link" />
      </button>
      <button
        class="panel-button"
        :class="{ active: activeTab === 'bookmarks' }"
        @click.prevent="activeTab = 'bookmarks'"
        :title="t('sensorpopup.bookmarkbutton')"
      >
        <font-awesome-icon icon="fa-regular fa-bookmark" />
      </button>
      <button
        v-if="isAccountsEnabled"
        class="panel-button"
        :class="{ active: activeTab === 'edit' }"
        @click.prevent="activeTab = 'edit'"
        :title="t('sensorpopup.edit') || 'Edit'"
      >
        <font-awesome-icon icon="fa-regular fa-pen-to-square" />
      </button>
    </div>

    <div class="scrollable-y">
      <div v-show="activeTab === 'chart'" class="tab-content">
        <NativeShare />
        <Analytics :point="point" :log="log" />
      </div>

      <div v-show="activeTab === 'info'" class="tab-content">
        <Info :sensor-id="sensor_id" :owner="owner" :geo="geo" />
      </div>

      <div v-show="activeTab === 'sharelink'" class="tab-content">
        <ShareLink :log="log" :point="point" />
      </div>

      <!-- Bookmarks Tab -->
      <div v-show="activeTab === 'bookmarks'" class="tab-content">
        <Bookmark v-if="sensor_id" :id="sensor_id" :address="point?.address" :geo="geo" />
      </div>

      <div v-if="isAccountsEnabled && activeTab === 'edit'" class="tab-content">
        <section>
          <h3>{{ t("sensorpopup.edit") || "Edit" }}</h3>
          <p>{{ t("sensorpopup.edit") || "Edit functionality coming soon" }}</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useMap } from "@/composables/useMap";
import { useSensors } from "@/composables/useSensors";
import { useBookmarks } from "@/composables/useBookmarks";
import { getAvatar } from "@/utils/avatarGenerator";
import { settings } from "@config";

import Bookmark from "./tabs/Bookmark.vue";
import Analytics from "./tabs/Analytics.vue";
import Info from "./tabs/Info.vue";
import ShareLink from "./tabs/ShareLink.vue";
import NativeShare from "./widgets/NativeShare.vue";

// Импортируем изображения типов сенсоров
import diyIcon from "@/assets/images/sensorTypes/DIY.svg";
import insightIcon from "@/assets/images/sensorTypes/Insight.svg";
import urbanIcon from "@/assets/images/sensorTypes/Urban.svg";
import altruistIcon from "@/assets/images/sensorTypes/Altruist.svg";

const props = defineProps({
  point: Object,
});

const emit = defineEmits(["close"]);

const { t, locale } = useI18n();
const mapState = useMap();
const { idbBookmarks } = useBookmarks();

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");
const sensorsUI = useSensors(localeComputed);

// Активная вкладка
const activeTab = ref("chart");

// Проверяем, включен ли сервис accounts
const isAccountsEnabled = computed(() => settings?.SERVICES?.accounts === true);

// Порядок табов для навигации клавиатурой (edit только если accounts включен)
const tabsOrder = computed(() => {
  const base = ["chart", "info", "sharelink", "bookmarks"];
  if (isAccountsEnabled.value) {
    base.push("edit");
  }
  return base;
});

// Функция для переключения табов клавиатурой
const handleKeydown = (event) => {
  // Проверяем, что нажата стрелка влево или вправо
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    // Предотвращаем стандартное поведение (прокрутку страницы)
    event.preventDefault();

    const currentIndex = tabsOrder.value.indexOf(activeTab.value);
    if (currentIndex === -1) return;

    let nextIndex;
    if (event.key === "ArrowLeft") {
      // Переход к предыдущему табу (циклически)
      nextIndex = currentIndex === 0 ? tabsOrder.value.length - 1 : currentIndex - 1;
    } else {
      // Переход к следующему табу (циклически)
      nextIndex = currentIndex === tabsOrder.value.length - 1 ? 0 : currentIndex + 1;
    }

    activeTab.value = tabsOrder.value[nextIndex];
  }
};

const sensor_id = computed(() => {
  // sensor_id всегда приходит из props.point (обрабатывается в Main.vue)
  return props.point?.sensor_id || null;
});

// Аватарка сенсора на основе ID
const sensorAvatar = ref(null);

// Генерируем аватарку при изменении sensor_id
watch(
  sensor_id,
  (newId) => {
    if (newId) {
      getAvatar(newId, 60)
        .then((avatar) => {
          sensorAvatar.value = avatar;
        })
        .catch((error) => {
          console.error("Error generating avatar:", error);
          sensorAvatar.value = null;
        });
    } else {
      sensorAvatar.value = null;
    }
  },
  { immediate: true }
);

const geo = computed(() => {
  // Координаты всегда приходят из props.point.geo (обрабатывается в Main.vue)
  return props.point?.geo || { lat: 0, lng: 0 };
});

const owner = computed(() => props.point?.owner || null);

// Проверяем, добавлен ли сенсор в закладки
const isBookmarked = computed(() => {
  if (!sensor_id.value) return false;
  return idbBookmarks.value?.some((bookmark) => bookmark.id === sensor_id.value) || false;
});

// Гарантируем, что logs всегда массив
const log = computed(() => (Array.isArray(props.point?.logs) ? props.point.logs : null));

// Вычисляем тип сенсора используя функцию из composable
const sensorType = computed(() => sensorsUI.getSensorType(props.point));

// Вычисляем путь к изображению типа сенсора
const sensorTypeImage = computed(() => {
  if (!sensorType.value) return null;

  const typeMap = {
    diy: diyIcon,
    insight: insightIcon,
    urban: urbanIcon,
    altruist: altruistIcon,
  };

  return typeMap[sensorType.value] || null;
});

// Вычисляем ссылку для типа сенсора
const sensorTypeLink = computed(() => {
  if (sensorType.value === "diy") {
    return "https://robonomics.academy/en/learn/sensors-connectivity-course/sensor-hardware/";
  }
  return "https://shop.akagi.dev/products/outdoor-sensor-altruist-dev-kit";
});

// Функции для табов теперь не нужны - переключение происходит через activeTab

const closesensor = () => {
  // Просто эмитим событие закрытия - всю логику обрабатывает Main.vue
  emit("close");
};

/**
 * Генерирует ссылку на карту в зависимости от устройства
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {string} [label="Sensor"] - Подпись для метки
 * @returns {string} URL ссылки на карту
 */
function getMapLink(lat, lon, label = "Sensor") {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(label)}`;
  }
  if (isAndroid) {
    return `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(label)})`;
  }
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

onMounted(() => {
  // Инициализация компонента
  // Добавляем обработчик клавиатуры для переключения табов
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  // Удаляем обработчик клавиатуры при размонтировании
  window.removeEventListener("keydown", handleKeydown);
});

// Watcher для изменений даты (из UI или внешних источников)
watch(
  () => mapState.currentDate.value,
  (newDate) => {
    if (newDate) {
      // Очищаем логи при смене даты
      sensorsUI.clearSensorLogs(props.point?.sensor_id);
    }
  }
);

// URL обновление теперь происходит только в Main.vue
// Здесь оставляем только UI-специфичную логику
</script>

<style scoped>
/* + Заголовок сенсора: тип, выбор даты, кнопка закрыть */

.sensor-type {
  width: 30px;
}

.sensor-type {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.sensor-type img {
  width: 100%;
  display: block;
}

.sensor-header {
  display: grid;
  gap: var(--gap);
  grid-template-columns: 30px 1fr 30px;
  align-items: center;
}
/* - Заголовок сенсора: тип, выбор даты, кнопка закрыть */

.popup-js.active {
  container: popup / inline-size;
  background: var(--color-light);
  border-radius: 0;
  bottom: 0;
  box-sizing: border-box;
  color: var(--color-dark);
  padding: var(--gap);
  position: absolute;
  right: 0;
  top: 0;
  width: 80vw;
  max-width: 1000px;
  z-index: 100;
  box-shadow: -6px 0 12px -4px rgba(0, 0, 0, 0.3);
}

.scrollable-y {
  max-height: 85%;
}

/* Стили скелетона для заглушки графика */
.chart-skeleton {
  height: 300px;
  width: 100%;
  background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

.no-data-message {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 1rem;
  text-align: center;
  padding: 2rem;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Стили заглушки для текста */
.skeleton-text {
  display: inline-block;
  height: 1em;
  width: 100%;
  background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media screen and (max-width: 700px) {
  .popup-js.active {
    left: 0;
    width: 100%;
    top: 0;
  }
}

@container popup (max-width: 400px) {
  h3.flexline {
    max-width: calc(100% - var(--gap) * 3);
  }
}

/* shared container */

/* + scales */
.scalegrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--gap);
  font-size: 0.8em;
}
.scalegrid:not(:last-child) {
  margin-bottom: calc(var(--gap) * 2);
}
.scalegrid p {
  margin-bottom: calc(var(--gap) * 0.5);
}
.scales-color {
  position: relative;
  padding-left: calc(var(--gap) * 2);
  hyphens: auto;
}
.scales-color:before {
  content: "";
  display: block;
  position: absolute;
  background-color: var(--color);
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--gap);
}
/* - scales */

/* + realtime */
/* removed .rt-title indicator styles (not used) */
.rt-time {
  font-size: 0.8em;
  font-weight: 300;
}
.rt-unit,
.rt-number {
  font-size: 0.8em;
  font-weight: 900;
}

.rt-number {
  color: var(--color-blue);
}

/* - realtime */

.sensor-info {
  text-align: center;
}

.sensor-info-title {
  display: flex;
  gap: var(--gap);
  align-items: center;
  margin-bottom: 0;
  justify-content: center;
}

@media screen and (width < 700px) {
  .sensor-header {
    align-items: start;
    justify-content: start;
    gap: calc(var(--gap) * 3);
  }

  .sensor-info-title {
    flex-direction: column;
    text-align: center;
  }
}
.sensor-info-title h3 {
  margin-bottom: 0;
}

.sensor-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  display: inline-block;
}

.sensor-panel {
  display: flex;
  justify-content: center;
  gap: calc(var(--gap) * 0.5);
  flex-wrap: wrap;
  border-bottom: 2px solid var(--color-dark);
  margin-top: calc(var(--gap) * 2);
}

.panel-button {
  background: transparent;
  border: 2px solid transparent;
  cursor: pointer;
  padding: calc(var(--gap) * 0.5) calc(var(--gap) * 1.5);
  color: var(--color-text);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  position: relative;
  top: 2px;
}

.panel-button:hover {
  color: var(--color-link);
}

.panel-button.active {
  color: var(--color-link);
  /* border-color: var(--color-link) var(--color-link) var(--color-light) var(--color-link);
  border-radius: 4px 4px 0 0; */
  border-bottom: 2px solid var(--color-link);
}

.panel-button svg {
  width: 1.2em;
  height: 1.2em;
}

.tab-content {
  --tab-offset-x: 0;
  --tab-offset-y: calc(var(--gap) * 3);
  padding: var(--tab-offset-y) var(--tab-offset-x);
  position: relative;
}

.tab-content .native-share-button {
  position: absolute;
  top: var(--tab-offset-y);
  right: var(--tab-offset-x);
}

.localbutton-close {
  border: 0;
  cursor: pointer;
}

.localbutton-close .fa-xmark {
  height: calc(var(--font-size) * 2);
}

.sensor-info-desc {
  text-align: center;
}
</style>
