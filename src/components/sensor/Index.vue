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

    <!-- Urban/Insight toggle (temporarily hidden; keep logic intact) -->
    <section
      v-if="false && hasBundleToggle"
      class="layer-toggle"
      role="group"
      aria-label="Urban / Insight toggle"
    >
      <button
        type="button"
        class="layer-toggle__btn"
        :class="{ active: activeLayer === 'urban' }"
        :disabled="!hasUrbanLayer"
        @click.prevent="setLayer('urban')"
      >
        Urban
      </button>
      <button
        type="button"
        class="layer-toggle__btn"
        :class="{ active: activeLayer === 'insight' }"
        :disabled="!hasInsightLayer"
        @click.prevent="setLayer('insight')"
      >
        <template v-if="isBundleLoading">Insight…</template>
        <template v-else>Insight</template>
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
        Analytics
      </button>

      <button
        v-if="isAccountsEnabled && isStoriesEnabled"
        class="panel-button"
        :class="{ active: activeTab === 'edit' }"
        @click.prevent="activeTab = 'edit'"
        :title="t('sensorpopup.edit') || 'Edit'"
      >
        <font-awesome-icon icon="fa-regular fa-comment" />
        Stories
      </button>

      <button
        v-if="isAccountsEnabled"
        class="panel-button"
        :class="{ active: activeTab === 'info' }"
        @click.prevent="activeTab = 'info'"
        :title="t('sensorpopup.infotitle')"
      >
        <font-awesome-icon icon="fa-regular fa-file-lines" />
        Info
      </button>
      <button
        v-if="sensor_id"
        class="panel-button"
        :class="{ active: activeTab === 'sharelink' }"
        @click.prevent="activeTab = 'sharelink'"
        :title="'Share'"
      >
        <font-awesome-icon icon="fa-solid fa-link" />
        Share
      </button>
    </div>

    <div class="scrollable-y">
      <div v-show="activeTab === 'chart'" class="tab-content chart-tab">
        <div v-if="isStoriesEnabled && latestStoryInPeriod" class="story-day">
          <div class="story-day__content">
            <div
              class="story-day-icon"
              :style="{ '--story-color': iconColor(latestStoryInPeriod.iconId) }"
            >
              <font-awesome-icon
                v-if="latestStoryInPeriod.icon"
                :icon="latestStoryInPeriod.icon"
                class="story-day-fa"
                :style="{ color: iconColor(latestStoryInPeriod.iconId) }"
              />
            </div>
            <div class="story-day-body">
              <p class="story-day-body__time">{{ formatStoryDateTime(latestStoryInPeriod) }}</p>
              <p class="story-day-body__text">
                {{ latestStoryInPeriod.message || latestStoryInPeriod.comment }}
              </p>
            </div>
          </div>
          <button
            v-if="isStoriesEnabled && isAccountsEnabled"
            type="button"
            class="button button-round-outline"
            @click.prevent="activeTab = 'edit'"
            :title="$t('sensorpopup.allStories')"
          >
            <font-awesome-icon icon="fa-solid fa-comment" />
            <span class="button-round-outline__badge blue">{{ sensorStoriesTotalCount }}</span>
          </button>
        </div>

        <Analytics :point="point" :log="log" />
      </div>

      <div v-if="isStoriesEnabled && isAccountsEnabled && activeTab === 'edit'" class="tab-content">
        <EditStory
          v-if="displaySensorId"
          :sensor-id="displaySensorId"
          :owner="owner"
          :geo="displayGeo"
          @open-chart="activeTab = 'chart'"
        />
      </div>

      <div v-show="activeTab === 'info'" class="tab-content">
        <Info :sensor-id="sensor_id" :owner="owner" :geo="geo" />
      </div>

      <div v-show="activeTab === 'sharelink'" class="tab-content">
        <ShareLink :log="log" :point="point" />
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
import { getStoriesForSensor, isStoryHidden, storiesLocalKeys } from "@/composables/useStories";
import { getAvatar } from "@/utils/avatarGenerator";
import { settings } from "@config";
import { dayISO, getPeriodBounds } from "@/utils/date";

