<template>
  <section v-if="stories.length" class="stories-bar" aria-label="Recent stories">
    <div class="stories-meta" aria-hidden="true">
      <div class="stories-dot"></div>
      <div class="stories-meta-text">
        <div class="stories-meta-title">Stories</div>
        <div class="stories-meta-sub">
          <template v-if="unseenCount > 0">{{ unseenCount }} new</template>
          <template v-else>{{ $t("All seen") }}</template>
        </div>
      </div>
    </div>

    <button
      v-if="isOverflowing"
      class="stories-nav button-round-outline"
      type="button"
      aria-label="Previous stories"
      :disabled="!canScrollLeft"
      @click="scrollBy(-1)"
    >
      <font-awesome-icon icon="fa-solid fa-caret-left" />
    </button>

    <div
      ref="scroller"
      class="stories-scroller"
      role="list"
      :style="scrollerMaskStyle"
      @scroll="updateOverflow"
    >
      <router-link
        v-for="story in stories"
        :key="story.id"
        class="story-bubble"
        :class="{ seen: isStorySeen(story) }"
        role="listitem"
        :to="storyLink(story)"
        :title="story.message || story.comment"
        @click="markStoryNavigation(story)"
      >
        <div class="bubble-ring">
          <div class="bubble">
            <div
              class="story-icon-badge"
              :style="{ '--badge-color': iconColor(story.iconId) }"
              aria-hidden="true"
            >
              <font-awesome-icon
                v-if="story.icon"
                :icon="story.icon"
                class="story-icon"
                :style="{ color: iconColor(story.iconId) }"
              />
              <font-awesome-icon v-else icon="fa-solid fa-comment" class="story-icon" />
            </div>
          </div>
        </div>
      </router-link>
    </div>

    <button
      v-if="isOverflowing"
      class="stories-nav button-round-outline"
      type="button"
      aria-label="Next stories"
      :disabled="!canScrollRight"
      @click="scrollBy(1)"
    >
      <font-awesome-icon icon="fa-solid fa-caret-right" />
    </button>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from "vue";
import { settings } from "@config";
import { useMap } from "@/composables/useMap";
import { dayISO } from "@/utils/date";
import {
  fetchStoryList,
  getAllStoriesFlat,
  isStoryHidden,
  normalizeBackendStory,
  preferredUnitByStoryIcon,
  upsertStory,
  readSeenSet,
  storiesLocalKeys,
  writeSeenSet,
} from "@/composables/useStories";

const STORY_NAV_FLAG = "story_nav_set_date";

const mapState = useMap();
const scroller = ref(null);
const remoteStories = ref([]);
const isOverflowing = ref(false);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
let ro = null;

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

function iconColor(id) {
  return ICON_COLORS[id] || "currentColor";
}

const seenIds = ref(new Set());

function loadSeen() {
  seenIds.value = readSeenSet();
}

function persistSeen() {
  writeSeenSet(seenIds.value);
}

function isStorySeen(story) {
  const id = String(story?.id || "");
  if (!id) return false;
  return seenIds.value.has(id);
}

function markStorySeen(story) {
  const id = String(story?.id || "");
  if (!id) return;
  if (seenIds.value.has(id)) return;
  const next = new Set(seenIds.value);
  next.add(id);
  seenIds.value = next;
  persistSeen();
}

function markStoryNavigation(story) {
  try {
    sessionStorage.setItem(STORY_NAV_FLAG, "1");
  } catch {}

  markStorySeen(story);
}

const unseenCount = computed(() => stories.value.filter((s) => !isStorySeen(s)).length);

