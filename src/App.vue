<template>
  <RouterView />
  <notifications :classes="['notify', 'vue-notification']" />
</template>

<script setup>
import { RouterView } from "vue-router";
import { onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import { useAccountStore } from "@/stores/account";
import { useMapStore } from "@/stores/map";

import { decryptText } from "./utils/idb";
import config from "@/config/default/config.json";
import { getSensorsForLastDay } from "./utils/utils";

const route = useRoute();
const accountStore = useAccountStore();
const mapStore = useMapStore();

/*
  Класс для /main
*/
function updateAppClass() {
  const app = document.getElementById("app");
  if (!app) return;
  if (route.name === "main") app.classList.add("map");
  else app.classList.remove("map");
}
watch(() => route.name, updateAppClass, { immediate: true });

/*
  При маунте: загружаем аккаунты из IndexedDB через стор,
  затем для каждого обновляем devices из сети (getUserSensors) и
  сохраняем обратно через addAccount.
*/
onMounted(async () => {

  /* + INIT SENSORS */
  const sensors = await getSensorsForLastDay();
  if (Array.isArray(sensors)) {
    mapStore.setSensors(sensors);
  }
  /* - INIT SENSORS */
  
  /* + INIT ACCOUNT */
  const accounts = await accountStore.getAccounts();

  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      const sensors = await accountStore.getUserSensors(acc.address);
      await accountStore.addAccount({
        phrase: acc.phrase || "",
        address: acc.address,
        type: acc.type,
        devices: sensors,
        ts: acc.ts,
      });
    }
  }
  /* - INIT ACCOUNT */
});
</script>

<style>
.notify {
  font-size: 20px !important;
  font-weight: bold;
}
</style>