import Analytics from "./tabs/Analytics.vue";
import Info from "./tabs/Info.vue";
import ShareLink from "./tabs/ShareLink.vue";
import EditStory from "./tabs/EditStory.vue";
import Accordion from "../controls/Accordion.vue";

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

const localeComputed = computed(() => localStorage.getItem("locale") || locale.value || "en");
const sensorsUI = useSensors(localeComputed);

const point = computed(() => props.point?.value ?? props.point ?? null);

// Активная вкладка
const activeTab = ref("chart");

// Проверяем, включен ли сервис accounts
const isAccountsEnabled = computed(() => settings?.SERVICES?.accounts === true);
const isStoriesEnabled = computed(() => settings?.SERVICES?.stories !== false);

const ICON_COLORS = {
  heat: "#ff6b6b",
  cold: "#7ad9e8",
  smog: "#9aa7b1",
  wind: "#76a7ff",
  noise: "#c58bff",
  storm: "#b39ddb",
  rain: "#7fbfff",
  sun: "#ffd36e",
  fire: "#ffb26b",
  co2: "#b08a7a",
  note: "#7fcf9a",
};

function iconColor(id) {
  return ICON_COLORS[id] || "currentColor";
}

/** Milliseconds for display/sort: publish time, else createdAt. */
function storyTimestampMs(s) {
  if (!s) return null;
  const ts = s.timestamp != null ? Number(s.timestamp) : null;
  if (ts != null && !Number.isNaN(ts)) return ts < 1e12 ? ts * 1000 : ts;
  if (s.createdAt) {
    const t = new Date(s.createdAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** Calendar day of the story (event `date` or day of `timestamp`) for period filter. */
function storyEventDayISO(s) {
  if (!s) return null;
  const d = s.date != null && String(s.date).trim() !== "" ? String(s.date).trim() : null;
  if (d) return d;
  const ms = storyTimestampMs(s);
  if (ms == null) return null;
  try {
    return dayISO(ms);
  } catch {
    return null;
  }
}

function formatStoryDateTime(s) {
  const ms = storyTimestampMs(s);
  if (ms == null) return "—";
  const loc = String(locale.value || "en");
  const fmtLoc = loc === "ru" ? "ru-RU" : "en-GB";
  return new Intl.DateTimeFormat(fmtLoc, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

/** Bump on `stories_updated` so counts/lists refresh after localStorage writes. */
const storiesRefreshTick = ref(0);

/** Stories in selected timeline period (day / week / month), newest first, not hidden. */
const storiesInSelectedPeriod = computed(() => {
  storiesRefreshTick.value;
  const sid = sensor_id.value;
  const date = mapState.currentDate?.value;
  const modeRaw = mapState.timelineMode?.value || "day";
  const mode = modeRaw === "realtime" ? "day" : modeRaw;
  if (!sid || !date) return [];

  const { start, end } = getPeriodBounds(date, mode);
  const startDay = dayISO(start * 1000);
  const endDay = dayISO(end * 1000);

  const list = getStoriesForSensor(sid);
  const inPeriod = (s) => {
    const eventIso = storyEventDayISO(s);
    if (!eventIso) return false;
    return eventIso >= startDay && eventIso <= endDay;
  };

  const matches = (Array.isArray(list) ? list : []).filter((s) => inPeriod(s) && !isStoryHidden(s));
  matches.sort((a, b) => (storyTimestampMs(b) || 0) - (storyTimestampMs(a) || 0));
  return matches;
});

/** Последняя (самая новая) история за выбранный период. */
const latestStoryInPeriod = computed(() => storiesInSelectedPeriod.value[0] || null);

/** Всего историй по датчику (localStorage), без скрытых. */
const sensorStoriesTotalCount = computed(() => {
  storiesRefreshTick.value;
  const sid = sensor_id.value;
  if (!sid) return 0;
  const list = getStoriesForSensor(sid);
  return (Array.isArray(list) ? list : []).filter((s) => s && !isStoryHidden(s)).length;
});

// Порядок табов для навигации клавиатурой (edit только если accounts включен)
const tabsOrder = computed(() => {
  const base = ["chart"];
  if (isAccountsEnabled.value && isStoriesEnabled.value) base.push("edit");
  if (ownerSensorsList.value.length) base.push("owners");
  base.push("details");
  return base;
});

// Функция для переключения табов клавиатурой
const handleKeydown = (event) => {
  const target = event?.target;
  const tag = target?.tagName ? String(target.tagName).toLowerCase() : "";
  const isTypingTarget =
    tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable === true;

  // Проверяем, что нажата стрелка влево или вправо
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    // Don't hijack arrows while the user types/edits text.
    if (isTypingTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

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
  return point.value?.sensor_id || null;
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
  return point.value?.geo || { lat: 0, lng: 0 };
});

const owner = computed(() => point.value?.owner || null);

const bundle = computed(() => point.value?.bundle || null);
const hasUrbanLayer = computed(() => !!bundle.value?.layers?.urban);
const getBundleLogsCount = (sensorId) => {
  if (!sensorId) return 0;
  const dataBySensor =
    bundle.value?.data && typeof bundle.value.data === "object" ? bundle.value.data : {};
  const entry = dataBySensor?.[sensorId];
  if (Array.isArray(entry)) return entry.length;
  const list = bundle.value?.ownerSensors;
  if (Array.isArray(list)) {
    const hit = list.find((s) => s?.sensor_id === sensorId);
    if (typeof hit?.logsCount === "number") return hit.logsCount;
  }
  return 0;
};
const hasInsightLayer = computed(() => {
  return !!bundle.value?.layers?.insight;
});
const isBundleLoading = computed(() => !!bundle.value?.loading);
const hasBundleToggle = computed(() => hasUrbanLayer.value && hasInsightLayer.value);

const activeLayer = ref("urban");
const selectedSensorId = ref(null);
const lastNonNullLogs = ref(null);

watch(
  () => point.value?.sensor_id,
  () => {
    // Reset selection only when the opened marker/sensor changes.
    selectedSensorId.value = null;
    const layers = bundle.value?.layers;
    if (!layers) return;
    if (layers.urban) activeLayer.value = "urban";
    else if (layers.insight) activeLayer.value = "insight";
  },
  { immediate: true }
);

const setLayer = (layer) => {
  if (layer === "urban" && !hasUrbanLayer.value) return;
  if (layer === "insight" && !hasInsightLayer.value) return;
  activeLayer.value = layer;
  const layers = bundle.value?.layers || {};

  // Helper: prefer an Insight sensor that already has data.
  const pickBestInsightId = () => {
    const list = ownerSensorsList.value;
    if (!Array.isArray(list)) return layers.insight || null;
    const dataBySensor =
      bundle.value?.data && typeof bundle.value.data === "object" ? bundle.value.data : {};
    const effectiveCount = (s) => {
      const direct = typeof s?.logsCount === "number" ? s.logsCount : 0;
      if (direct > 0) return direct;
      const sid = s?.sensor_id;
      const entry = sid ? dataBySensor?.[sid] : null;
      return Array.isArray(entry) ? entry.length : 0;
    };
    const insightSensors = list.filter((s) => s?.kind === "insight" && s?.sensor_id);
    if (!insightSensors.length) return layers.insight || null;
    insightSensors.sort((a, b) => effectiveCount(b) - effectiveCount(a));
    return insightSensors[0]?.sensor_id || layers.insight || null;
  };

  // Sync explicit selection with the layer id (and ensure it's the best available).
  if (layer === "urban" && layers.urban) selectedSensorId.value = layers.urban;
  if (layer === "insight") selectedSensorId.value = pickBestInsightId();
};

const displaySensorId = computed(() => {
  if (selectedSensorId.value) return selectedSensorId.value;
  const layers = bundle.value?.layers;
  if (!layers) return sensor_id.value;
  if (activeLayer.value === "insight") return layers.insight || layers.urban || sensor_id.value;
  return layers.urban || layers.insight || sensor_id.value;
});

watch(
  displaySensorId,
  async (sid) => {
    if (!sid) return;
    // Load logs for the currently selected layer sensor id (urban/insight)
    sensorsUI.ensureBundleLogs?.(sid);
  },
  { immediate: true }
);

const ownerSensorsList = computed(() => {
  const list = bundle.value?.ownerSensors;
  const raw = Array.isArray(list) ? [...list] : [];
  // Hide sensors with no data for the current period (stable UI),
  // but we will always add the "main" clicked Urban sensor below.
  const effectiveLogsCount = (s) => getBundleLogsCount(s?.sensor_id);
  const baseId = point.value?.sensor_id;
  const arr = raw.filter((s) => effectiveLogsCount(s) > 0);
  if (baseId && !arr.some((s) => s?.sensor_id === baseId)) {
    arr.unshift({
      sensor_id: baseId,
      kind: "urban",
      logsCount: Array.isArray(point.value?.logs) ? point.value.logs.length : 0,
      geo: point.value?.geo,
    });
  }
  return arr;
});

const displayGeo = computed(() => {
  const sid = displaySensorId.value;
  const match = ownerSensorsList.value.find((s) => s.sensor_id === sid);
  return match?.geo || geo.value;
});

const displayPoint = computed(() => {
  const sid = displaySensorId.value;
  const dataBySensor = bundle.value?.data || {};
  const hasBundleKey =
    sid && dataBySensor && Object.prototype.hasOwnProperty.call(dataBySensor, sid);
  const bundleEntry = hasBundleKey ? dataBySensor?.[sid] : undefined; // can be null (loading), [] or logs[]
  const bundleLogs = Array.isArray(bundleEntry) ? bundleEntry : null;
  // If bundle explicitly contains this sensor logs (even empty), use it so the UI can show "No data".
  // If bundle contains null => show skeleton (loading).
  // If switching to another sensor and no bundle key exists yet => show skeleton instead of previous chart.
  let logs = hasBundleKey
    ? bundleLogs
    : sid && sid !== point.value?.sensor_id
    ? null
    : point.value?.logs;

  // Reduce chart flashing: while new layer logs are loading (null),
  // keep last rendered logs so Chart component doesn't unmount/remount.
  if (logs === null && Array.isArray(lastNonNullLogs.value) && lastNonNullLogs.value.length > 0) {
    logs = lastNonNullLogs.value;
  }
  return {
    ...(point.value || {}),
    sensor_id: sid,
    geo: displayGeo.value,
    logs: Array.isArray(logs) ? logs : null,
  };
});

// Гарантируем, что logs всегда массив
const displayLog = computed(() =>
  Array.isArray(displayPoint.value?.logs) ? displayPoint.value.logs : null
);

watch(
  displayLog,
  (logs) => {
    if (Array.isArray(logs) && logs.length > 0) {
      lastNonNullLogs.value = logs;
    }
  },
  { immediate: true }
);

const downsampleLog = (logs, maxPoints = 2500) => {
  if (!Array.isArray(logs)) return logs;
  if (logs.length <= maxPoints) return logs;
  const step = Math.ceil(logs.length / maxPoints);
  const out = [];
  for (let i = 0; i < logs.length; i += step) out.push(logs[i]);
  return out;
};

const displayLogFast = computed(() => downsampleLog(displayLog.value));

// Back-compat for existing template checks (icon link visibility)
const log = computed(() => displayLog.value);

// Вычисляем тип сенсора используя функцию из composable
const sensorType = computed(() => sensorsUI.getSensorType(displayPoint.value));

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

function bumpStoriesRefresh() {
  storiesRefreshTick.value += 1;
}

onMounted(() => {
  // Инициализация компонента
  // Добавляем обработчик клавиатуры для переключения табов
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener(storiesLocalKeys.STORIES_UPDATED_EVENT, bumpStoriesRefresh);
});

onBeforeUnmount(() => {
  // Удаляем обработчик клавиатуры при размонтировании
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener(storiesLocalKeys.STORIES_UPDATED_EVENT, bumpStoriesRefresh);
});

// Watcher для изменений даты (из UI или внешних источников)
watch(
  () => mapState.currentDate.value,
  (newDate) => {
    if (newDate) {
      // Очищаем логи при смене даты
      sensorsUI.clearSensorLogs(point.value?.sensor_id);
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

.layer-toggle {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: calc(var(--gap) * 1);
  margin-bottom: calc(var(--gap) * 1);
}

.layer-toggle__btn {
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: rgba(0, 0, 0, 0.02);
  padding: 8px 12px;
  border-radius: 999px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.layer-toggle__btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}

.layer-toggle__btn.active {
  border-color: rgba(80, 120, 255, 0.55);
  background: rgba(80, 120, 255, 0.12);
  box-shadow: 0 0 0 1px rgba(80, 120, 255, 0.18);
}

.layer-toggle__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.owner-sensors {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.owner-sensors__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 6px 2px;
}

.owner-sensors__title {
  font-weight: 900;
  margin: 0;
  opacity: 0.85;
}

.owner-sensors__subtitle {
  font-size: 0.85em;
  font-weight: 800;
  opacity: 0.55;
}

@media screen and (width < 520px) {
  .owner-sensors {
    grid-template-columns: 1fr;
  }
}

.owner-sensors__card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.75);
  padding: 10px 12px;
  border-radius: 14px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.owner-sensors__card:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
}

.owner-sensors__card.active {
  border-color: rgba(80, 120, 255, 0.55);
  box-shadow: 0 0 0 1px rgba(80, 120, 255, 0.18);
  background: rgba(80, 120, 255, 0.06);
}

.owner-sensors__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.owner-sensors__badge {
  font-size: 0.78em;
  font-weight: 900;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.03);
  letter-spacing: 0.01em;
}

.owner-sensors__badge[data-kind="urban"] {
  background: rgba(130, 90, 255, 0.12);
  border-color: rgba(130, 90, 255, 0.22);
}

.owner-sensors__badge[data-kind="insight"] {
  background: rgba(176, 138, 122, 0.14);
  border-color: rgba(176, 138, 122, 0.26);
}

.owner-sensors__id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.85em;
  opacity: 0.78;
}

.owner-sensors__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.owner-sensors__hint {
  font-size: 0.85em;
  font-weight: 700;
  opacity: 0.7;
}

.owner-sensors__hint.muted {
  opacity: 0.5;
}

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
  max-height: 90%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: calc(var(--gap) * 2 + env(safe-area-inset-bottom, 0px));
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

  .scrollable-y {
    max-height: calc(100dvh - 170px);
    padding-bottom: calc(var(--gap) * 3 + env(safe-area-inset-bottom, 0px));
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
  top: 2px;
  font-size: var(--font-size);
  gap: calc(var(--gap) * 0.5);
  font-weight: 600;
}

.panel-button:hover {
  color: var(--color-link);
}

.panel-button.active {
  color: var(--color-link);
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

.details-stack {
  display: grid;
  gap: calc(var(--gap) * 0.9);
}

.details-title {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--gap) * 0.6);
  font-weight: 900;
}

.details-tab :deep(.accordion) {
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.details-tab :deep(.accordion__header) {
  padding: calc(var(--gap) * 0.85) calc(var(--gap) * 1.2);
}

.details-tab :deep(.accordion__body) {
  padding: calc(var(--gap) * 0.9) calc(var(--gap) * 1.2);
  background: rgba(0, 0, 0, 0.015);
}

.chart-tab {
  padding-top: calc(var(--tab-offset-y) * 0.65);
}

.story-day {
  --story-icon-size: 3rem;
  padding: calc(var(--gap) / 2);
  background-color: var(--color-light-gray);
  border: 1px solid var(--color-middle-gray);
  border-radius: var(--radius-sm);
  margin-bottom: var(--gap);
  display: grid;
  grid-template-columns: auto var(--story-icon-size);
  align-items: center;
}

.story-day__content {
  display: grid;
  grid-template-columns: var(--story-icon-size) auto;
  gap: var(--gap);
  align-items: center;
}

.story-day-icon {
  width: var(--story-icon-size);
  height: var(--story-icon-size);
  border-radius: calc(var(--story-icon-size) / 2);
  background: color-mix(in srgb, var(--story-color, var(--color-blue)) 14%, transparent);
  border: 1px solid
    color-mix(in srgb, var(--story-color, var(--color-blue)) 28%, rgba(0, 0, 0, 0.08));
  display: grid;
  place-items: center;
}

.story-day__content p {
  margin-bottom: 0.2rem;
}

.story-day-body__time {
  font-weight: 600;
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
