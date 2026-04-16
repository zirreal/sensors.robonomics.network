<template>
  <section class="bookmark-card">
    <div class="bookmark-head">
      <div class="bookmark-meta">
        <div class="bookmark-sub">
          <span v-if="IsBookmarked" class="badge badge-saved">{{ $t("Saved") || "Saved" }}</span>
          <span v-else class="badge badge-empty">{{ $t("Not saved") || "Not saved" }}</span>
          <span v-if="bookmarkname && IsBookmarked" class="bookmark-name"
            >“{{ bookmarkname }}”</span
          >
        </div>
      </div>

      <div class="bookmark-actions">
        <button
          v-if="!IsBookmarked"
          type="button"
          class="button bookmark-primary"
          @click.prevent="addbookmark"
          :aria-label="t('sensorpopup.bookmarkbutton')"
          :title="t('sensorpopup.bookmarkbutton')"
        >
          <font-awesome-icon icon="fa-solid fa-bookmark" />
          <span>{{ $t("Save") || "Save" }}</span>
        </button>

        <template v-else>
          <button
            v-if="!isEditing"
            type="button"
            class="button button-round-outline"
            @click.prevent="startEditing"
            :aria-label="t('sensorpopup.editbookmark') || 'Rename bookmark'"
            :title="t('sensorpopup.editbookmark') || 'Rename bookmark'"
          >
            <font-awesome-icon icon="fa-solid fa-pencil" />
          </button>

          <button
            type="button"
            class="button button-round-outline bookmark-danger"
            @click.prevent="deletebookmark"
            :aria-label="t('sensorpopup.deletebookmark') || 'Remove bookmark'"
            :title="t('sensorpopup.deletebookmark') || 'Remove bookmark'"
          >
            <font-awesome-icon icon="fa-solid fa-trash" />
          </button>
        </template>
      </div>
    </div>

    <form class="bookmark-form" @submit.prevent="handleSubmit">
      <label class="bookmark-field">
        <div class="bookmark-field-head">
          <span class="bookmark-field-title">{{ $t("Name") || "Name" }}</span>
          <span class="bookmark-field-hint">{{ $t("Optional") || "Optional" }}</span>
        </div>

        <input
          type="text"
          v-model="bookmarkname"
          :placeholder="t('sensorpopup.bookmarkplaceholder')"
          :disabled="IsBookmarked && !isEditing"
        />
      </label>

      <div v-if="isEditing" class="bookmark-form-actions">
        <button
          type="submit"
          class="button"
          :disabled="!hasUnsavedChanges"
          :aria-label="t('sensorpopup.savebookmark') || 'Save bookmark'"
          :title="t('sensorpopup.savebookmark') || 'Save bookmark'"
        >
          <font-awesome-icon icon="fa-solid fa-floppy-disk" />
          <span>{{ $t("Save") || "Save" }}</span>
        </button>
        <button
          type="button"
          class="button button-round-outline"
          @click.prevent="cancelEditing"
          aria-label="Cancel"
          title="Cancel"
        >
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </button>
      </div>
    </form>
  </section>
</template>

<script>
import { useI18n } from "vue-i18n";
import { IDBgettable, IDBworkflow, IDBdeleteByKey, notifyDBChange } from "../../../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.Sensors;
const DB_NAME = schema?.dbname;
const STORE = Object.keys(schema?.stores || {}).find((key) => key === "bookmarks") || null;

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
      const sensorElement = document.querySelector(`[data-id="${this.$props.id}"]`);

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
            id: this.$props.id,
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

      const sensorElement = document.querySelector(`[data-id="${this.$props.id}"]`);

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
.bookmark-card {
  display: grid;
  gap: calc(var(--gap) * 0.9);
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.bookmark-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(var(--gap) * 0.8);
}

.bookmark-sub {
  display: flex;
  gap: calc(var(--gap) * 0.5);
  align-items: center;
  flex-wrap: wrap;
  opacity: 0.85;
}

.bookmark-name {
  font-weight: 700;
}

.badge {
  font-size: 0.78em;
  font-weight: 900;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.02);
}

.badge-saved {
  border-color: rgba(40, 170, 85, 0.35);
  background: rgba(40, 170, 85, 0.08);
  color: var(--color-green);
}

.badge-empty {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.02);
}

.bookmark-actions {
  display: inline-flex;
  gap: calc(var(--gap) * 0.5);
  align-items: center;
  flex: 0 0 auto;
}

.bookmark-primary {
  white-space: nowrap;
}

.bookmark-danger {
  border-color: rgba(220, 70, 70, 0.35);
}

.bookmark-danger:hover {
  color: var(--color-red);
}

.bookmark-form {
  display: grid;
  gap: calc(var(--gap) * 0.6);
}

.bookmark-form input[type="text"] {
  width: 100%;
  box-sizing: border-box;
}

.bookmark-field {
  display: grid;
  gap: calc(var(--gap) * 0.45);
}

.bookmark-field-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: calc(var(--gap) * 0.5);
}

.bookmark-field-title {
  font-weight: 800;
}

.bookmark-field-hint {
  opacity: 0.6;
  font-size: 0.9em;
  font-weight: 700;
}

.bookmark-form-actions {
  display: flex;
  gap: calc(var(--gap) * 0.5);
  flex-wrap: wrap;
}

@media screen and (max-width: 520px) {
  .bookmark-head {
    flex-direction: column;
    align-items: stretch;
  }

  .bookmark-actions {
    justify-content: flex-start;
  }
}
</style>
