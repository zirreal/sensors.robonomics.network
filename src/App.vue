<template>
  <RouterView />
  <notifications :classes="['notify', 'vue-notification']" />
</template>

<script setup>
import { RouterView } from "vue-router";
import { onMounted } from "vue";

import { useAccountStore } from "@/stores/account";
import { useMapStore } from "@/stores/map";

import { decryptText } from "@/idb";
import config from "@/config/default/config.json";
import { getSensorsForLastDay } from "./utils/utils";

const accountStore = useAccountStore();
const mapStore = useMapStore();

onMounted(async () => {

  /* + INIT ACCOUNT */
  const accounts = await accountStore.getDB();

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
