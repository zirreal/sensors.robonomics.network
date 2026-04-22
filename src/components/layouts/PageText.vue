<template>
  <Header />
  <section class="container-pagetext">
    <slot />
  </section>
  <footer>
    <nav class="footer-section">
      <ul class="footer-section-in">
        <li>
          <router-link to="/altruist-device-info">{{ $t("Altruist device info") }}</router-link>
        </li>
        <li>
          <router-link to="/altruist-use-cases">{{ $t("Altruist use cases") }}</router-link>
        </li>
        <li>
          <router-link to="/altruist-timeline">{{ $t("Altruist timeline") }}</router-link>
        </li>
        <li>
          <router-link to="/altruist-compare">{{ $t("Altruist compare") }}</router-link>
        </li>
        <li>
          <router-link to="/altruist-setup">{{ $t("Altruist setup") }}</router-link>
        </li>
        <li>
          <router-link to="/air-measurements">{{ $t("links.measurement") }}</router-link>
        </li>
        <li>
          <router-link to="/construction-monitoring">{{
            $t("Construction monitoring")
          }}</router-link>
        </li>
        <li>
          <router-link to="/noise-data-real-estate">{{
            $t("Noise data for real estate")
          }}</router-link>
        </li>
        <li>
          <router-link to="/privacy-policy">{{ $t("links.privacy") }}</router-link>
        </li>
      </ul>
    </nav>
    <section class="footer-section separate">
      <div class="footer-section-in">
        <p>
          {{ $t("header.text1") }}
          <a
            href="https://www.fsf.org/campaigns/priority-projects/decentralization-federation"
            target="_blank"
            rel="noopener"
            >{{ $t("header.link1") }}</a
          >
          {{ $t("header.text2") }}
          <a
            href="https://robonomics.academy/en/learn/sensors-connectivity-course/sensors-connectivity-module/"
            target="_blank"
            rel="noopener"
            >{{ $t("header.link2") }}</a
          >
          {{ $t("header.text3") }}
        </p>
        <ReleaseInfo />
      </div>
    </section>
  </footer>
</template>

<script setup>
import Header from "../header/Header.vue";
import ReleaseInfo from "../../components/ReleaseInfo.vue";
</script>

<style>
.buySensor.footer {
  margin-bottom: 0 !important;
}
</style>

<style scoped>
footer {
  margin-top: calc(var(--gap) * 3);
  display: grid;
  grid-template-rows: 1fr;
  flex-shrink: 0;
}

.footer-section {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--gap) 0;
}

nav ul {
  display: flex;
  gap: calc(var(--gap) * 1.2) calc(var(--gap) * 2);
  font-weight: bold;
  flex-wrap: wrap;
  max-width: 100%;
}

nav ul li {
  margin-bottom: 0;
}

.footer-section.separate:not(:first-child) {
  border-top: 1px dotted var(--app-textcolor);
}

.footer-section-in {
  padding-left: var(--gap);
  padding-right: var(--gap);
}

@media screen and (max-width: 690px) {
  nav ul {
    flex-wrap: wrap;
    gap: var(--gap);
    align-items: center;
    justify-content: center;
  }
}
</style>
