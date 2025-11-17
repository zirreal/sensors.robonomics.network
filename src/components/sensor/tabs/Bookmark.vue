<template>
  <!-- <h4>{{ t('sensorpopup.bookmarkbutton') }}</h4> -->
  
  <form class="flexline" @submit.prevent="handleSubmit">
    <input
      type="text"
      v-model="bookmarkname"
      :placeholder="t('sensorpopup.bookmarkplaceholder')"
      :disabled="IsBookmarked && !isEditing"
    />
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
  </form>
</template>

<script>
import { useI18n } from 'vue-i18n';
import {
  IDBgettable,
  IDBworkflow,
  IDBdeleteByKey,
  notifyDBChange,
} from "../../../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.Sensors;
const DB_NAME = schema?.dbname;
const STORE = Object.keys(schema?.stores || {}).find(key => key === "bookmarks") || null;

export default {
  props: ["address", "geo", "id"],

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
    hasUnsavedChanges() {
      return this.isEditing && this.bookmarkname !== this.savedBookmarkname;
    },
  },

  methods: {
    async findbookmark() {
      const bookmarks = await IDBgettable(DB_NAME, STORE);
      const found = bookmarks.find((bookmark) => bookmark.id === this.$props.id);
      return found;
    },

    startEditing() {
      this.savedBookmarkname = this.bookmarkname; // Сохраняем исходное значение
      this.isEditing = true;
    },

    handleSubmit() {
      this.addbookmark();
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
              data.name = this.bookmarkname; // Обновляем поле name вместо customName
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
            id: this.$props.id
          });
          if (
            sensorElement &&
            !sensorElement.classList.contains("sensor-bookmarked")
          ) {
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
      
      const sensorElement = document.querySelector(
        `[data-id="${this.$props.id}"]`
      );

      try {
        await IDBdeleteByKey(DB_NAME, STORE, this.bookmarkid);
        
        if (sensorElement && sensorElement.classList.contains("sensor-bookmarked")) {
          sensorElement.classList.remove("sensor-bookmarked");
        }
        
        this.IsBookmarked = false;
        this.bookmarkid = null;
        this.bookmarkname = "";
        this.isEditing = false;
        notifyDBChange(DB_NAME, STORE);
      } catch (error) {
        console.error('Error deleting bookmark:', error);
      }
    },
  },

  async mounted() {
    const bookmark = await this.findbookmark();
    
    if (bookmark) {
      this.IsBookmarked = true;
      this.bookmarkid = bookmark.id;
      this.bookmarkname = bookmark.name; // Используем поле name
      this.savedBookmarkname = bookmark.name; // Сохраняем исходное значение
    }
  },
};
</script>

<style scoped>
form {
  width: fit-content;
  margin: 0 auto;
}

button {
  padding-right: calc(var(--app-inputpadding) * 2);
  padding-left: calc(var(--app-inputpadding) * 2);
}
</style>
