<template>
  <MetaInfo
    pageTitle= "7 Years of Altruism - Altruist Timeline"
    pageDescription="At the end of July 2025, a team of open source developers working on a smart home device ecosystem will present their first product in a planned line of smart home devices for the year — a consumer device called “Altruist”."
    :pageImage="ogImage"
  />
  <PageTextLayout>

    <AltruistCompare />

  </PageTextLayout>
</template>


<script setup>
import MetaInfo from '../components/MetaInfo.vue';
import AltruistPromo from "../components/devices/altruist/AltruistPromo.vue";
import PageTextLayout from "../components/layouts/PageText.vue";
import AltruistCompare from "../components/devices/altruist/AltruistCompare.vue";

const ogImage = new URL('@/assets/images/pages/altruist-compare/og-altruist-compare.webp', import.meta.url).href
</script>