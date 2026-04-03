<template>
  <section class="story-editor" v-if="false">
    <header class="story-hero">
      <h3>{{ $t("Stories") }}</h3>
      <p class="owner-hint" v-if="!isOwnerLoggedIn">
        {{ $t("Only sensor owner can add stories for this sensor.") }}
      </p>
      <p class="owner-hint" v-else>
        {{ $t("Share you thoughts with the users!") }}
      </p>
    </header>

    <div v-if="statusMessage" :class="['status', statusType]">
      {{ statusMessage }}
    </div>

    <p v-if="isCheckingAuth" class="owner-hint">{{ $t("Checking login state...") }}</p>

    <template v-else-if="!hasAnyLoggedAccounts">
      <div>
        <div class="card-title">{{ $t("Not available") }}</div>
        <p class="owner-hint">{{ $t("Please login first.") }}</p>
        <div class="actions">
          <router-link to="/login/" class="button">{{ $t("Login") }}</router-link>
        </div>
      </div>
    </template>

    <button
      v-else-if="step === 'idle' && isOwnerLoggedIn"
      class="button"
      :disabled="!ownerAddress"
      @click.prevent="startForm"
    >
      {{ $t("Add story") }}
    </button>

    <form v-if="step === 'form'" class="card stack story-form" @submit.prevent="saveStory">
      <div class="card-title">{{ $t("Add a story") }}</div>

      <label class="field">
        <div class="field-head">
          <span class="field-title">{{ $t("Story date") }}</span>
          <span class="field-meta">{{ $t("from chart") }}</span>
        </div>
        <input v-model="storyDate" type="date" />
      </label>

      <label class="field">
        <div class="field-head">
          <span class="field-title">{{ $t("Short comment") }}</span>
          <span class="field-meta">{{ storyComment.length }}/200</span>
        </div>
        <textarea
          v-model.trim="storyComment"
          rows="3"
          maxlength="200"
          placeholder="E.g. “Dust storm — PM10 was off the charts.”"
        ></textarea>
      </label>

      <div>
        <div class="field-title">{{ $t("Pick an icon") }}</div>
        <div class="image-grid">
          <label
            v-for="item in STORY_ICONS"
            :key="item.id"
            class="image-option"
            :class="{ selected: selectedIconId === item.id }"
          >
            <input v-model="selectedIconId" type="radio" name="story-icon" :value="item.id" />
            <font-awesome-icon
              :icon="item.icon"
              class="story-icon"
              :style="{ color: iconColor(item.id) }"
            />
            <span>{{ item.title }}</span>
          </label>
        </div>
      </div>

      <div class="actions">
        <button class="button" type="submit" :disabled="!canSubmitStory || isSubmitting">
          <template v-if="isSubmitting">{{ $t("Publishing…") }}</template>
          <template v-else>{{ $t("Publish") }}</template>
        </button>
        <button
          class="button button-round-outline"
          type="button"
          @click.prevent="resetFlow"
          aria-label="Cancel"
        >
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </button>
      </div>
    </form>

    <div v-if="visibleStories.length" class="stories-list">
      <h4>{{ $t("Stories for this sensor") }}</h4>
      <article v-for="story in visibleStories" :key="story.id" class="story-card">
        <div
          v-if="story.icon"
          class="story-icon-badge"
          :style="{ '--badge-color': iconColor(story.iconId) }"
          aria-hidden="true"
        >
          <font-awesome-icon
            :icon="story.icon"
            class="story-icon story-icon-large"
            :style="{ color: iconColor(story.iconId) }"
          />
        </div>
        <img v-else :src="story.imageSrc" :alt="story.imageTitle" />
        <div>
          <p>{{ story.message || story.comment }}</p>
          <small>
            {{ $t("Posted") }} {{ formatDate(story.createdAt) }}
            <span v-if="story.date"> · {{ story.date }}</span>
            <button
              v-if="story.date"
              class="story-jump"
              type="button"
              @click="openStoryDate(story)"
            >
              {{ $t("Open") }}
            </button>
          </small>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { encodeAddress, decodeAddress } from "@polkadot/util-crypto";