async function refreshRemoteStories() {
  try {
    // Backend is the source-of-truth for the global feed.
    // We still merge in local cache below so freshly published stories can appear immediately
    // even before the indexer catches up.
    const { list } = await fetchStoryList({ limit: 50, page: 1 });
    const normalized = (list || []).map((r) => normalizeBackendStory(r)).filter(Boolean);
    remoteStories.value = normalized;

    // Persist backend stories into the per-sensor cache as well.
    // The sensor popup/banner reads from `getStoriesForSensor()` (localStorage),
    // so without this, clicking a feed story may navigate correctly but still show “no story”.
    for (const s of normalized) {
      if (!s?.sensorId) continue;
      upsertStory(s.sensorId, s, { dedupeKey: s.backendKey || s.id });
    }
  } catch {
    // silent: header should still work with local cached stories if backend is down
    remoteStories.value = remoteStories.value || [];
  }
}

const stories = computed(() => {
  const remote = Array.isArray(remoteStories.value) ? remoteStories.value : [];
  const local = getAllStoriesFlat();

  // De-dupe backend/local copies of the same story.
  // `backendKey` is designed to be stable across sources (ideally: author+sensor+timestamp).
  const byKey = new Map();
  for (const s of [...remote, ...local]) {
    if (!s) continue;
    const key = String(s.backendKey || s.id || "");
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, s);
  }

  const all = Array.from(byKey.values());
  if (!all.length) return [];

  // Hard hide list for “do not show in feed” items (by sensorId+timestamp pair).
  const visible = all.filter((s) => !isStoryHidden(s));
  if (!visible.length) return [];

  visible.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return visible.slice(0, 8);
});

watch(
  stories,
  async () => {
    await nextTick();
    updateOverflow();
  },
  { immediate: true }
);

function storyLink(story) {
  const geo = story.geo || null;
  const lat = geo?.lat ?? settings.MAP.position.lat;
  const lng = geo?.lng ?? settings.MAP.position.lng;
  const zoom = geo?.lat != null && geo?.lng != null ? 18 : settings.MAP.zoom;
  // Stories always point to historical data, which is only available in `remote`.
  const provider = "remote";
  const suggestedType = preferredUnitByStoryIcon(story?.iconId);
  const type = suggestedType || mapState.currentUnit?.value || settings.MAP.measure;
  const ts = story?.timestamp;
  const derivedDay =
    story?.date || (ts != null && !Number.isNaN(Number(ts)) ? dayISO(Number(ts)) : null);

  return {
    name: "main",
    query: {
      provider,
      type,
      ...(derivedDay ? { date: derivedDay } : {}),
      ...(ts != null ? { timestamp: String(ts) } : {}),
      zoom,
      lat,
      lng,
      sensor: story.sensorId,
    },
  };
}

function scrollBy(dir) {
  const el = scroller.value;
  if (!el) return;
  const step = Math.max(220, Math.floor(el.clientWidth * 0.7));
  // If we're close to an edge, snap to it to avoid half-visible bubbles.
  const leftNow = el.scrollLeft;
  const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
  const edgeSlack = 12; // px threshold where we treat as "at edge"

  if (dir < 0 && leftNow <= step + edgeSlack) {
    el.scrollTo({ left: 0, behavior: "smooth" });
    return;
  }
  if (dir > 0 && maxLeft - leftNow <= step + edgeSlack) {
    el.scrollTo({ left: maxLeft, behavior: "smooth" });
    return;
  }

  el.scrollBy({ left: dir * step, behavior: "smooth" });
}

function updateOverflow() {
  const el = scroller.value;
  if (!el) {
    isOverflowing.value = false;
    canScrollLeft.value = false;
    canScrollRight.value = false;
    return;
  }
  isOverflowing.value = el.scrollWidth > el.clientWidth + 2;
  const leftNow = el.scrollLeft;
  const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
  const edgeSlack = 12;
  canScrollLeft.value = leftNow > edgeSlack;
  canScrollRight.value = maxLeft - leftNow > edgeSlack;
}

