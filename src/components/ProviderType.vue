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
// import { getTypeProvider, setTypeProvider } from '@/utils/utils'; // deprecated
import { useMapStore } from '@/stores/map';
import { dayISO } from '@/utils/date';
import { setMapSettings } from '@/utils/utils';

const router = useRouter();
const route = useRoute();
const mapStore = useMapStore();

// List of all available providers
const options = computed(() => Object.entries(settings.VALID_DATA_PROVIDERS));

// Current provider (key) - используем store
const dataMode = ref(mapStore.currentProvider);

const changeDataMode = async () => {
  const settings = { provider: dataMode.value };
  
  // Если переключаемся на realtime, устанавливаем дату на сегодня
  if (dataMode.value === 'realtime') {
    settings.date = dayISO();
  }
  
  // Устанавливаем настройки и синхронизируем
  setMapSettings(route, router, mapStore, settings);
  
  // Даем время на обновление store, затем перезагружаем
  setTimeout(() => {
    window.location.reload();
  }, 100);
};
</script>
