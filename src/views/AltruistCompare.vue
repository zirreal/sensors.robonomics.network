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
import config from "@config";
import AltruistPromo from "../components/devices/altruist/AltruistPromo.vue";
import PageTextLayout from "../components/layouts/PageText.vue";
import AltruistCompare from "../components/devices/altruist/AltruistCompare.vue";

const ogImage = new URL(
  new URL(
    "@/assets/images/pages/altruist-compare/og-altruist-compare.webp",
    import.meta.url
  ).pathname,
  config.SITE_URL
).href;
</script>