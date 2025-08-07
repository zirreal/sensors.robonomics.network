<template>
  <template v-if="!bookmarks || bookmarks.length < 1">{{ $t("bookmarks.listempty") }}</template>
  <div class="bookmarkslist" v-else>
    <section v-for="bookmark in bookmarks" :key="bookmark.id" class="flexline">
      <a :href="getlink(bookmark)" @click.prevent="showsensor(bookmark)">
        <b v-if="bookmark?.customName" class="name">{{ bookmark.customName }}</b>
        <b v-if="bookmark?.geo" :class="bookmark.customName ? 'addresssm' : 'adresslg'">
          {{ JSON.parse(bookmark.geo)?.lat }}, {{ JSON.parse(bookmark.geo)?.lng }}
        </b>
      </a>
      <button title="Remove this sensor" @click.prevent="deletebookmark(bookmark.id)">
        <font-awesome-icon icon="fa-solid fa-xmark" />
      </button>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useBookmarksStore } from "@/stores/bookmarks";
import { useRouter } from "vue-router";
import { IDBworkflow } from "../idb";

const router = useRouter();
const bookmarksStore = useBookmarksStore();
const bookmarks = computed(() => bookmarksStore.idbBookmarks);

function deletebookmark(id) {
  IDBworkflow(
    bookmarksStore.idbBookmarkDbname,
    bookmarksStore.idbBookmarkVDbver,
    bookmarksStore.idbBookmarkVDbtable,
    "readwrite",
    (storeObj) => {
      storeObj.delete(id);

      const bc = new BroadcastChannel(bookmarksStore.idbWatcherBroadcast);
      bc.postMessage(bookmarksStore.idbBookmarkVDbtable);
      bc.close();
    }
  );

  const sensorElement = document.querySelector(`[data-id="${id}"]`);
  if (sensorElement && sensorElement.classList.contains("sensor-bookmarked")) {
    sensorElement.classList.remove("sensor-bookmarked");
  }
}

function showsensor(bookmark) {
  window.location.href = getlink(bookmark);
  location.reload();
}

function getlink(bookmark) {
  if (bookmark.link && bookmark.geo) {
    const g = JSON.parse(bookmark.geo);
    const provider = localStorage.getItem("provider_type") || "remote";
    return router.resolve({
      name: "main",
      query: {
        provider: provider,
        type: "pm10",
        zoom: "20",
        lat: g.lat,
        lng: g.lng,
        sensor: bookmark.link,
      },
    }).href;
  }
}

onMounted(() => {
  bookmarksStore.idbBookmarkGet();
});
</script>

<style scoped>
a,
a b {
  display: block;
}

.addresssm {
  color: var(--app-textcolor);
  font-size: 0.7em;
}

section {
  justify-content: space-between;
}

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

button:hover {
  color: var(--color-red);
}

.bookmarkslist {
  max-height: 70svh;
  overflow-y: auto;
}
</style>