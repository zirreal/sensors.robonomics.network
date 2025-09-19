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
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import AltruistPromo from "../components/devices/altruist/AltruistPromo.vue";
import MetaInfo from '../components/MetaInfo.vue';
import PageTextLayout from "../components/layouts/PageText.vue";
import AltruistCompare from "../components/devices/altruist/AltruistCompare.vue";

import ogImage from '../assets/images/pages/altruist-compare/og-altruist-compare.webp';

const router = useRouter();

onMounted(() => {
  const waitForMatomo = setInterval(() => {
    if (
      typeof window.Matomo !== "undefined" &&
      typeof window.Matomo.getTracker === "function"
    ) {
      clearInterval(waitForMatomo);

      const trackPage = () => {
        const tracker = window.Matomo.getTracker();
        if (tracker && !tracker.isUserOptedOut()) {
          window._paq.push(["setCustomUrl", router.currentRoute.value.fullPath]);
          window._paq.push(["setDocumentTitle", document.title]);
          window._paq.push(["trackPageView"]);
        }
      };

      // Track the initial page load
      trackPage();
    }
  }, 100);
});
</script>