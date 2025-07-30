<template>
    <img v-if="icon" :src="icon" />
    <font-awesome-icon v-else icon="fa-solid fa-location-dot" />
</template>

<script setup>
import { computed } from "vue";
import { sensors } from "@config";

const props = defineProps({
  sensorID: String,
});

const icon = computed(() => {
  if (!props.sensorID || !sensors[props.sensorID]) return "";
  return sensors[props.sensorID].icon;
});
</script>

<style scoped>
img {
    display: inline-block;
    max-height: calc(var(--font-size) * 2);
}
</style>
