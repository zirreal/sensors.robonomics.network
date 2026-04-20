<template>
  <!-- <h4>{{ t('sensorpopup.bookmarkbutton') }}</h4> -->

  <form @submit.prevent="handleSubmit">
    <input
      type="text"
      v-model="bookmarkname"
      :placeholder="t('sensorpopup.bookmarkplaceholder')"
      :disabled="IsBookmarked && !isEditing"
    />
    <div class="flexline">
      <button
        v-if="!IsBookmarked"
        type="submit"
        class="button"
        :area-label="t('sensorpopup.bookmarkbutton')"
        :title="t('sensorpopup.bookmarkbutton')"
      >
        <font-awesome-icon icon="fa-solid fa-bookmark" />
      </button>
      <button
        v-if="IsBookmarked && !isEditing"
        type="button"
        class="button"
        @click.prevent="startEditing"
        :area-label="t('sensorpopup.editbookmark') || 'Edit bookmark'"
        :title="t('sensorpopup.editbookmark') || 'Edit bookmark'"
      >
        <font-awesome-icon icon="fa-solid fa-pencil" />
      </button>
      <button
        v-if="isEditing"
        type="submit"
        :class="['button', { 'button-green': !hasUnsavedChanges }]"
        :disabled="!hasUnsavedChanges"
        :area-label="t('sensorpopup.savebookmark') || 'Save bookmark'"
        :title="t('sensorpopup.savebookmark') || 'Save bookmark'"
      >
        <font-awesome-icon v-if="hasUnsavedChanges" icon="fa-solid fa-floppy-disk" />
        <font-awesome-icon v-else icon="fa-solid fa-check" />
      </button>
      <button
        v-if="IsBookmarked"
        type="button"
        class="button button-red"
        @click.prevent="deletebookmark"
        :area-label="t('sensorpopup.deletebookmark') || 'Delete bookmark'"
        :title="t('sensorpopup.deletebookmark') || 'Delete bookmark'"
      >
        <font-awesome-icon icon="fa-solid fa-trash" />
      </button>
    </div>
  </form>
</template>

<script>
import { useI18n } from "vue-i18n";
import { IDBgettable, IDBworkflow, IDBdeleteByKey, notifyDBChange } from "../../../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.Sensors;
const DB_NAME = schema?.dbname;
const STORE = Object.keys(schema?.stores || {}).find((key) => key === "bookmarks") || null;

export default {
  props: {
    point: {
      type: Object,
      default: null,
    },
  },

  setup() {
    const { t } = useI18n();
    return { t };
  },

  data() {
    return {
      IsBookmarked: false,
      bookmarks: [],
      bookmarkid: null,
      bookmarkname: "",
      savedBookmarkname: "", // Сохраненное значение для сравнения
      isEditing: false,
    };
  },

  computed: {
    /** ID сенсора для закладки и селектора маркера на карте */
    sensorId() {
      return this.point?.sensor_id ?? null;
    },
    hasUnsavedChanges() {
      return this.isEditing && this.bookmarkname !== this.savedBookmarkname;
    },
  },

  watch: {
    sensorId() {
      this.loadBookmarkFromStorage();
    },
  },

  methods: {
    async findbookmark() {
      const sid = this.sensorId;
      if (!sid) return null;
      const bookmarks = await IDBgettable(DB_NAME, STORE);
      const found = bookmarks.find((bookmark) => bookmark.id === sid);
      return found;
    },

    async loadBookmarkFromStorage() {
      this.IsBookmarked = false;
      this.bookmarkid = null;
      this.bookmarkname = "";
      this.savedBookmarkname = "";
      this.isEditing = false;
      if (!this.sensorId) return;
      const bookmark = await this.findbookmark();
      if (bookmark) {
        this.IsBookmarked = true;
        this.bookmarkid = bookmark.id;
        this.bookmarkname = bookmark.name;
        this.savedBookmarkname = bookmark.name;
      }
    },

    startEditing() {
      this.savedBookmarkname = this.bookmarkname; // Сохраняем исходное значение
      this.isEditing = true;
    },

    cancelEditing() {
      this.bookmarkname = this.savedBookmarkname;
      this.isEditing = false;
    },

    handleSubmit() {
      this.addbookmark();
    },

    async addbookmark() {
      if (!this.bookmarkname) {
        this.bookmarkname = (this.$props.address || this.$props.id || "").toString().trim();
      }
      const bookmark = await this.findbookmark();
      const sensorElement = document.querySelector(`[data-id="${this.sensorId}"]`);

      if (bookmark) {
        if (this.bookmarkid) {
          IDBworkflow(DB_NAME, STORE, "readwrite", (store) => {
            const request = store.get(this.bookmarkid);

            request.addEventListener("error", (e) => {
              console.error(e);
            });

            request.addEventListener("success", (e) => {
              const data = e.target.result;
              data.name = this.bookmarkname; // Обновляем поле name вместо customName
              const requestUpdate = store.put(data);

              requestUpdate.addEventListener("error", (e) => {
                console.error(e);
              });

              requestUpdate.addEventListener("success", () => {
                if (sensorElement && !sensorElement.classList.contains("sensor-bookmarked")) {
                  sensorElement.classList.add("sensor-bookmarked");
                }
                this.IsBookmarked = true;
                this.isEditing = false;
                this.savedBookmarkname = this.bookmarkname; // Обновляем сохраненное значение
                notifyDBChange(DB_NAME, STORE);
              });
            });
          });
        }
      } else {
        IDBworkflow(DB_NAME, STORE, "readwrite", (store) => {
          store.add({
            name: this.bookmarkname, // Используем упрощенную структуру
            id: this.sensorId,
          });
          if (sensorElement && !sensorElement.classList.contains("sensor-bookmarked")) {
            sensorElement.classList.add("sensor-bookmarked");
          }
          this.IsBookmarked = true;
          this.isEditing = false;
          this.savedBookmarkname = this.bookmarkname; // Обновляем сохраненное значение
          notifyDBChange(DB_NAME, STORE);
        });
      }
    },

    async deletebookmark() {
      if (!this.bookmarkid) return;

      const sensorElement = document.querySelector(`[data-id="${this.sensorId}"]`);

      try {
        await IDBdeleteByKey(DB_NAME, STORE, this.bookmarkid);

        if (sensorElement && sensorElement.classList.contains("sensor-bookmarked")) {
          sensorElement.classList.remove("sensor-bookmarked");
        }

        this.IsBookmarked = false;
        this.bookmarkid = null;
        this.bookmarkname = "";
        this.isEditing = false;
        this.savedBookmarkname = "";
        notifyDBChange(DB_NAME, STORE);
      } catch (error) {
        console.error("Error deleting bookmark:", error);
      }
    },
  },

  mounted() {
    this.loadBookmarkFromStorage();
  },
};
</script>

<style scoped>
form {
  width: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--gap);
}

button {
  padding-right: calc(var(--app-inputpadding) * 2);
  padding-left: calc(var(--app-inputpadding) * 2);
  height: 100%;
}
</style>
