<template>
  <button
    v-if="isNativeShareAvailable"
    @click.prevent="handleNativeShare"
    class="button native-share-button button-round-outline"
    :title="t('sensorpopup.sharedefault')"
  >
    <font-awesome-icon icon="fa-solid fa-share-nodes" />
  </button>
</template>

<script setup>
import { computed, getCurrentInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { settings } from '@config';

const { t } = useI18n();
const { proxy } = getCurrentInstance();

const isNativeShareAvailable = computed(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function');

const handleNativeShare = async () => {
  if (!isNativeShareAvailable.value) {
    proxy?.$notify?.({
      position: 'top right',
      text: t('details.nativeShareNotAvailable') || 'Native share is not available'
    });
    return;
  }

  try {
    await navigator.share({
      title: settings?.TITLE || document.title,
      url: window.location.href
    });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.warn('Native share cancelled or failed:', error);
    }
  }
};
</script>
