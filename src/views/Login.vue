<template>
  <MetaInfo
    pageTitle="Login"
    :pageImage="ogImage"
  />

  <PageTextLayout>
    <h3>Login for Altruist holder</h3>
    <form @submit="handleLogin">
      <input
        type="password"
        placeholder="Pass phrase (12 words)"
        v-model="passPhrase"
        autocomplete="off"
        @input="resetStatus"
      />

      <div v-if="account" class="preview">
        <div>You are signing in as:</div>
        <div><b>{{ formatAddress(account) }}</b></div>
        <label class="label-line">
          <span>Type (advanced):</span>
          <select v-model="keyType" class="select-link">
            <option value="sr25519">sr25519</option>
            <option value="ed25519">ed25519</option>
          </select>
        </label>
      </div>

      <label v-if="account && canKeepSigned" class="label-line">
        <input type="checkbox" v-model="keepSigned">
        <span>Keep me signed (I trust this device)</span>
      </label>

      <button 
        class="button"
        :class="loginStatus === 'success' ? 'button-green' : null"
        :disabled="loginStatus === 'success' ? true : false"
      >
        {{loginStatus === 'success' ? 'Signed in' : 'Sign in'}}
      </button>

      <div v-if="!account && loginStatus === 'success'" class="preview">

        <div style="text-align: center">You signed in as: <b>{{ formatAddress(accountStore.address) }}</b></div>

        <div style="text-align: center" v-if="accountStore.devices.length > 0 && sensorLink">
          Redirecting to your <router-link :to="sensorLink">sensor</router-link> in {{redirectCountdown}} seconds ...
        </div>

      </div>

      <div v-if="loginStatus === 'error'">{{ error }}</div>
    </form>
  </PageTextLayout>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAccountStore } from "@/stores/account";
import config from "@config";

import { mnemonicValidate, encodeAddress } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";

import MetaInfo from '../components/MetaInfo.vue';
import PageTextLayout from "../components/layouts/PageText.vue";
import { encryptText } from "../idb";
import { getTypeProvider } from "../utils/utils";

const accountStore = useAccountStore();
const ogImage = new URL('@/assets/images/pages/login/og-login.webp', import.meta.url).href;
const MAGIC = "altruist-v1";
const router = useRouter();
let redirectTimer = null;

const passPhrase = ref("");
const keepSigned = ref(false);
const error = ref("");
const keyType = ref("sr25519"); // По умолчанию sr25519
const loginStatus = ref("idle"); // idle | success | error
const sensorLink = ref(null);
const redirectCountdown = ref(15);

const canKeepSigned = computed(() =>
  !!(window.crypto?.subtle || window.crypto?.webkitSubtle) && !!window.indexedDB
);

// START DEVICES
import axios from "axios";
import { usePolkadotApi } from "robonomics-interface-vue";
import { useDevices } from "robonomics-interface-vue/devices";

const { isConnected, instance } = usePolkadotApi();
const owner = ref("4FiueWs4Q223iyvcYmEUQAJexNXZRQnvkML1sqWxZ8QXuCW1");
const devices = useDevices(owner, { immediate: false });

// подключаемся к чейну
instance.connect().catch((e) => {
  console.log(e);
});

// ожидаем подключения к чейну, чтобы сделать запрос на получение девайсов
watch(
  isConnected,
  (isConnected) => {
    if (isConnected) {
      devices.load();
    }
  },
  { immediate: true }
);

// выводим список девайсов
watch(devices.data, (data) => {
  console.log("DEVICES", data);
});

// получаем список сенсоров по адресу владельца c roseman
(async () => {
  try {
    const result = await axios.get(`https://roseman.airalab.org/api/sensor/sensors/${owner.value}`);
    console.log("SENSORS", result.data);
  } catch (error) {
    console.log(error);
  }
})();
// END DEVICES

