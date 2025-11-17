<template>
  <section class="accordion">
    <button
      class="accordion__header"
      type="button"
      @click="toggle"
      :aria-expanded="isOpen"
    >
      <span><slot name="title">{{ title }}</slot></span>
      <font-awesome-icon :icon="isOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
    </button>

    <transition name="accordion-collapse">
      <div
        v-show="isOpen"
        class="accordion__body"
      >
        <slot />
      </div>
    </transition>
  </section>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  defaultOpen: {
    type: Boolean,
    default: false
  }
});

const isOpen = ref(props.defaultOpen);

const toggle = () => {
  isOpen.value = !isOpen.value;
};
</script>

<style scoped>
.accordion {
  border-radius: var(--border-radius, 6px);
  background: var(--color-light, #fff);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--color-dark);
  overflow: hidden;
}

.accordion__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap);
  background: transparent;
  color: inherit;
  border: none;
  padding: calc(var(--gap) * 0.75) calc(var(--gap) * 1.2);
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}

.accordion__body {
  padding: calc(var(--gap) * 0.75) calc(var(--gap) * 1.2);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.accordion-collapse-enter-active,
.accordion-collapse-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
}

.accordion-collapse-enter-from,
.accordion-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.accordion-collapse-enter-to,
.accordion-collapse-leave-from {
  max-height: 600px;
  opacity: 1;
}
</style>