import { settings } from "@config";
import { useAccounts } from "@/composables/useAccounts";
import { useMap } from "@/composables/useMap";
import { usePolkadotApi } from "robonomics-interface-vue";
import Keyring from "@polkadot/keyring";
import { datalog } from "robonomics-interface";
import { getStoriesForSensor, shouldShowTestStories, upsertStory } from "@/utils/storiesLocal";

const IS_TEST_STORY = true;

const STORY_ICONS = [
  { id: "heat", title: "Heat wave", icon: "fa-solid fa-temperature-high" },
  { id: "cold", title: "Cold snap", icon: "fa-solid fa-temperature-low" },
  { id: "smog", title: "High PM / Smog", icon: "fa-solid fa-smog" },
  { id: "wind", title: "Wind / Dust", icon: "fa-solid fa-wind" },
  { id: "noise", title: "Noise / Loud", icon: "fa-solid fa-volume-high" },
  { id: "storm", title: "Storm", icon: "fa-solid fa-bolt-lightning" },
  { id: "rain", title: "Heavy rain", icon: "fa-solid fa-cloud-rain" },
  { id: "sun", title: "Clear day", icon: "fa-solid fa-cloud-sun" },
  { id: "fire", title: "Fire / Smoke", icon: "fa-solid fa-fire" },
  { id: "co2", title: "CO₂ / Emissions", icon: "fa-solid fa-cloud-arrow-up" },
  { id: "note", title: "Note", icon: "fa-regular fa-comment" },
];

// Compact icon codes for on-chain payload size (1–2 chars).
const ICON_CODE_BY_ID = {
  heat: "h",
  cold: "c",
  smog: "s",
  wind: "w",
  noise: "n",
  storm: "t",
  rain: "r",
  sun: "u",
  fire: "f",
  co2: "2",
  note: "o",
};

const ICON_ID_BY_CODE = Object.fromEntries(
  Object.entries(ICON_CODE_BY_ID).map(([id, code]) => [code, id])
);

const ICON_COLORS = {
  heat: "#ff6b6b",
  cold: "#7ad9e8",
  smog: "#9aa7b1",
  wind: "#76a7ff",
  noise: "#c58bff",
  storm: "#b39ddb",
  rain: "#7fbfff",
  sun: "#ffd36e",
  fire: "#ffb26b",
  co2: "#b08a7a",
  note: "#7fcf9a",
};

