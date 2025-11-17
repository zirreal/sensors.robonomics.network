<template>
  <a
    class="nowrap copy"
    :title="title"
    role="button"
    tabindex="0"
    @click="handleCopy"
    @keyup.enter.prevent="handleCopy"
  >
    <slot />
    <font-awesome-icon
      :icon="successCopy ? 'fa-solid fa-check' : 'fa-regular fa-copy'"
    />
</a>
</template>

<script setup>
import { ref, getCurrentInstance, onBeforeUnmount } from 'vue';

const props = defineProps({
  msg: {
    type: [String, Number],
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  notify: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['copied']);

const successCopy = ref(false);
const resetTimer = ref(null);
const { proxy } = getCurrentInstance();

const showSuccessState = () => {
  successCopy.value = true;
  if (resetTimer.value) {
    clearTimeout(resetTimer.value);
  }
  resetTimer.value = setTimeout(() => {
    successCopy.value = false;
    resetTimer.value = null;
  }, 2000);
};

const notify = () => {
  if (!props.notify) return;
  proxy?.$notify?.({
    position: 'top right',
    text: props.notify
  });
};

const writeToClipboard = async (value) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

const handleCopy = async () => {
  const text = String(props.msg ?? '');
  if (!text) return;

  try {
    await writeToClipboard(text);
    showSuccessState();
    notify();
    emit('copied');
  } catch (error) {
    console.error('Failed to copy text:', error);
  }
};

onBeforeUnmount(() => {
  if (resetTimer.value) {
    clearTimeout(resetTimer.value);
    resetTimer.value = null;
  }
});
</script>

<style scoped>
.copy {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: calc(var(--gap) * 0.4);
}

.copy .fa-copy, .copy .fa-check {
  color: var(--color-link);
  font-size:calc(var(--font-size) * 1.4);
}

.copy:not(:last-child) { margin-right: calc(var(--gap) * 0.9); }
.copy:not(:first-child) { margin-left: calc(var(--gap) * 0.9); }

/* @media screen and (max-width: 680px) {
  .copy {
    font-size: calc(var(--font-size) * 0.8);
  }
} */
</style>
