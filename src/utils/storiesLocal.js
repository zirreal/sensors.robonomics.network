const STORIES_KEY = "altruist_sensor_stories_v1";
const STORIES_UPDATED_EVENT = "stories_updated";
const STORIES_SEEN_KEY = "altruist_stories_seen_v1";
const SHOW_TEST_STORIES_KEY = "show_test_stories";

export const storiesLocalKeys = {
  STORIES_KEY,
  STORIES_UPDATED_EVENT,
  STORIES_SEEN_KEY,
  SHOW_TEST_STORIES_KEY,
};

export function shouldShowTestStories() {
  try {
    return localStorage.getItem(SHOW_TEST_STORIES_KEY) === "1";
  } catch {
    return false;
  }
}

export function readStoriesMap() {
  try {
    const raw = localStorage.getItem(STORIES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeStoriesMap(value) {
  localStorage.setItem(STORIES_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(STORIES_UPDATED_EVENT));
}

export function getStoriesForSensor(sensorId) {
  const all = readStoriesMap();
  const list = all?.[sensorId];
  return Array.isArray(list) ? list : [];
}

export function getAllStoriesFlat() {
  const parsed = readStoriesMap();
  const flattened = [];
  for (const [sensorId, list] of Object.entries(parsed)) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item) continue;
      flattened.push({ ...item, sensorId: item.sensorId || sensorId });
    }
  }
  return flattened;
}

export function upsertStory(sensorId, story, { dedupeKey } = {}) {
  if (!sensorId || !story) return false;
  const all = readStoriesMap();
  const list = Array.isArray(all[sensorId]) ? all[sensorId] : [];
  const key = String(dedupeKey || story?.backendKey || story?.id || "");
  const exists =
    key &&
    list.some((s) => String(s?.backendKey || s?.id || "") === key);
  if (exists) return false;
  all[sensorId] = [story, ...list];
  writeStoriesMap(all);
  return true;
}

export function readSeenSet() {
  try {
    const raw = localStorage.getItem(STORIES_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = Array.isArray(parsed) ? parsed : [];
    return new Set(ids.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

export function writeSeenSet(seenSet) {
  try {
    localStorage.setItem(STORIES_SEEN_KEY, JSON.stringify(Array.from(seenSet || [])));
  } catch {}
}

