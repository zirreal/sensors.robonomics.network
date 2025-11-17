<template>
  <div class="analytics-tab">
    <Timeline :log="log" :point="point" />

    <section class="flexline-mobile-column">
      <div class="flexline mb">
        <AQI v-if="mapState.currentProvider.value !== 'realtime'" :logs="log" />
      </div>
    </section>

    <section>
      <div v-if="showLogsProgress" class="logs-progress">
        <div class="logs-progress-bar">
          <span :style="{ width: `${logsProgressPercent}%` }"></span>
        </div>
        <div class="logs-progress-meta">
          <span>{{ logsProgressLabel }}</span>
          <span>{{ timelineModeLabel }}</span>
        </div>
      </div>

      <Chart v-if="Array.isArray(point?.logs) && point?.logs.length > 0" :log="log" />
      <div
        v-else-if="
          mapState.currentProvider.value === 'remote' &&
          Array.isArray(point?.logs) &&
          point?.logs.length === 0
        "
        class="no-data-message"
      >
        {{ $t("No data available") }}
      </div>
      <div v-else class="chart-skeleton"></div>
    </section>

    <Accordion v-if="units && scales && scales.length > 0">
      <template #title>{{ t("scales.title") }}</template>
      <div class="scalegrid">
        <div v-for="item in scales" :key="item.label">
          <template v-if="item?.zones && (item.name || item.label)">
            <p>
              <b v-if="item.name">
                {{ item.nameshort[localeComputed] }}
              </b>
              <b v-else>{{ item.label }}</b>
              <template v-if="item.unit && item.unit !== ''"> ({{ item.unit }}) </template>
            </p>
            <template v-for="zone in item.zones" :key="zone.color">
              <div
                class="scales-color"
                v-if="zone.color && zone.label"
                :style="`--color: ${zone.color}`"
              >
                <b>
                  {{ zone.label[localeComputed] ? zone.label[localeComputed] : zone.label.en }}
                </b>
                (<template v-if="typeof zone.valueMax === 'number'">
                  {{ t("scales.upto") }} {{ zone.valueMax }}
                </template>
                <template v-else>{{ t("scales.above") }}</template
                >)
              </div>
            </template>
          </template>
        </div>
      </div>
    </Accordion>

    <p class="textsmall" v-if="hasLogs">
      <template v-if="isRussia">{{ t("notice_with_fz") }}</template>
      <template v-else>{{ t("notice_without_fz") }}</template>
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMap } from "@/composables/useMap";
import { useSensors } from "@/composables/useSensors";
import measurements from "../../../measurements";

import AQI from "../widgets/AQI.vue";
import Chart from "../widgets/Chart.vue";
import Timeline from "../widgets/Timeline.vue";
import Accordion from "../../controls/Accordion.vue";

const props = defineProps({
  point: Object,
  log: Array,
});

const { t } = useI18n();
const mapState = useMap();
const localeComputed = computed(() => localStorage.getItem("locale") || "en");
const sensorsUI = useSensors(localeComputed);

const hasLogs = computed(() => Array.isArray(props.log) && props.log.length > 0);

const logsProgress = sensorsUI.logsProgress;

const showLogsProgress = computed(() => {
  const progress = logsProgress.value;
  if (!progress || !progress.active) return false;
  return ["week", "month"].includes(progress.mode) && mapState.timelineMode.value === progress.mode;
});

const logsProgressPercent = computed(() => {
  const progress = logsProgress.value;
  return progress?.percent || 0;
});

const logsProgressLabel = computed(() => {
  const progress = logsProgress.value;
  if (!progress || !progress.totalDays) return "";
  return `${progress.loadedDays}/${progress.totalDays}`;
});

const timelineModeLabel = computed(() => {
  const mode = mapState.timelineMode.value;
  if (mode === "week") return "Week";
  if (mode === "month") return "Month";
  return mode;
});

const isRussia = computed(() => {
  const address = props.point?.address || "";
  return /^(RU|Россия|Russia|, RU|, Россия|, Russia)/i.test(address);
});

const units = ref([]);

const scales = computed(() => {
  const buffer = [];
  Object.keys(measurements).forEach((key) => {
    if (units.value.some((unit) => unit === key)) {
      if (measurements[key].zones) {
        buffer.push(measurements[key]);
      }
    }
  });

  return buffer.sort((a, b) => {
    const nameA = a.nameshort[localeComputed.value] || "";
    const nameB = b.nameshort[localeComputed.value] || "";
    return nameA.localeCompare(nameB);
  });
});

/**
 * Строит список доступных единиц измерения на основе данных логов
 * @returns {Array} Отсортированный массив единиц измерения
 */
function buildUnitsList() {
  const set = new Set();
  if (!Array.isArray(props.log)) return Array.from(set);

  props.log.forEach((item) => {
    if (item?.data) Object.keys(item.data).forEach((u) => set.add(u.toLowerCase()));
  });

  // Добавляем AQI если есть данные PM2.5 и PM10
  const hasPM25 = props.log.some((item) => item?.data?.pm25);
  const hasPM10 = props.log.some((item) => item?.data?.pm10);
  if (hasPM25 && hasPM10) {
    set.add("aqi");
  }

  return Array.from(set).sort();
}

// Обновляем units при изменении логов
watch(
  () => props.log,
  (newLogs) => {
    if (!Array.isArray(newLogs) || newLogs.length === 0) {
      units.value = [];
      return;
    }

    const nextUnits = buildUnitsList();
    const prevUnits = units.value;
    const changed =
      nextUnits.length !== prevUnits.length || nextUnits.some((u, i) => u !== prevUnits[i]);
    if (changed) units.value = nextUnits;
  },
  { immediate: true }
);
</script>

<style scoped>
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

.chart-skeleton {
  height: 300px;
  width: 100%;
  background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

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

.logs-progress {
  margin-bottom: calc(var(--gap) * 1.5);
  display: flex;
  flex-direction: column;
  gap: calc(var(--gap) * 0.5);
}

.logs-progress-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.logs-progress-bar span {
  display: block;
  height: 100%;
  background: var(--color-dark);
  transition: width 0.2s ease;
}

.logs-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8em;
  color: var(--color-dark);
}
</style>
