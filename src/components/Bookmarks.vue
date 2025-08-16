<template>
  <template v-if="!bookmarks || bookmarks.length < 1">
    {{ $t("bookmarks.listempty") }}
  </template>
  <div class="bookmarkslist" v-else>
    <section v-for="bookmark in bookmarks" :key="bookmark.id" class="flexline">
      <a :href="getlink(bookmark)" @click.prevent="showsensor(bookmark)">
        <b v-if="bookmark?.customName" class="name">{{ bookmark.customName }}</b>
        <b v-if="bookmark?.geo" :class="bookmark.customName ? 'addresssm' : 'adresslg'">
          {{ safeGeo(bookmark.geo)?.lat }}, {{ safeGeo(bookmark.geo)?.lng }}
        </b>
      </a>
      <button title="Remove this sensor" @click.prevent="deletebookmark(bookmark.id)">
        <font-awesome-icon icon="fa-solid fa-xmark" />
      </button>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useBookmarksStore } from "@/stores/bookmarks";
import { IDBdeleteByKey, notifyDBChange } from "../utils/idb";
import schemas from "@/config/default/idb-schemas.json";
import config from "@/config/default/config.json";
import { getTypeProvider } from "@/utils/utils";

const schema = schemas?.SensorsDBBookmarks || {};
const DB_NAME = schema.dbname || "SensorsDBBookmarks";
const STORE = Object.keys(schema.stores || { bookmarks: {} })[0] || "bookmarks";

const router = useRouter();
const bookmarksStore = useBookmarksStore();
const bookmarks = computed(() => bookmarksStore.idbBookmarks);

function safeGeo(geo) {
  try { return typeof geo === "string" ? JSON.parse(geo) : geo; } catch { return null; }
}

async function deletebookmark(id) {
  await IDBdeleteByKey(DB_NAME, STORE, id);
  notifyDBChange(DB_NAME, STORE);

  const el = document.querySelector(`[data-id="${id}"]`);
  if (el && el.classList.contains("sensor-bookmarked")) {
    el.classList.remove("sensor-bookmarked");
  }
}

function getlink(bookmark) {
  if (!bookmark?.link) return "#";
  const g = safeGeo(bookmark.geo);
  if (!g) return "#";

  return router.resolve({
    name: "main",
    query: {
      provider: getTypeProvider(),
      type: config.MAP.measure,
      zoom: 18,
      lat: g.lat,
      lng: g.lng,
      sensor: bookmark.link,
    },
  }).href;
}

function showsensor(bookmark) {
  const href = getlink(bookmark);
  if (!href || href === "#") return;
  // Полная навигация с заменой записи в истории и принудительным перезапуском приложения
  window.location.replace(href);
}

let stopWatch = null;

onMounted(async () => {
  await bookmarksStore.idbBookmarkGet();
  stopWatch = bookmarksStore.watchBookmarks();
});

onUnmounted(() => {
  if (typeof stopWatch === "function") stopWatch();
});
</script>

<style scoped>
a, a b { display: block; }

.addresssm { color: var(--app-textcolor); font-size: 0.7em; }

section { justify-content: space-between; }

section:not(:last-child) {
  padding-bottom: calc(var(--gap)/2);
  margin-bottom: calc(var(--gap)/2);
  border-bottom: 1px solid var(--app-textcolor);
}

button {
  border: 0;
  cursor: pointer;
  font-size: 1.2em;
  transition: color 0.2s ease-in;
}
button:hover { color: var(--color-red); }

.bookmarkslist { max-height: 70svh; overflow-y: auto; }
</style>
