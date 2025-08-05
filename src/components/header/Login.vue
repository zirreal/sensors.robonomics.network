<template>
    <router-link v-if="!accountStore.address" to="/login/" class="button">Login</router-link>
    <template v-else>
        <div id="accounts" class="popover popover-top-right" popover>
            <div v-for="acc in accounts" :key="acc.address" class="account-row" :class="{active: acc.active}">
                <span>
                    {{ acc.address }}
                    <span v-if="acc.active" style="color: green; margin-left: 4px;">(active)</span>
                </span>
                <button @click="switchAccount(acc)" :disabled="acc.active">switch</button>
                <button @click="deleteAccount(acc)">delete</button>

                <!-- сенсоры -->
                <div v-if="getAccountSensors(acc).length" style="font-size: 0.95em; margin-left: 20px;">
                    Sensors:
                    <ul>
                        <li v-for="sensor in getAccountSensors(acc)" :key="sensor">
                            <router-link :to="getSensorLink(sensor)" @click="reloadOnClick">
                                {{ sensor }}
                            </router-link>
                        </li>
                    </ul>
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
import { useMapStore } from "@/stores/map";
import { IDBgettable } from "@/idb";
import config from "@/config/default/config.json";
import { getTypeProvider } from "@/utils/utils";
import { decryptText } from "@/idb";

const accountStore = useAccountStore();
const mapStore = useMapStore();
const accounts = ref([]);

async function loadAccounts() {
    accounts.value = await IDBgettable(
        config.INDEXEDDB.accounts.dbname,
        config.INDEXEDDB.accounts.dbversion,
        config.INDEXEDDB.accounts.tablename
    );
}

async function switchAccount(acc) {
    await accountStore.markActiveInDB(acc.address);
    accounts.value.forEach(a => a.active = false);
    acc.active = true;
    accountStore.setAccount(
        await getDecryptedPhrase(acc),
        acc.address,
        acc.type,
        acc.devices
    );
}

async function deleteAccount(acc) {
    await accountStore.deleteFromDB(acc.address);
    accounts.value = await IDBgettable(
        config.INDEXEDDB.accounts.dbname,
        config.INDEXEDDB.accounts.dbversion,
        config.INDEXEDDB.accounts.tablename
    );
    if (accounts.value.length === 0) {
        accountStore.clearAccount();
    } else {
        let active = accounts.value.find(a => a.active) || accounts.value[0];
        accountStore.setAccount(
            await getDecryptedPhrase(active),
            active.address,
            active.type,
            active.devices
        );
    }
}

async function getDecryptedPhrase(acc) {
    try {
        return await decryptText(acc.data);
    } catch {
        return "";
    }
}

// Возвращает devices аккаунта, которые есть в sensors из mapStore
function getAccountSensors(acc) {
    if (!acc.devices || !Array.isArray(acc.devices)) return [];

    console.log('mapStore.sensors', mapStore.sensors)
    // mapStore.sensors — массив доступных сенсоров
    return acc.devices.filter(dev => mapStore.sensors.some(s => s.sensor_id === dev));
}

// Формирует ссылку на сенсор
function getSensorLink(sensor) {
  return {
    name: "main",
    query: {
      provider: getTypeProvider(),
      type: config.MAP.measure,
      zoom: config.MAP.zoom,
      lat: config.MAP.position.lat, // если нужна попытка получить координаты — доработай тут
      lng: config.MAP.position.lng,
      sensor: sensor,
    },
  };
}

function reloadOnClick(e) {
    // К сожалению, без редиректа данные сенсора не подгружаются
    // Ждем завершения перехода, иначе может не сработать router.push
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
    padding: 2px 0;
    flex-direction: column;
    margin-bottom: 10px;
}
.account-row.active {
    font-weight: bold;
}
ul {
    margin: 2px 0 0 0;
    padding: 0 0 0 12px;
}
</style>
