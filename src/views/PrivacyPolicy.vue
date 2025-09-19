<template>
  <MetaInfo
    pageTitle= "Sensors.social Privacy Policy"
    :pageImage = "ogImage"
  />
  <PageTextLayout>
    <h1>{{ $t("privacypolicy.title") }}</h1>

    <p class="privacy-policy__descr">
      {{ $t("privacypolicy.description") }}
    </p>

    <div class="privacy-policy__wrapper">
      <h2 class="privacy-policy__subtitle">{{ $t("privacypolicy.subtitle1") }}</h2>
      <p class="privacy-policy__descr">{{ $t("privacypolicy.text1") }}</p>
      <ul>
        <li>{{ $t("privacypolicy.listitem1") }}</li>
        <li>{{ $t("privacypolicy.listitem2") }}</li>
        <li>{{ $t("privacypolicy.listitem3") }}</li>
        <li>{{ $t("privacypolicy.listitem4") }}</li>
      </ul>
    </div>

    <div class="privacy-policy__wrapper">
      <h2 class="privacy-policy__subtitle">{{ $t("privacypolicy.subtitle2") }}</h2>
      <p class="privacy-policy__descr">{{ $t("privacypolicy.text2") }}</p>

      <ul>
        <li>
          <b>{{ $t("privacypolicy.listitem5bold") }}</b> {{ $t("privacypolicy.listitem5") }}
        </li>
        <li>
          <b>{{ $t("privacypolicy.listitem6bold") }}</b> {{ $t("privacypolicy.listitem6text1") }}
          <a target="_blank" href="https://matomo.org/faq/general/faq_18254/">{{
            $t("privacypolicy.listitem6link1")
          }}</a>
          {{ $t("privacypolicy.listitem6text2") }}
          <a
            target="_blank"
            href="https://matomo.org/privacy-policy/#:~:text=usage%20data%20in-,Matomo%20Analytics,-for%20statistical%20purposes"
            >{{ $t("privacypolicy.listitem6link2") }}</a
          >
          {{ $t("privacypolicy.listitem6text3") }}
        </li>
        <li>
          <b>{{ $t("privacypolicy.listitem7bold") }}</b> {{ $t("privacypolicy.listitem7") }}
        </li>
      </ul>
    </div>

    <div class="privacy-policy__wrapper">
      <h2 class="privacy-policy__subtitle">{{ $t("privacypolicy.matomooptout") }}</h2>
      <p class="privacy-police__descr">
        {{ $t("privacypolicy.matomodescription") }}
      </p>

      <OptOutForm />
    </div>

    <div class="privacy-policy__wrapper">
      <h2 class="privacy-policy__subtitle">{{ $t("privacypolicy.subtitle3") }}</h2>
      <p class="privacy-police__descr">
        {{ $t("privacypolicy.text3") }}
      </p>
      <p class="privacy-police__descr">
        {{ $t("privacypolicy.text4") }}
      </p>
      <p class="privacy-police__descr">
        {{ $t("privacypolicy.text5") }}
      </p>
      <p class="privacy-police__descr">
        {{ $t("privacypolicy.text6") }}
      </p>
    </div>

    <div class="privacy-policy__wrapper">
      <h2 class="privacy-policy__subtitle">{{ $t("privacypolicy.subtitle4") }}</h2>
      <p class="privacy-police__descr">
        {{ $t("privacypolicy.text7") }}
      </p>
      <p class="privacy-police__descr">
        {{ $t("privacypolicy.text8") }}
      </p>
    </div>
  </PageTextLayout>

</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import MetaInfo from "../components/MetaInfo.vue";
import OptOutForm from "../components/matomo/OptOutForm.vue";
import PageTextLayout from "../components/layouts/PageText.vue";

import ogImage from '../assets/images/pages/privacy-policy/og-privacy-policy.webp';

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

<style scoped>
header {
  width: 99vw;
}

h1 {
  hyphens: auto;
  overflow-wrap: break-word;
  word-break: break-word;
}

.privacy-policy ul {
  padding-left: 20px;
  list-style: disc;
}

.privacy-policy__wrapper:not(:last-of-type) {
  margin-bottom: 3rem;
}
</style>
