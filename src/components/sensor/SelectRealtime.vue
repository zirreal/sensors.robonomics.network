<template>
  <div class="sensors-select sensors-select-border">
    <select
      :style="{ width: width ? '100%' : null }"
      @change="changeMode"
      v-model="mode"
      class="sensors-select-city"
    >
      <option value="realtime">Realtime</option>
      <option value="remote">Daily Recap</option>
    </select>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";

const props = defineProps({
  provider: { type: String, required: true },
  width: { type: Boolean },
});

const router = useRouter();
const route = useRoute();
const mode = ref(props.provider);

const changeMode = async () => {
  await router.push({
    name: "main",
    params: {
      provider: mode.value,
      type: route.params.type,
      zoom: route.params.zoom,
      lat: route.params.lat,
      lng: route.params.lng,
      sensor: route.params.sensor,
    },
  });
  window.location.reload();
};
</script>

<style scoped>
select {
  min-width: 130px;
  margin-bottom: 1rem;
}
</style>
