<template>
  <MetaInfo pageTitle="Login" :pageImage="ogImage" />

  <PageTextLayout>
    <h3>Login for Altruist holder</h3>
    {{accountStore.accounts}}
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
        <input type="checkbox" v-model="keepSigned" />
        <span>Keep me signed (I trust this device)</span>
      </label>

      <button
        class="button"
        :class="loginStatus === 'success' ? 'button-green' : null"
        :disabled="loginStatus === 'success'"
      >
        {{ loginStatus === 'success' ? 'Signed in' : 'Sign in' }}
      </button>

      <div v-if="loginStatus === 'success' && lastAddress" class="preview">
        <div style="text-align: center">
          You signed in as: <b>{{ formatAddress(lastAddress) }}</b>
        </div>
      </div>

      <div v-if="loginStatus === 'error'">{{ error }}</div>
    </form>
  </PageTextLayout>
</template>

<script setup>
import { ref, computed } from "vue";
import { useAccountStore } from "@/stores/account";
import { mnemonicValidate, encodeAddress } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";

import MetaInfo from "../components/MetaInfo.vue";
import PageTextLayout from "../components/layouts/PageText.vue";
import ogImage from "../assets/images/pages/login/og-login.webp";

const accountStore = useAccountStore();

const passPhrase = ref("");
const keepSigned = ref(false);
const error = ref("");
const keyType = ref("sr25519");
const loginStatus = ref("idle");

// локальные значения для экрана после логина
const lastAddress = ref("");

const canKeepSigned = computed(
  () => !!(window.crypto?.subtle || window.crypto?.webkitSubtle) && !!window.indexedDB
);

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
  const keyring = new Keyring({ type });
  const pair = keyring.addFromMnemonic(phrase);
  const address = encodeAddress(pair.publicKey, 32);
  return { address, type, publicKey: pair.publicKey };
}

function resetStatus() {
  loginStatus.value = "idle";
  error.value = "";
}

async function handleLogin(e) {
  e.preventDefault();
  error.value = "";
  loginStatus.value = "idle";

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

  if (keepSigned.value) {
    await accountStore.addAccount(
      { phrase, address, type, devices: [], ts: Date.now() },
      { persist: true }
    );
  } else {
    await accountStore.removeAccounts(address);
    await accountStore.addAccount(
      { phrase, address, type, devices: [], ts: Date.now() },
      { persist: false }
    );
  }

  lastAddress.value = address;
  passPhrase.value = "";
  loginStatus.value = "success";
}
</script>

<style scoped>
h3 { text-align: center; }

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

.preview { --font-size: 1rem; }

.label-line {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
</style>
