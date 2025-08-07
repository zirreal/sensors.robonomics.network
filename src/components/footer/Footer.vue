<template>
  <div class="mapcontrols">
    <div class="flexline">
      <!-- выбор даты -->
      <input
        type="date"
        v-model="start"
        :max="maxDate"
        :disabled="currentProvider === 'realtime'"
      />

      <!-- выбор измерения -->
      <select v-model="type" v-if="mapStore.sensors.length > 0 && availableOptions?.length > 0">
        <option v-for="opt in availableOptions" :key="opt.value" :value="opt.value">
          {{ opt.name }}
        </option>
      </select>
    </div>

    <div class="flexline">
      <div id="mapsettings" class="popover-bottom-right popover" popover>
        <section>
          <ProviderType />
        </section>
        
        <section>
          <label class="label-line">
            <input id="wind" v-model="wind" type="checkbox" :disabled="!realtime" />
            <span>{{ $t("layer.wind") }}</span>
          </label>
        </section>
        <section>
          <label class="label-line">
            <input id="messages" v-model="messages" type="checkbox" />
            <span>{{ $t("layer.messages") }}</span>
          </label>
        </section>
        <hr />
        <section>
          <h3>{{ $t("history.title") }}</h3>
          <HistoryImport />
        </section>
      </div>
      <button class="popovercontrol" popovertarget="mapsettings">
        <font-awesome-icon icon="fa-solid fa-gear" />
      </button>

      <div id="bookmarks" class="popover-bottom-right popover" popover>
        <h3>{{ $t("bookmarks.listtitle") }}</h3>
        <Bookmarks />
      </div>
      <button
        class="popovercontrol bookmarksbutton"
        :class="{ active: bookmarksCount > 0 }"
        popovertarget="bookmarks"
      >
        <font-awesome-icon icon="fa-solid fa-bookmark" />
        <b v-if="bookmarksCount > 0">{{ bookmarksCount }}</b>
      </button>

      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import moment from "moment";
import config from "@config";
import Bookmarks from "@/components/Bookmarks.vue";
import HistoryImport from "./HistoryImport.vue";
import { instanceMap } from "../../utils/map/instance";
import { switchMessagesLayer } from "../../utils/map/marker";
import { switchLayer } from "../../utils/map/wind";
import measurements from "../../measurements";
import { getTypeProvider } from "../../utils/utils";
import { Remote } from "../../providers";
import ProviderType from "../ProviderType.vue";

import { useBookmarksStore } from "@/stores/bookmarks";
import { useMapStore } from "@/stores/map";

// props и emits
const props = defineProps({
  currentProvider: { type: String, required: true },
  canHistory: { type: Boolean, default: false },
  measuretype: { type: String, required: true },
});
const emit = defineEmits(["history"]);

// инстансы
const mapStore = useMapStore();
const bookmarksStore = useBookmarksStore();
const router = useRouter();
const route = useRoute();
const { locale: i18nLocale, t } = useI18n();

// состояние
const start = ref(moment().format("YYYY-MM-DD"));
const maxDate = ref(moment().format("YYYY-MM-DD"));
const realtime = ref(props.currentProvider === "realtime");
const wind = ref(false);
const messages = ref(config.SHOW_MESSAGES);

// выбор измерения
const type = ref(props.measuretype.toLowerCase());
const availableUnits = ref(["pm10"]);
const locale = computed(() => {
  return i18nLocale.value || localStorage.getItem("locale") || "en";
});

// опции для select
// const availableOptions = computed(() => {
//   const opts = availableUnits.value
//     .filter((key) => !['pm10', 'pm25', 'noise', 'noisemax', 'noiseavg'].includes(key)) // Remove pm10, pm25, noise, noisemax
//     .map((key) => {
//       const info = measurements[key];
//       if (!info) return null;
//       return {
//         value: key,
//         name: info.nameshort?.[locale.value] || info.label,
//       };
//     })
//     .filter(Boolean);

//   // Add synthetic "dust" option (represents pm10 & pm25)
//   opts.push({
//     value: 'pm10',
//     name: locale.value === 'en' ? 'Dust & Particles' : t('Dust & Particles'), 
//   });

//   // Add synthetic "noise" option (represents noise, noisemax & noiseavg)
//   opts.push({
//     value: 'noisemax',
//     name: locale.value === 'en' ? 'Noise' : t('Noise'),
//   });

//   return opts;
// });

const availableOptions = computed(() => {
  const opts = availableUnits.value
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
  return opts;
});

// вычисления для истории
const startTimestamp = computed(() => {
  return moment(`${start.value} 00:00:00`, "YYYY-MM-DD HH:mm:ss").format("X");
});

const endTimestamp = computed(() => {
  return moment(`${start.value} 23:59:59`, "YYYY-MM-DD HH:mm:ss").format("X");
});

const bookmarksCount = computed(() => {
  return (bookmarksStore.idbBookmarks || []).length;
});

const getHistory = () => {
  if (realtime.value) return;
  emit("history", { start: startTimestamp.value, end: endTimestamp.value });
};

watch(type, async (val) => {
  await router.push({
    name: "main",
    query: {
      provider: getTypeProvider(),
      type: val,
      zoom: route.query.zoom,
      lat: route.query.lat,
      lng: route.query.lng,
      sensor: route.query.sensor,
    },
  });
  // router.go(0)
  window.location.reload();
});

watch(start, () => getHistory());
watch(
  () => props.canHistory,
  (v) => v && getHistory(),
  { immediate: true }
);
watch(wind, (v) => switchLayer(instanceMap(), v));
watch(messages, (v) => switchMessagesLayer(instanceMap(), v));

// загрузка списка измерений из API
onMounted(async () => {
  try {
    const arr = await Remote.getMeasurements(startTimestamp.value, endTimestamp.value);
    const toMove = ["pm10", "pm25"];
    const head = arr.filter((v) => toMove.includes(v));
    const tail = arr.filter((v) => !toMove.includes(v));
    availableUnits.value = [...head, ...tail];
  } catch (e) {
    console.error(e);
  }
});
</script>

<style>
.popovercontrol.active {
  border-color: var(--color-green);
}

.popovercontrol.active path {
  fill: var(--color-green) !important;
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

.bookmarksbutton {
  position: relative;
}

.bookmarksbutton b {
  font-size: 80%;
  position: absolute;
  top: -10px;
  right: -10px;
  background-color: var(--color-orange);
  border-radius: 10px;
  color: var(--color-light);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#mapsettings {
  min-width: 20vw;
}

@media screen and (max-width: 560px) {
  .mapcontrols, .mapcontrols .flexline {
    flex-direction: column;
    gap: var(--gap);
    align-items: end;
  }
}
</style>
