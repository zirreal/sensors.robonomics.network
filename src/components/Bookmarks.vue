<template>
  <template v-if="!bookmarks || bookmarks.length < 1">{{ $t("bookmarks.listempty") }}</template>
  <div class="bookmarkslist" v-else>
    <section v-for="bookmark in bookmarks" :key="bookmark.id" class="flexline">
      <a :href="getlink(bookmark)" @click.prevent="showsensor(bookmark)">
        <b v-if="bookmark?.customName" class="name">{{ bookmark.customName }}</b>
        <b v-if="bookmark?.geo" :class="bookmark.customName ? 'addresssm' : 'adresslg'">
          {{JSON.parse(bookmark.geo)?.lat}}, {{JSON.parse(bookmark.geo)?.lng}}
        </b>
      </a>
      <button title="Remove this sensor" @click.prevent="deletebookmark(bookmark.id)">
        <font-awesome-icon icon="fa-solid fa-xmark" />
      </button>
    </section>
  </div>
</template>

<script>
import { useStore } from "@/store";
import { IDBworkflow } from "../idb";

export default {
  data() {
    return {
      store: useStore(),
    };
  },

  computed: {
    bookmarks: function () {
      return this.store.idbBookmarks;
    },
  },

  methods: {
    deletebookmark(id) {
      IDBworkflow(
        this.store.idbBookmarkDbname,
        this.store.idbBookmarkVDbver,
        this.store.idbBookmarkVDbtable,
        "readwrite",
        (store) => {
          store.delete(id);

          const bc = new BroadcastChannel(this.store.idbWatcherBroadcast);
          bc.postMessage(this.store.idbBookmarkVDbtable);
          bc.close();
        }
      );
        const sensorElement = document.querySelector(`[data-id="${id}"]`);
        if (sensorElement && sensorElement.classList.contains('sensor-bookmarked')) {
          sensorElement.classList.remove('sensor-bookmarked');
        }
    },

    showsensor(bookmark) {
      /* 
            I'm really sorry for that, but current routing system is very complicated and it seems 
            very hard to impelement proper router mechanism here, so I just reload - positivecrash */
      window.location.href = this.getlink(bookmark);
      location.reload();
    },

    getlink(bookmark) {
      if (bookmark.link && bookmark.geo) {
        const g = JSON.parse(bookmark.geo);
        const provider = localStorage.getItem("provider_type") || "remote";
        return (
          window.location.origin +
          "/#/" +
          provider +
          "/" +
          "pm10" +
          "/" +
          "20" +
          "/" +
          g.lat +
          "/" +
          g.lng +
          "/" +
          bookmark.link
        );
      }
    },
  },
};
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
