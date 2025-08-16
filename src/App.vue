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

import { decryptText } from "@/idb";
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
  
  /* + INIT ACCOUNT */
  const accounts = await accountStore.getAccounts();

  if (accounts && accounts.length > 0) {
    let selected = accounts.find(acc => acc.active);
    if (!selected) selected = accounts[0];

    let phrase = "";
    try {
      phrase = await decryptText(selected.data);
    } catch (e) {
      phrase = "";
    }

    accountStore.setAccount(
      phrase,
      selected.address,
      selected.type,
      selected.devices
    );
  }
  /* - INIT ACCOUNT */

  /* + INIT SENSORS */
  const sensors = await getSensorsForLastDay();
  if (Array.isArray(sensors)) {
    mapStore.setSensors(sensors);
  }
  /* - INIT SENSORS */
});
</script>

<style>
.notify {
  font-size: 20px !important;
  font-weight: bold;
}
</style>