const scrollerMaskStyle = computed(() => {
  if (!isOverflowing.value) return {};
  const left = canScrollLeft.value;
  const right = canScrollRight.value;
  if (left && right) {
    return {
      maskImage: "linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)",
      WebkitMaskImage:
        "linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)",
    };
  }
  if (left && !right) {
    return {
      maskImage: "linear-gradient(90deg, transparent 0%, #000 8%, #000 100%)",
      WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 8%, #000 100%)",
    };
  }
  if (!left && right) {
    return {
      maskImage: "linear-gradient(90deg, #000 0%, #000 92%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 92%, transparent 100%)",
    };
  }
  return {};
});

function bump() {
  refreshRemoteStories();
  updateOverflow();
}

onMounted(() => {
  loadSeen();
  refreshRemoteStories();
  window.addEventListener("storage", bump);
  window.addEventListener(storiesLocalKeys.STORIES_UPDATED_EVENT, bump);
  updateOverflow();
  if (window.ResizeObserver) {
    ro = new ResizeObserver(updateOverflow);
    if (scroller.value) ro.observe(scroller.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("storage", bump);
  window.removeEventListener(storiesLocalKeys.STORIES_UPDATED_EVENT, bump);
  if (ro) {
    ro.disconnect();
    ro = null;
  }
});
</script>

<style scoped>
.stories-bar {
  display: flex;
  align-items: center;
  gap: calc(var(--gap) / 2);
  width: min(760px, 100%);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: calc(var(--gap) * 0.5) calc(var(--gap) * 0.8);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}

.stories-meta {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--gap) * 0.7);
  flex: 0 0 auto;
  padding-right: calc(var(--gap) * 0.3);
}

.stories-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--color-blue);
  box-shadow: 0 0 0 6px rgba(0, 123, 255, 0.12);
}

.stories-meta-text {
  display: grid;
  line-height: 1.05;
}

.stories-meta-title {
  font-weight: 900;
  font-size: calc(var(--font-size) * 1.05);
}

.stories-meta-sub {
  opacity: 0.7;
  font-weight: 800;
  font-size: calc(var(--font-size) * 0.95);
}

.stories-nav {
  flex: 0 0 auto;
}

.stories-nav:disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

@media screen and (max-width: 460px) {
  .stories-nav {
    display: none;
  }

  .stories-scroller {
    scroll-snap-type: x proximity;
    padding-left: 2px;
    padding-right: 2px;
  }
}

.stories-scroller {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 70px;
  gap: calc(var(--gap) / 1.25);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 2px 6px;
  scrollbar-width: none;
  min-width: 0;
}

.stories-scroller::-webkit-scrollbar {
  display: none;
}

.bubble-ring {
  width: 54px;
  height: 54px;
  border-radius: 100%;
  background: transparent;
  border: 2px solid var(--color-blue);
  position: relative;
}

.story-bubble.seen .bubble-ring {
  border-color: rgba(0, 0, 0, 0.18);
}

.bubble {
  width: 100%;
  height: 100%;
  border-radius: 100%;
  background: var(--color-light);
  display: grid;
  place-items: center;
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: border 0.2s ease, transform 0.2s ease;
}

.story-bubble:focus-visible .bubble,
.story-bubble:hover .bubble {
  transform: translateY(-1px);
}

.story-bubble:hover .bubble {
  border-color: rgba(0, 0, 0, 0.18);
}

.story-icon {
  width: 24px;
  height: 24px;
}

.story-icon-badge {
  width: 34px;
  height: 34px;
  border-radius: 100%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--badge-color) 14%, transparent);
}

@media (prefers-color-scheme: dark) {
  .stories-bar {
    background: rgba(20, 20, 20, 0.22);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  }

  .bubble {
    border-color: rgba(255, 255, 255, 0.14);
  }

  .story-bubble:hover .bubble {
    border-color: rgba(255, 255, 255, 0.22);
  }

  .story-bubble.seen .bubble-ring {
    border-color: rgba(255, 255, 255, 0.22);
  }

  .story-icon-badge {
    background: color-mix(in srgb, var(--badge-color) 18%, transparent);
    border-color: color-mix(in srgb, var(--badge-color) 30%, rgba(255, 255, 255, 0.12));
  }
}
</style>
