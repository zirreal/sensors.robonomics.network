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

/* + SENSORS HELPERS */
/* Для получения сенсоров только в пределах максимальной видимости карты (по настройкам) */
function getConfigBBox() {
  const p = config?.MAP?.position;
  const d = config?.MAP?.boundsDelta;
  if (!p || !d || d.lat === "" || d.lng === "") return null;

  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const dLat = Number(d.lat);
  const dLng = Number(d.lng);
  if (![lat, lng, dLat, dLng].every(Number.isFinite)) return null;

  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng };
}

function inBBox(lat, lng, b) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const okLat = lat >= Math.min(b.south, b.north) && lat <= Math.max(b.south, b.north);
  const okLng = b.west <= b.east ? (lng >= b.west && lng <= b.east) : (lng >= b.west || lng <= b.east);
  return okLat && okLng;
}
/* - SENSORS HELPERS */

/*
  При маунте: загружаем аккаунты из IndexedDB через стор,
  затем для каждого обновляем devices из сети (getUserSensors) и
  сохраняем обратно через addAccount.
*/
onMounted(async () => {

  /* + INIT SENSORS */
  const all = await getSensorsForLastDay();
  const box = getConfigBBox();

  const sensors = (Array.isArray(all) ? all : []).filter(s => {
    if (!box) return true;
    const lat = Number(s.geo?.lat);
    const lng = Number(s.geo?.lng);
    return inBBox(lat, lng, box);
  });

  mapStore.setSensors(sensors);
  /* - INIT SENSORS */
  
  /* + INIT ACCOUNT */
  if(config.SERVICES.accounts) {
    const accountStore = useAccountStore();
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
