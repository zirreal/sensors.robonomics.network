<template>
  <select v-model="dataMode" @change="changeDataMode" class="provider-select">
    <option
      v-for="([key, label]) in options"
      :key="key"
      :value="key"
    >
      {{ $t(label) }}
    </option>
  </select>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from "vue-router";
import { settings } from '@config';
import { useMap } from '@/composables/useMap';
import { dayISO } from '@/utils/date';

const router = useRouter();
const route = useRoute();
const mapState = useMap();

// List of all available providers
const options = computed(() => Object.entries(settings.VALID_DATA_PROVIDERS));

// Current provider (key) - используем composable
const dataMode = ref(mapState.currentProvider.value);

const changeDataMode = async () => {
  const settings = { provider: dataMode.value };
  
  // Если переключаемся на realtime, устанавливаем дату на сегодня
  if (dataMode.value === 'realtime') {
    settings.date = dayISO();
  }
  
  // Устанавливаем настройки и синхронизируем
  mapState.setMapSettings(route, router, settings);
  
  // Даем время на обновление store, затем перезагружаем
  setTimeout(() => {
    window.location.reload();
  }, 100);
};
</script>
