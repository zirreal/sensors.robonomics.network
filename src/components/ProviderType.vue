<template>
  <select v-model="dataMode" class="provider-select">
    <option v-for="[key, label] in options" :key="key" :value="key">
      {{ $t(label) }}
    </option>
  </select>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { settings } from "@config";
import { useMap } from "@/composables/useMap";
import { dayISO } from "@/utils/date";

const router = useRouter();
const route = useRoute();
const mapState = useMap();

// List of all available providers
const options = computed(() => Object.entries(settings.VALID_DATA_PROVIDERS));

// Current provider (key) - используем composable
const dataMode = computed({
  get: () => mapState.currentProvider.value,
  set: (value) => {
    // Обновляем провайдер через setMapSettings
    const newSettings = { provider: value };

    // Если переключаемся на realtime, устанавливаем дату на сегодня
    if (value === "realtime") {
      newSettings.date = dayISO();
    }

    // Устанавливаем настройки и синхронизируем
    mapState.setMapSettings(route, router, newSettings);
  },
});

// Watcher для синхронизации с внешними изменениями провайдера
watch(
  () => mapState.currentProvider.value,
  (newProvider) => {
    // Синхронизируем с внешними изменениями
    if (newProvider !== dataMode.value) {
      // dataMode автоматически обновится через computed
    }
  }
);
</script>
