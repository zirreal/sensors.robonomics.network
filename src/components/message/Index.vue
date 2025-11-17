<template>
  <div class="popup-js active">
    <section>
      <h3 class="message-title clipoverflow">
        <font-awesome-icon icon="fa-solid fa-message" />
        <span v-if="message?.address">{{ message.address }}</span>
        <span v-else class="skeleton skeleton-text"></span>
      </h3>
    </section>

    <div class="scrollable-y">
      <section>
        <div class="message-content">
          <div v-if="message?.message" class="formatted-text">{{ formattedMessage }}</div>
          <div v-else class="skeleton skeleton-text"></div>
        </div>
      </section>

      <section>
        <h3>{{ t("messagepopup.infotitle") }}</h3>

        <div class="infoline flexline" v-if="message?.timestamp">
          <div class="infoline-title">{{ t("messagepopup.infotime") }}:</div>
          <div class="infoline-info">
            {{ formatTimestamp(message.timestamp) }}
          </div>
        </div>

        <div class="infoline flexline" v-if="geo && geo.lat && geo.lng">
          <div class="infoline-title">{{ t("messagepopup.infogeo") }}:</div>
          <div class="infoline-info">
            <a
              :href="getMapLink(geo.lat, geo.lng, `Message: ${message?.author || 'Unknown'}`)"
              target="_blank"
              >{{ geo.lat }}, {{ geo.lng }}</a
            >
          </div>
        </div>

        <div class="infoline flexline" v-if="message?.id">
          <div class="infoline-title">{{ t("messagepopup.infoid") }}:</div>
          <div class="infoline-info">
            {{ filters.collapse(message.id) }}
            <Copy
              :msg="message.id"
              :title="`Message id: ${message.id}`"
              :notify="t('details.copied')"
            />
          </div>
        </div>
      </section>

      <section class="flexline space-between">
        <div class="flexline">
          <!-- Здесь можно добавить закладку для сообщений, если нужно -->
        </div>
        <div class="shared-container">
          <button
            v-if="globalWindow.navigator.share"
            @click.prevent="shareData"
            class="button"
            :title="t('messagepopup.sharedefault')"
          >
            <font-awesome-icon icon="fa-solid fa-share-from-square" v-if="!state.sharedDefault" />
            <font-awesome-icon icon="fa-solid fa-check" v-if="state.sharedDefault" />
          </button>
        </div>
      </section>

      <ReleaseInfo />
    </div>

    <button @click.prevent="closeMessage" aria-label="Close message" class="close">
      <font-awesome-icon icon="fa-solid fa-xmark" />
    </button>
  </div>
</template>

<script setup>
import { reactive, computed, getCurrentInstance } from "vue";
import { useI18n } from "vue-i18n";
import { settings } from "@config";

import Copy from "../controls/Copy.vue";
import ReleaseInfo from "../ReleaseInfo.vue";

const props = defineProps({
  message: Object,
  geo: Object,
});

const emit = defineEmits(["close"]);

// Computed для форматирования текста сообщения
const formattedMessage = computed(() => {
  if (!props.message?.message) return "";

  // Заменяем \n на настоящие переносы строк
  return props.message.message.replace(/\\n/g, "\n");
});

const { t } = useI18n();
const { proxy } = getCurrentInstance();
const filters = proxy.$filters;
const globalWindow = window;

// Локальное состояние только для UI компонента
const state = reactive({
  sharedDefault: false,
});

const shareData = () => {
  if (navigator.share) {
    navigator.share({
      title: settings.TITLE,
      url: window.location.href,
    });
  }
};

const closeMessage = () => {
  emit("close");
};

/**
 * Форматирует timestamp в читаемый формат
 * @param {number|string} timestamp - Временная метка
 * @returns {string} Отформатированная дата
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";

  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  } catch (error) {
    return timestamp.toString();
  }
};

/**
 * Генерирует ссылку на карту в зависимости от устройства
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {string} [label="Message"] - Подпись для метки
 * @returns {string} URL ссылки на карту
 */
function getMapLink(lat, lon, label = "Message") {
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
</script>

<style scoped>
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
}

.close {
  border: 0;
  color: var(--color-dark);
  cursor: pointer;
  position: absolute;
  right: var(--gap);
  top: var(--gap);
}

.close:hover {
  color: var(--color-red);
}

.close svg {
  height: 2rem;
}

.message-title {
  display: flex;
  gap: var(--gap);
  align-items: center;
  margin-right: 2rem;
}

.message-title span {
  font-size: inherit;
}

.message-content {
  margin-bottom: var(--gap);
}

.message-content p {
  margin: 0;
  line-height: 1.5;
  word-wrap: break-word;
}

.formatted-text {
  white-space: pre-line;
  line-height: 1.5;
  word-wrap: break-word;
  margin: 0;
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

.infoline.flexline {
  gap: calc(var(--gap) * 0.5);
}

.infoline-title {
  font-weight: bold;
}

/* shared container */
.shared-container button:first-of-type {
  margin-right: 10px;
}

@media screen and (max-width: 570px) {
  .shared-container {
    display: flex;
    gap: 10px;
    padding-right: 10px;
  }
  .shared-container button:first-of-type {
    margin-right: 0;
    flex-shrink: 0;
  }

  .shared-container button {
    min-width: 20px;
    min-height: 20px;
  }
}

@media screen and (max-width: 700px) {
  .popup-js.active {
    left: 0;
    width: 100%;
    top: 0;
    padding-right: calc(var(--gap) * 0.5);
    padding-top: calc(2rem + var(--gap));
  }

  .close {
    font-size: 2rem !important;
  }
}

@container popup (min-width: 400px) {
  .close {
    font-size: 1.8em;
  }
}

@container popup (max-width: 400px) {
  h3.flexline {
    max-width: calc(100% - var(--gap) * 3);
  }

  .close {
    font-size: 1.8em;
  }
}
</style>
