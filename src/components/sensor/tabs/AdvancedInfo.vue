<template>
  <section class="advanced-tab">
    <div class="advanced-header">
      <div class="advanced-title">Sensors in this bundle</div>
      <div class="advanced-subtitle" v-if="countWithData > 0">{{ countWithData }} with data</div>
    </div>

    <div v-if="itemsWithData.length === 0" class="empty">No additional sensors with data.</div>

    <div v-else class="grid">
      <button
        v-for="s in itemsWithData"
        :key="s.sensor_id"
        type="button"
        class="card"
        :class="{ active: s.sensor_id === activeSensorId }"
        @click.prevent="$emit('select', s)"
      >
        <div class="top">
          <span class="badge" :data-kind="s.kind">{{ kindLabel(s.kind) }}</span>
          <span class="id">{{ collapseId(s.sensor_id) }}</span>
        </div>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  ownerSensors: { type: Array, default: () => [] },
  activeSensorId: { type: String, default: null },
});

defineEmits(["select"]);

const itemsWithData = computed(() => {
  const arr = Array.isArray(props.ownerSensors) ? props.ownerSensors : [];
  return arr.filter((s) => (s?.logsCount || 0) > 0 && s?.sensor_id);
});

const countWithData = computed(() => itemsWithData.value.length);

const collapseId = (id) => {
  const s = String(id || "");
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
};

const kindLabel = (kind) => {
  if (kind === "urban") return "Urban";
  if (kind === "insight") return "Insight";
  return "Sensor";
};
</script>

<style scoped>
.advanced-tab {
  display: grid;
  gap: calc(var(--gap) * 1);
}

.advanced-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gap);
}

.advanced-title {
  font-weight: 900;
}

.advanced-subtitle {
  opacity: 0.7;
  font-size: 0.9em;
  font-weight: 700;
}

.empty {
  opacity: 0.7;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.02);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media screen and (width < 520px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.75);
  padding: 10px 12px;
  border-radius: 14px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
}

.card.active {
  border-color: rgba(80, 120, 255, 0.55);
  box-shadow: 0 0 0 1px rgba(80, 120, 255, 0.18);
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.badge {
  font-size: 0.78em;
  font-weight: 900;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.03);
}

.badge[data-kind="urban"] {
  background: rgba(130, 90, 255, 0.12);
  border-color: rgba(130, 90, 255, 0.22);
}

.badge[data-kind="insight"] {
  background: rgba(176, 138, 122, 0.14);
  border-color: rgba(176, 138, 122, 0.26);
}

.id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.85em;
  opacity: 0.75;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hint {
  font-size: 0.85em;
  font-weight: 700;
  opacity: 0.75;
}
</style>
