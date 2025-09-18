<template>
  <MetaInfo
    :pageTitle= "$t('Compare table for Altruist with other air quality sensors')"
    :pageDescription="$t('Explore the advantages and special features of each sensor and choose the one that best suits your needs!')"
    :pageImage="ogImage"
  />
  <PageTextLayout>

    <AltruistCompare gif />

  </PageTextLayout>
</template>


<script setup>
import { getCurrentInstance, onMounted } from "vue";

import AltruistPromo from "../components/devices/altruist/AltruistPromo.vue";
import MetaInfo from '../components/MetaInfo.vue';
import PageTextLayout from "../components/layouts/PageText.vue";
import AltruistCompare from "../components/devices/altruist/AltruistCompare.vue";

import ogImage from '../assets/images/pages/altruist-compare/og-altruist-compare.webp';

onMounted(() => {
  const instance = getCurrentInstance();
  const matomo = instance?.proxy?.$matomo;

  if (matomo) {
    matomo.disableCookies();
    matomo.trackPageView();
  }
});
</script>