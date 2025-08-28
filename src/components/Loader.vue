<template>
  <div
    class="spinner"
    role="status"
    :aria-label="ariaLabel"
    :class="{ overlay }"
    :style="styleVars"
    v-bind="$attrs"
  >
    <svg class="spinner__svg" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
      <circle class="spinner__circle" cx="25" cy="25" r="20" fill="none" />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: { type: [Number, String], default: 24 },        // px или любая CSS-единица
  color: { type: String, default: 'currentColor' },     // берёт цвет текста по умолчанию
  thickness: { type: [Number, String], default: 3 },    // толщина штриха
  speed: { type: [Number, String], default: 1 },        // секунды на оборот
  overlay: { type: Boolean, default: false },           // полноэкранная подложка
  ariaLabel: { type: String, default: 'Loading' }
})

const styleVars = computed(() => ({
  '--spinner-size': typeof props.size === 'number' ? `${props.size}px` : String(props.size),
  '--spinner-color': props.color,
  '--spinner-thickness': typeof props.thickness === 'number' ? `${props.thickness}px` : String(props.thickness),
  '--spinner-speed': typeof props.speed === 'number' ? `${props.speed}s` : String(props.speed)
}))
</script>

<style scoped>
.spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;

  /* значения по умолчанию */
  --spinner-size: 24px;
  --spinner-color: currentColor;
  --spinner-thickness: 3px;
  --spinner-speed: 1s;
}

.spinner.overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, .6);
  backdrop-filter: blur(2px);
  z-index: 9999;
}

.spinner__svg {
  width: var(--spinner-size);
  height: var(--spinner-size);
  animation: spinner-rotate var(--spinner-speed) linear infinite;
}

.spinner__circle {
  stroke: var(--spinner-color);
  stroke-width: var(--spinner-thickness);
  stroke-linecap: round;
  stroke-dasharray: 1, 126;
  stroke-dashoffset: 0;
  animation: spinner-dash calc(var(--spinner-speed) * 1.5) ease-in-out infinite;
}

@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}

@keyframes spinner-dash {
  0%   { stroke-dasharray: 1, 126;  stroke-dashoffset: 0; }
  50%  { stroke-dasharray: 90, 126; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 1, 126;  stroke-dashoffset: -125; }
}
</style>
