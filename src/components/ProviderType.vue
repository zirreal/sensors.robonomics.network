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
import { getTypeProvider, setTypeProvider } from '@/utils/utils';
import { useMapStore } from '@/stores/map';
import { dayISO } from '@/utils/date';

const router = useRouter();
const route = useRoute();
const mapStore = useMapStore();

// List of all available providers
const options = computed(() => Object.entries(settings.VALID_DATA_PROVIDERS));

// Current provider (key)
const dataMode = ref(getTypeProvider(route.query));

const changeDataMode = async () => {
  setTypeProvider(dataMode.value);
  
  // Если переключаемся на realtime, устанавливаем дату на сегодня
  let newDate = route.query.date || mapStore.currentDate;
  if (dataMode.value === 'realtime') {
    newDate = dayISO();
    mapStore.setCurrentDate(newDate);
  }
  
  await router.push({
    name: "main",
    query: { 
      ...route.query, 
      provider: dataMode.value,
      date: newDate
    },
  });
  window.location.reload();
};
</script>
