<template>
  <MetaInfo pageTitle="Login" pageImage="/og-login.webp" />

  <PageTextLayout>
    <section class="login-page" v-if="false">
      <header class="hero">
        <h3>{{ $t("Accounts") }}</h3>
        <p class="subtitle">
          {{
            $t(
              "Add an account using your 12-word seed phrase. “Keep me signed” stores it on this device."
            )
          }}
        </p>
      </header>

      <section v-if="isLoggedIn && !showAddAnother" class="card">
        <div class="card-header">
          <div>
            <div class="card-title">{{ $t("Signed in") }}</div>
            <div class="muted">
              {{ accountsCount }} {{ $t("account") }}<span v-if="accountsCount !== 1">s</span>
              {{ $t("on this device") }}
            </div>
          </div>
          <div class="card-actions">
            <button class="button" type="button" @click.prevent="showAddAnother = true">
              {{ $t("Add account") }}
            </button>
            <button class="button button-red" type="button" @click.prevent="handleLogoutAll">
              {{ $t("Log out all") }}
            </button>
          </div>
        </div>

        <div class="accounts-grid">
          <div v-for="acc in accounts" :key="acc.address" class="account-pill">
            <div class="account-pill-top">
              <div class="account-pill-left">
                <img
                  v-if="avatarsByAddr[acc.address]"
                  class="account-avatar"
                  :src="avatarsByAddr[acc.address]"
                  alt=""
                  aria-hidden="true"
                />
                <span class="account-pill-text">{{ formatAddress(acc.address) }}</span>
              </div>
              <div class="pill-actions">
                <Copy :msg="acc.address" :title="'Copy address'" :notify="'Copied'" />
                <button
                  class="pill-delete"
                  type="button"
                  aria-label="Remove account"
                  @click="removeOne(acc)"
                >
                  <font-awesome-icon icon="fa-solid fa-trash" />
                </button>
              </div>
            </div>

            <details class="pill-sensors" @toggle="onSensorsToggle(acc, $event)">
              <summary class="pill-sensors-summary">
                <span>Sensors</span>
                <span class="muted" v-if="sensorsLoadingByAddr[acc.address]">{{
                  $t("Loading…")
                }}</span>
                <span class="muted" v-else-if="(sensorsByAddr[acc.address] || []).length">
                  {{ (sensorsByAddr[acc.address] || []).length }}
                </span>
              </summary>
              <div class="pill-sensors-body">
                <div v-if="sensorsLoadingByAddr[acc.address]" class="muted">
                  {{ $t("Loading sensors…") }}
                </div>
                <div v-else-if="(sensorsByAddr[acc.address] || []).length === 0" class="muted">
                  {{ $t("No sensors found for this account yet.") }}
                </div>
                <div v-else class="sensor-chips">
                  <router-link
                    v-for="sensor in sensorsByAddr[acc.address]"
                    :key="sensor"
                    class="sensor-chip"
                    :to="getSensorLink(sensor)"
                  >
                    {{ sensor }}
                  </router-link>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>

      <section v-else class="card">
        <div class="card-header">
          <div>
            <div class="card-title">{{ $t("Add account") }}</div>
            <div class="muted">{{ $t("Seed phrase never leaves your browser") }}</div>
          </div>
          <button
            v-if="isLoggedIn"
            class="button button-round-outline"
            type="button"
            @click.prevent="showAddAnother = false"
            title="Back"
            aria-label="Back"
          >
            <font-awesome-icon icon="fa-solid fa-caret-left" />
          </button>
        </div>

        <form class="form" @submit="handleLogin">
          <label class="field">
            <span class="field-label">{{ $t("Seed phrase") }}</span>
            <input
              type="password"
              placeholder="Pass phrase (12 words)"
              v-model="passPhrase"
              autocomplete="off"
              @input="resetStatus"
            />
          </label>

          <div v-if="account" class="preview">
            <div class="muted">{{ $t("You are signing in as") }}</div>
            <div class="addr">{{ formatAddress(account) }}</div>
            <label class="label-line">
              <span>{{ $t("Type (advanced):") }}</span>
              <select v-model="keyType" class="select-link">
                <option value="sr25519">sr25519</option>
                <option value="ed25519">ed25519</option>
              </select>
            </label>
          </div>

          <label v-if="account && canKeepSigned" class="keep">
            <input type="checkbox" v-model="keepSigned" />
            <span>
              {{ $t("Keep me signed in (I trust this device)") }}
            </span>
          </label>

          <button
            class="button"
            :class="loginStatus === 'success' ? 'button-green' : null"
            :disabled="loginStatus === 'success'"
          >
            {{ loginStatus === "success" ? "Signed in" : "Sign in" }}
          </button>

          <div v-if="loginStatus === 'success' && lastAddress" class="success">
            {{ $t("Signed in as") }} <b>{{ formatAddress(lastAddress) }}</b>
          </div>

          <div v-if="loginStatus === 'error'" class="error">
            <font-awesome-icon icon="fa-solid fa-circle-exclamation" />
            <span>{{ error }}</span>
          </div>
        </form>
      </section>
    </section>
  </PageTextLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useAccounts } from "@/composables/useAccounts"; // TODO: раскомментировать когда будет нужно
