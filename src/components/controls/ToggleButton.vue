<template>
  <button
    class="toggle-button"
    :class="[
      {
        active: modelValue,
        'toggle-button-label': label && label.length > 0,
      },
    ]"
    v-bind="$attrs"
    @click="toggleValue"
  >
    <font-awesome-icon :icon="iconClass" class="toggle-icon" />
    <span v-if="label" class="toggle-label">{{ label }}</span>
    <font-awesome-icon v-if="modelValue" icon="fa-solid fa-check" class="check-icon" />
    <slot />
  </button>
</template>

<script>
export default {
  inheritAttrs: false,
};
</script>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  iconClass: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const toggleValue = () => {
  emit("update:modelValue", !props.modelValue);
};
</script>

<style scoped>
.toggle-button {
  align-items: center;
  background-color: var(--app-inputbg);
  border-radius: 5rem;
  border: var(--app-borderwidth) solid var(--app-bordercolor);
  cursor: pointer;
  display: flex;
  height: var(--app-inputheight);
  flex-direction: column;
  justify-content: center;
  user-select: none;
  width: var(--app-inputheight);
  color: var(--app-inputtextcolor);
  font-size: var(--font-size);
  transition: all 0.2s ease;
  position: relative;
}

.toggle-button-label {
  flex-direction: row;
  width: auto;
  padding: 0 0.5rem;
  gap: 0.5rem;
}

.toggle-icon {
  /* icon size tuned for small circular button */
  font-size: 1em;
  line-height: 1;
  margin-top: 0;
}

.toggle-label {
  font-size: calc(var(--font-size) * 0.8);
  font-weight: bold;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}

.toggle-button:hover:not([disabled]) {
  opacity: 0.8;
}

.toggle-button.active {
  color: var(--color-blue);
  border-color: var(--color-blue);
}

.toggle-button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.check-icon {
  position: absolute;
  top: -1px;
  right: -3px;
  font-size: 0.6em;
  background-color: var(--color-blue);
  color: var(--color-light);
  border-radius: 50%;
  padding: 2px;
}
</style>
