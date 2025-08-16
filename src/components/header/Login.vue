<template>
  <router-link
    v-if="accounts.length === 0"
    to="/login/"
    class="button"
  >
    Login
  </router-link>
  <template v-else>
    <div id="accounts" class="popover popover-top-right" popover>
      <div
        v-for="acc in accounts"
        :key="acc.address"
        class="account-row"
      >
        <span>{{ acc.address }}</span>
        <button @click="deleteAccount(acc)">delete</button>

        <!-- сенсоры -->
        <div style="font-size: 0.95em; margin-left: 20px;">
          <template v-if="acc.sensorsLoading">
            <span style="opacity: 0.7;">Loading sensors...</span>
          </template>

          <template v-else-if="acc.sensors.length">
            Sensors:
            <ul>
              <li
                v-for="sensor in acc.sensors"
                :key="sensor"
              >
                <router-link
                  :to="getSensorLink(sensor)"
                  @click="reloadOnClick"
                >
                  {{ sensor }}
                </router-link>
              </li>
            </ul>
          </template>

          <template v-else>
            <span style="opacity: 0.6;">No available sensors</span>
          </template>
        </div>
      </div>
    </div>
    <button class="popovercontrol" popovertarget="accounts">
      <font-awesome-icon icon="fa-solid fa-user" />
    </button>
  </template>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useAccountStore } from "@/stores/account";
import config from "@/config/default/config.json";
import { getTypeProvider } from "@/utils/utils";

const accountStore = useAccountStore();
const accounts = ref([]);

// Загружаем все аккаунты из БД/стора и подгружаем сенсоры
async function loadAccounts() {
  const stored = await accountStore.getAccounts();

  accounts.value = stored.map(acc => ({
    ...acc,
    sensors: [],
    sensorsLoading: true,
  }));

  for (let i = 0; i < accounts.value.length; i++) {
    const acc = accounts.value[i];
    acc.sensors = await accountStore.getUserSensors(acc.address);
    acc.sensorsLoading = false;
  }
}

// Удалить аккаунт по ключу, перезагрузить список
async function deleteAccount(acc) {
  await accountStore.removeAccounts(acc.address);
  await loadAccounts();
}

// Сформировать ссылку на сенсор
function getSensorLink(sensor) {
  return {
    name: "main",
    query: {
      provider: getTypeProvider(),
      type: config.MAP.measure,
      zoom: config.MAP.zoom,
      lat: config.MAP.position.lat,
      lng: config.MAP.position.lng,
      sensor: sensor,
    },
  };
}

function reloadOnClick() {
  setTimeout(() => {
    window.location.reload();
  }, 50);
}

onMounted(loadAccounts);
</script>

<style scoped>
.account-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  flex-direction: column;
  margin-bottom: 10px;
}
ul {
  margin: 2px 0 0 0;
  padding: 0 0 0 12px;
}
</style>