import { mnemonicValidate, encodeAddress } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";
import config from "@/config/default/config.json";
import { generateAvatar } from "@/utils/avatarGenerator";

import MetaInfo from "../components/MetaInfo.vue";
import PageTextLayout from "../components/layouts/PageText.vue";
import Copy from "@/components/controls/Copy.vue";

const accountStore = useAccounts(); // kept for future re-enable
const router = useRouter();

async function onSensorsToggle(acc, event) {
  const open = event?.target?.open === true;
  if (!open) return;
  const addr = acc?.address;
  if (!addr) return;
  if (sensorsLoadingByAddr.value[addr]) return;
  if (Array.isArray(sensorsByAddr.value[addr]) && sensorsByAddr.value[addr].length > 0) return;

  try {
    sensorsLoadingByAddr.value = { ...sensorsLoadingByAddr.value, [addr]: true };
    const sensors = await accountStore.getUserSensors(addr);
    sensorsByAddr.value = { ...sensorsByAddr.value, [addr]: sensors };
  } finally {
    sensorsLoadingByAddr.value = { ...sensorsLoadingByAddr.value, [addr]: false };
  }
}
</script>

<style>
.pill-actions .copy .fa-copy {
  font-size: calc(var(--font-size) * 1.2);
}
</style>

<style scoped>
h3 {
  margin-bottom: calc(var(--gap) * 0.4);
}

.login-page {
  display: grid;
  gap: calc(var(--gap) * 0.8);
  width: min(720px, 100%);
  margin: 0 auto;
}

.hero {
  text-align: center;
  display: grid;
  gap: 0.2rem;
}

.subtitle {
  margin: 0 auto;
  max-width: 60ch;
  opacity: 0.8;
  font-size: calc(var(--font-size) * 0.9);
}

.card {
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--color-light);
  padding: calc(var(--gap) * 0.9);
  display: grid;
  gap: calc(var(--gap) * 0.75);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(var(--gap) * 0.75);
}

.card-title {
  font-weight: 900;
  font-size: calc(var(--font-size) * 1.18);
}

.card-actions {
  display: flex;
  gap: calc(var(--gap) * 0.6);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.card-actions :deep(.button) {
  --app-inputpadding: 0.9rem;
  font-size: calc(var(--font-size) * 0.8);
}

.muted {
  opacity: 0.7;
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: calc(var(--gap) * 0.7);
}

.account-pill {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: calc(var(--gap) * 0.3);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: var(--pad-sm) var(--pad-md);
  background: var(--surface-bg-soft);
}

.account-pill-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--gap) * 0.8);
  min-width: 0;
}

.account-pill-left {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--gap) * 0.6);
  min-width: 0;
}

.account-avatar {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  flex: 0 0 auto;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.03);
}

.account-pill-text {
  font-weight: 800;
  font-size: calc(var(--font-size) * 1.1);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-actions {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--gap) * 0.2);
  flex: 0 0 auto;
}

.pill-delete {
  border: 0;
  cursor: pointer;
  opacity: 0.75;
  font-size: calc(var(--font-size) * 1);
}

.pill-delete:hover {
  opacity: 1;
  color: var(--color-red);
}

.pill-sensors {
  border-top: 1px solid var(--surface-border-soft);
  padding-top: calc(var(--gap) * 0.3);
}

.pill-sensors summary::-webkit-details-marker,
.pill-sensors summary::marker {
  content: "";
  display: none;
}

.pill-sensors-summary {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--gap) * 0.3);
  font-weight: 900;
  font-size: calc(var(--font-size) * 0.8);
}

.pill-sensors-body {
  margin-top: calc(var(--gap) * 0.3);
}

.sensor-chips {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--gap) * 0.3);
}

.sensor-chip {
  display: inline-flex;
  align-items: center;
  padding: calc(var(--gap) * 0.3) calc(var(--gap) * 0.5);
  text-decoration: none;
  color: var(--color-blue);
  font-weight: 700;
  font-size: calc(var(--font-size) * 0.9);
  hyphens: auto;
  transition: color 0.33s ease-in-out;
}

.sensor-chip:hover {
  color: var(--color-navy);
}

.form {
  display: grid;
  gap: var(--gap);
  --app-inputpadding: 1.2rem;
}

.field {
  display: grid;
  gap: 0.5rem;
}

.field-label {
  font-weight: 800;
}

input,
button,
select {
  width: 100%;
  height: auto;
}

.preview {
  --font-size: calc(var(--font-size) * 1.12);
  border: 1px dashed rgba(0, 0, 0, 0.18);
  border-radius: var(--radius-md);
  padding: var(--pad-sm) var(--pad-md);
  background: rgba(0, 0, 0, 0.015);
  display: grid;
  gap: 8px;
}

.addr {
  font-weight: 900;
  letter-spacing: 0.2px;
}

.label-line {
  display: flex;
  align-items: center;
  gap: 0.5em;
  flex-wrap: wrap;
}

.keep {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.success {
  text-align: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(40, 170, 85, 0.12);
  color: #1f7b44;
}

.error {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(220, 70, 70, 0.1);
  color: #a92b2b;
}
</style>