const account = computed(() => {
  const phrase = passPhrase.value.trim();
  if (phrase.split(/\s+/).length !== 12) return "";
  if (!mnemonicValidate(phrase)) return "";
  try {
    const keyring = new Keyring({ type: keyType.value });
    const pair = keyring.addFromMnemonic(phrase);
    return encodeAddress(pair.publicKey, 32);
  } catch {
    return "";
  }
});

function formatAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 16) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-6);
}

function getRobonomicsAddressByType(phrase, type) {
  let pair;
  try {
    const keyring = new Keyring({ type });
    pair = keyring.addFromMnemonic(phrase);
  } catch {
    throw new Error(`Cannot create ${type} account from this mnemonic`);
  }
  const address = encodeAddress(pair.publicKey, 32);
  return { address, type, publicKey: pair.publicKey };
}

function resetStatus() {
  loginStatus.value = "idle";
  error.value = "";
  clearTimeout(redirectTimer);
  redirectCountdown.value = 15;
  sensorLink.value = null;
}

function redirect() {
  sensorLink.value = {
    name: "main",
    params: {
      provider: getTypeProvider(),
      type: config.MAP.measure,
      zoom: config.MAP.zoom,
      lat: config.MAP.position.lat, // тут надо сделать попытку получить гео от сенсора >> sensorLat || config.MAP.position.lat
      lng: config.MAP.position.lng, // тут тоже
      sensor: accountStore.devices[0],
    },
  };
  redirectCountdown.value = 15;
  clearTimeout(redirectTimer);

  function tick() {
    if (redirectCountdown.value > 0) {
      redirectCountdown.value -= 1;
      redirectTimer = setTimeout(tick, 1000);
    } else {
      router.push(sensorLink.value);
    }
  }
  tick();
}

async function handleLogin(e) {
  e.preventDefault();
  error.value = "";
  loginStatus.value = "idle";
  sensorLink.value = null;
  clearTimeout(redirectTimer);
  redirectCountdown.value = 15;
  const phrase = passPhrase.value.trim();

  if (phrase.split(/\s+/).length !== 12) {
    error.value = "Passphrase must be 12 words";
    loginStatus.value = "error";
    return;
  }

  if (!mnemonicValidate(phrase)) {
    error.value = "Invalid mnemonic";
    loginStatus.value = "error";
    return;
  }

  let accountData;
  try {
    accountData = getRobonomicsAddressByType(phrase, keyType.value);
  } catch (e) {
    error.value = e.message || "Cannot create Robonomics account";
    loginStatus.value = "error";
    return;
  }
  const { address, type } = accountData;
  const devices = [
    '4Cgi21YcaUTr9z3KCB7de9iPAr3jiGEhhBaCsWugqgMhPGXR',
    '4Gsha9WxNjv3y8pyLQ5dAzsyNnvfS8CTPZF1Awu1XB1zrEjs'
  ]; // записываем девайсы из подписки

  if (keepSigned.value) {
    try {
      const encrypted = await encryptText(phrase);
      accountStore.saveToDB({
        address,
        data: encrypted,
        type,
        devices
      });
    } catch (e) {
      error.value = "Encryption error";
      loginStatus.value = "error";
      return;
    }
  } else {
    // убеждаемся, что аккаунт не сохранен в бд, так как пользователь больше этого не хочет
    accountStore.deleteFromDB(address);
  }

  accountStore.setAccount(phrase, address, type, devices);

  passPhrase.value = "";
  loginStatus.value = "success";

  if (devices.length > 0) {
    redirect();
  }
}
</script>

<style scoped>
h3 {
  text-align: center;
}

form {
  display: grid;
  gap: var(--gap);
  --app-inputpadding: 1.3rem;
  width: min(500px, 100%);
  margin: 0 auto;
}

input, button, select {
  display: block;
  width: 100%;
  height: auto;
}

.preview {
  --font-size: 1rem;
}

.label-line {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
</style>
