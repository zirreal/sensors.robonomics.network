<template>
  <form class="flexline" @submit.prevent="addbookmark">
    <input
      type="text"
      v-model="bookmarkname"
      :placeholder="$t('sensorpopup.bookmarkplaceholder')"
      @input="IsBookmarked = false"
    />
    <button
      :class="buttonclasses"
      :disabled="IsBookmarked"
      :area-label="$t('sensorpopup.bookmarkbutton')"
      :title="$t('sensorpopup.bookmarkbutton')"
    >
      <template v-if="!IsBookmarked">
        <font-awesome-icon icon="fa-solid fa-bookmark" />
      </template>
      <template v-else>
        <font-awesome-icon icon="fa-solid fa-check" />
      </template>
    </button>
  </form>
</template>

<script>
import { useBookmarksStore } from "@/stores/bookmarks";
import {
  IDBgettable,
  IDBworkflow,
  notifyDBChange,
} from "../../utils/idb";
import schemas from "@/config/default/idb-schemas.json";

const schema = schemas?.SensorsDBBookmarks || {};
const DB_NAME = schema.dbname || "SensorsDBBookmarks";
const STORE = Object.keys(schema.stores || { bookmarks: {} })[0] || "bookmarks";

export default {
  props: ["address", "link", "geo", "id"],

  data() {
    return {
      IsBookmarked: false,
      bookmarks: [],
      bookmarkid: null,
      bookmarkname: "",
      bookmarksStore: useBookmarksStore(),
    };
  },

  computed: {
    buttonclasses() {
      return {
        button: true,
        "button-green": this.IsBookmarked,
      };
    },
  },

  methods: {
    async findbookmark() {
      const bookmarks = await IDBgettable(DB_NAME, STORE);
      return bookmarks.find((bookmark) => bookmark.id === this.$props.id);
    },

    async addbookmark() {
      const bookmark = await this.findbookmark();
      const sensorElement = document.querySelector(
        `[data-id="${this.$props.id}"]`
      );

      if (bookmark) {
        if (this.bookmarkid) {
          IDBworkflow(DB_NAME, STORE, "readwrite", (store) => {
            const request = store.get(this.bookmarkid);

            request.addEventListener("error", (e) => {
              console.error(e);
            });

            request.addEventListener("success", (e) => {
              const data = e.target.result;
              data.customName = this.bookmarkname;
              const requestUpdate = store.put(data);

              requestUpdate.addEventListener("error", (e) => {
                console.error(e);
              });

              requestUpdate.addEventListener("success", () => {
                if (
                  sensorElement &&
                  !sensorElement.classList.contains("sensor-bookmarked")
                ) {
                  sensorElement.classList.add("sensor-bookmarked");
                }
                this.IsBookmarked = true;
                notifyDBChange(DB_NAME, STORE);
              });
            });
          });
        }
      } else {
        IDBworkflow(DB_NAME, STORE, "readwrite", (store) => {
          store.add({
            customName: this.bookmarkname,
            id: this.$props.id,
            link: this.$props.link,
            geo: JSON.stringify(this.$props.geo),
          });
          if (
            sensorElement &&
            !sensorElement.classList.contains("sensor-bookmarked")
          ) {
            sensorElement.classList.add("sensor-bookmarked");
          }
          this.IsBookmarked = true;
          notifyDBChange(DB_NAME, STORE);
        });
      }
    },
  },

  async mounted() {
    const bookmark = await this.findbookmark();
    if (bookmark) {
      this.IsBookmarked = true;
      this.bookmarkid = bookmark.id;
      this.bookmarkname = bookmark.customName;
    }
  },
};
</script>

<style scoped>
button {
  padding-right: calc(var(--app-inputpadding) * 2);
  padding-left: calc(var(--app-inputpadding) * 2);
}
</style>
