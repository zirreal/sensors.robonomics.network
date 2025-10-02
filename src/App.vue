<template>
  <RouterView />
  <notifications :classes="['notify', 'vue-notification']" />
</template>

<script setup>
import { RouterView } from "vue-router";
import { onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import { useAccountStore } from "@/stores/account";

import config from "@/config/default/config.json";
// import { getSensorsMapList } from "./utils/map/markers/requests"; // Убран - теперь используется только в Main.vue

const route = useRoute();

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

/**
 * Очищает устаревшие данные из localStorage
 * Удаляет ключи, начинающиеся с 'aqi_cache_' и 'revgeo_addr_'
 */
function cleanupOldLocalStorage() {
  try {
    const keysToRemove = [];
    
    // Проходим по всем ключам в localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('aqi_cache') || key.startsWith('revgeo_addr_'))) {
        keysToRemove.push(key);
      }
    }
    
    // Удаляем найденные ключи
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} old localStorage entries:`, keysToRemove);
    }
  } catch (error) {
    console.warn('Failed to cleanup localStorage:', error);
  }
}

onMounted(async () => {

  // Очищаем устаревшие данные из localStorage
  cleanupOldLocalStorage();
  
  /* + INIT ACCOUNT */
  /*
  При маунте: загружаем аккаунты из IndexedDB через стор,
  затем для каждого обновляем devices из сети (getUserSensors) и
  сохраняем обратно через addAccount.
*/
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

// Watcher для изменения даты убран - теперь данные загружаются только через Main.vue handlerHistory
// Это предотвращает дублирующиеся запросы к API

</script>

<style>
.notify {
  font-size: 20px !important;
  font-weight: bold;
}
</style>
