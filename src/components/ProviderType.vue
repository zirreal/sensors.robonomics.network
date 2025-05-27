<template>
  <select v-model="dataMode" @change="changeDataMode" class="provider-select">
    <option
      v-for="([key, label]) in options"
      :key="key"
      :value="key"
    >
      {{ label }}
    </option>
  </select>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from "vue-router";
import config from '@config';
import { getTypeProvider, setTypeProvider } from '@/utils/utils';

const router = useRouter();
const route = useRoute();

// List of all available providers
const options = computed(() => Object.entries(config.VALID_DATA_PROVIDERS));

// Current provider (key)
const dataMode = ref(getTypeProvider(route.params));

const changeDataMode = async () => {
  setTypeProvider(dataMode.value);
  await router.push({
    name: "main",
    params: { ...route.params, provider: dataMode.value },
  });
  window.location.reload();
}
</script>