const props = defineProps({
  sensorId: {
    type: String,
    required: true,
  },
  owner: {
    type: String,
    default: "",
  },
  geo: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["open-chart"]);

const step = ref("idle");
const storyComment = ref("");
const selectedIconId = ref(STORY_ICONS[0].id);
const storyDate = ref("");
const statusMessage = ref("");
const statusType = ref("info");
const stories = ref([]);
const isCheckingAuth = ref(false);
const isSubmitting = ref(false);
const lastTxHash = ref("");

const visibleStories = computed(() => {
  const list = Array.isArray(stories.value) ? stories.value : [];
  return shouldShowTestStories() ? list : list.filter((s) => s?.test !== true);
});

const accountStore = useAccounts();
const mapState = useMap();
const router = useRouter();
const { isConnected, instance } = usePolkadotApi();
const keyring = new Keyring({ ss58Format: 32 });
const accountsList = computed(() =>
  Array.isArray(accountStore.accounts?.value) ? accountStore.accounts.value : []
);

const ownerAddress = computed(() => normalizeAddress(props.owner));
const hasAnyLoggedAccounts = computed(() => accountsList.value.length > 0);
const isOwnerLoggedIn = computed(() => {
  const owner = ownerAddress.value;
  if (!owner) return false;
  return accountsList.value.some((acc) => normalizeAddress(acc?.address) === owner);
});
const canSubmitStory = computed(() => storyComment.value.length > 0 && !!selectedIconId.value);

watch(
  () => props.sensorId,
  () => {
    resetFlow();
    loadStories();
    refreshBackendStory();
    refreshAuthState();
  },
  { immediate: true }
);

watch(
  () => props.owner,
  () => {
    refreshAuthState();
  }
);

function normalizeAddress(address) {
  const value = String(address || "").trim();
  if (!value) return "";
  try {
    return encodeAddress(decodeAddress(value), 32);
  } catch {
    return value;
  }
}

function startForm() {
  if (!isOwnerLoggedIn.value) return;
  statusMessage.value = "";
  statusType.value = "info";
  storyDate.value = mapState.currentDate?.value || "";
  step.value = "form";
}

function resetFlow(clearStatus = true) {
  step.value = "idle";
  storyComment.value = "";
  selectedIconId.value = STORY_ICONS[0].id;
  storyDate.value = "";
  if (clearStatus) {
    statusMessage.value = "";
    statusType.value = "info";
  }
}

async function refreshAuthState() {
  isCheckingAuth.value = true;
  try {
    await accountStore.getAccounts();
  } catch {
  } finally {
    isCheckingAuth.value = false;
  }
}

function loadStories() {
  stories.value = getStoriesForSensor(props.sensorId);
}

async function fetchLastStoryFromBackend(sensorId) {
  const base = String(settings?.REMOTE_PROVIDER || "https://roseman.airalab.org/").replace(
    /\/+$/,
    ""
  );
  const url = `${base}/api/v2/story/last/${encodeURIComponent(sensorId)}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data || typeof data !== "object") return null;
  if (data.error) return null;
  return data;
}

async function refreshBackendStory() {
  const sid = props.sensorId;
  if (!sid) return;
  try {
    const raw = await fetchLastStoryFromBackend(sid);
    const record = raw?.result || raw?.story || raw;
    if (!record) return;

    const message = record?.message || record?.comment || "";
    const isTest = record?.t === true || record?.test === true || record?.isTest === true;
    const recordTs =
      record?.timestamp != null && !Number.isNaN(Number(record.timestamp))
        ? Number(record.timestamp)
        : null;
    const createdAt =
      record?.createdAt ||
      record?.created_at ||
      (recordTs ? new Date(recordTs).toISOString() : null) ||
      null;

    const date = record?.d || record?.date || "";
    const rawIcon = record?.i || record?.iconId || record?.icon_id || "note";
    const iconId = ICON_ID_BY_CODE[rawIcon] || rawIcon;
    const iconObj = STORY_ICONS.find((i) => i.id === iconId) || STORY_ICONS[STORY_ICONS.length - 1];

    // Prefer backend-provided id/timestamp; otherwise fall back to a content fingerprint.
    const backendKey =
      (record?.id ? `id:${record.id}` : "") ||
      (recordTs ? `ts:${recordTs}` : "") ||
      `fp:${sid}|${String(createdAt || "").slice(0, 19)}|${iconObj.id}|${String(message).slice(
        0,
        64
      )}`;

    const backendStory = {
      id: backendKey,
      backendKey,
      sensorId: sid,
      owner: ownerAddress.value,
      geo: props.geo ? { lat: props.geo.lat, lng: props.geo.lng } : null,
      date,
      message,
      comment: message,
      iconId: iconObj.id,
      iconTitle: iconObj.title,
      icon: iconObj.icon,
      createdAt: createdAt || new Date().toISOString(),
      test: isTest,
      source: "backend",
    };

    const merged = upsertStory(sid, backendStory, { dedupeKey: backendStory.backendKey });
    if (merged) {
      loadStories();
      return true;
    }
  } catch {
    // silent
  }
  return false;
}

async function waitForBackendIndexing({ sensorId, timeoutMs = 45000 }) {
  const start = Date.now();
  let delay = 1500;
  while (Date.now() - start < timeoutMs) {
    const merged = await refreshBackendStory();
    if (merged) return true;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(7000, Math.floor(delay * 1.4));
  }
  return false;
}

async function saveStory() {
  if (!canSubmitStory.value) return;
  if (!isOwnerLoggedIn.value) return;

  const selectedIcon =
    STORY_ICONS.find((item) => item.id === selectedIconId.value) || STORY_ICONS[0];
  const date = storyDate.value || mapState.currentDate?.value || "";
  const message = storyComment.value;

  const owner = ownerAddress.value;
  const ownerAcc = accountsList.value.find((acc) => normalizeAddress(acc?.address) === owner);
  const phrase = ownerAcc?.phrase;

  if (!phrase) {
    statusType.value = "error";
    statusMessage.value = "Missing account secret phrase for signing.";
    return;
  }

  statusType.value = "info";
  statusMessage.value = "Sending story…";
  isSubmitting.value = true;
  lastTxHash.value = "";

  const ownerSensors = await accountStore.getUserSensors(owner);
  if (!Array.isArray(ownerSensors) || !ownerSensors.includes(props.sensorId)) {
    statusType.value = "error";
    statusMessage.value = "This account has no subscription for this sensor.";
    isSubmitting.value = false;
    return;
  }

  try {
    if (!isConnected.value) {
      await instance.connect();
    }

    const pair = keyring.addFromMnemonic(phrase.trim());
    // Required for stories indexing: send with subscription set
    if (!instance.account) {
      throw new Error("Account subsystem is not ready");
    }
    instance.account.setSender(pair);
    instance.account.useSubscription(pair.address);

    const call = datalog.action.write(
      instance.api,
      JSON.stringify({
        message,
        sensor: props.sensorId,
        model: 5,
        timestamp: Date.now(),
        d: date,
        i: ICON_CODE_BY_ID[selectedIcon.id] || selectedIcon.id,
        t: IS_TEST_STORY,
      })
    );

    const nonce = await instance.api.rpc.system.accountNextIndex(pair.address);
    const res = await instance.account.signAndSend(call, { nonce });
    lastTxHash.value = res?.tx?.hash?.toHex?.() || res?.tx?.hash?.toString?.() || "";
  } catch (e) {
    statusType.value = "error";
    statusMessage.value = e?.message || "Failed to send story.";
    isSubmitting.value = false;
    return;
  }

  const newStory = {
    id: `${props.sensorId}-${Date.now()}`,
    sensorId: props.sensorId,
    owner: ownerAddress.value,
    geo: props.geo ? { lat: props.geo.lat, lng: props.geo.lng } : null,
    date,
    message,
    comment: message,
    iconId: selectedIcon.id,
    iconTitle: selectedIcon.title,
    icon: selectedIcon.icon,
    createdAt: new Date().toISOString(),
    test: IS_TEST_STORY,
    source: "local",
  };
  upsertStory(props.sensorId, newStory);
  loadStories();

  statusType.value = "success";
  statusMessage.value = lastTxHash.value
    ? `Story sent (tx: ${lastTxHash.value}). Waiting for indexing…`
    : "Story sent. Waiting for indexing…";
  resetFlow(false);

  const merged = await waitForBackendIndexing({ sensorId: props.sensorId });
  if (merged) {
    statusType.value = "success";
    statusMessage.value = "Story added successfully.";
  } else {
    statusType.value = "info";
    statusMessage.value = lastTxHash.value
      ? `Story sent (tx: ${lastTxHash.value}). Indexing may take a minute.`
      : "Story sent. Indexing may take a minute.";
  }
  isSubmitting.value = false;
}

function iconColor(id) {
  return ICON_COLORS[id] || "currentColor";
}

function storyLink(story) {
  const geo = story?.geo || null;
  const lat = geo?.lat ?? settings.MAP.position.lat;
  const lng = geo?.lng ?? settings.MAP.position.lng;
  const zoom = geo?.lat != null && geo?.lng != null ? 18 : settings.MAP.zoom;
  const provider = mapState.currentProvider?.value || "remote";
  const type = mapState.currentUnit?.value || settings.MAP.measure;
  const date = story?.date || mapState.currentDate?.value;

  return {
    name: "main",
    query: {
      provider,
      type,
      ...(date ? { date } : {}),
      zoom,
      lat,
      lng,
      sensor: story?.sensorId || props.sensorId,
    },
  };
}

async function openStoryDate(story) {
  try {
    sessionStorage.setItem("story_nav_set_date", "1");
  } catch {}
  await router.push(storyLink(story));
  // Ensure user immediately sees the date change in the chart.
  emit("open-chart");
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
</script>

<style scoped>
.story-editor {
  display: grid;
  gap: calc(var(--gap) * 0.7);
}

.story-hero {
  display: grid;
  gap: 4px;
}

.story-hero h3 {
  margin: 0;
}

.owner-hint {
  opacity: 0.8;
  margin: 0;
  margin-bottom: calc(var(--gap) * 0.5);
}

.story-jump {
  margin-left: 0.5em;
  font-weight: 800;
  text-decoration: none;
  color: var(--color-blue);
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.story-jump:hover {
  text-decoration: underline;
}

.card {
  background: var(--color-light);
  padding: var(--pad-md);
}

.card-title {
  font-weight: 900;
  margin-bottom: 6px;
}

.stack {
  display: grid;
  gap: calc(var(--gap) * 0.9);
}

.field {
  display: grid;
  gap: 0.4rem;
}

textarea {
  resize: vertical;
}

.field-title {
  font-weight: 700;
  margin-bottom: calc(var(--gap) * 0.35);
}

.field-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.field-meta {
  opacity: 0.6;
  font-size: calc(var(--font-size) * 1);
  font-weight: 700;
}

.field-help {
  font-size: calc(var(--font-size) * 1.02);
  opacity: 0.7;
}

/* removed: two-column form layout (single column feels better here) */

textarea {
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: var(--radius-md);
  padding: var(--pad-sm) var(--pad-md);
  font: inherit;
  background: rgba(0, 0, 0, 0.01);
}

textarea:focus {
  outline: none;
  border-color: var(--color-blue);
}

.actions {
  display: flex;
  gap: calc(var(--gap) * 0.4);
  flex-wrap: wrap;
}

.status {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}

.status.info {
  background: rgba(80, 120, 255, 0.1);
}

.status.success {
  background: rgba(40, 170, 85, 0.12);
  color: #1f7b44;
}

.status.error,
.error {
  background: rgba(220, 70, 70, 0.1);
  color: #a92b2b;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: calc(var(--gap) * 0.5);
}

.image-option {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 0.35rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.01);
  transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.image-option.selected {
  border-color: var(--color-blue);
  background: rgba(80, 120, 255, 0.08);
}

.image-option:hover {
  transform: translateY(-1px);
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.22);
}

.image-option input {
  accent-color: var(--color-blue);
}

.image-option img {
  width: 42px;
  height: 42px;
}

.story-icon {
  width: 42px;
  height: 42px;
}

.story-icon-large {
  width: 40px;
  height: 40px;
}

.story-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--badge-color) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 28%, rgba(0, 0, 0, 0.08));
}

.stories-list h4 {
  margin-bottom: calc(var(--gap) * 0.8);
  display: grid;
  gap: calc(var(--gap) * 0.75);
}

.story-card {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: var(--gap);
  align-items: start;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 0.6rem;
  background: #fff;
}

.story-card img {
  width: 40px;
  height: 40px;
}

.story-card p {
  margin: 0 0 0.35rem 0;
}

.story-delete {
  align-self: start;
  opacity: 0.75;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.story-delete:hover {
  opacity: 1;
}
</style>
