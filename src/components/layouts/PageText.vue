<template>
    <Header />
    <section class="container-pagetext">
        <slot />
    </section>
    <footer>
        <AltruistPromo utmMedium="footer" class="footer" />
        <nav class="footer-section">
            <ul class="footer-section-in">
                <li><router-link to="/altruist-use-cases">{{ $t('Altruist use cases') }}</router-link></li>
                <li><router-link to="/altruist-timeline">{{$t('Altruist timeline')}}</router-link></li>
                <li><router-link to="/air-measurements">{{ $t("links.measurement") }}</router-link></li>
                <li><router-link to="/privacy-policy">{{ $t("links.privacy") }}</router-link></li>
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
                    >{{ $t("header.link1") }}</a>
                    {{ $t("header.text2") }}
                    <a
                    href="https://robonomics.academy/en/learn/sensors-connectivity-course/sensors-connectivity-module/"
                    target="_blank"
                    rel="noopener"
                    >{{ $t("header.link2") }}</a>
                    {{ $t("header.text3") }}
                </p>
                <ReleaseInfo />
            </div>
        </section>
    </footer>
</template>

<script setup>
import Header from '../header/Header.vue';
import AltruistPromo from "../devices/altruist/AltruistPromo.vue";
import ReleaseInfo from "../../components/ReleaseInfo.vue";
</script>

<style>

.container-pagetext {
  flex: 1 0 auto;
  padding: calc(var(--gap) * 5) calc(var(--gap) * 3) calc(var(--gap) * 3);
  margin: 0 auto;
  max-width: 1400px;
  width: 100vw;
}

.container-pagetext > * {
  --font-size: 1.3rem;
  --gap: 1.7rem;
  line-height: 1.5;
}

@media (width < 800px) {
  .container-pagetext > * {
    --gap: 1.4rem;
  }
}

.container-pagetext section:not(:last-child) {
  margin-bottom: calc(var(--gap) * 3);
}

.container-pagetext ul{
  list-style: initial;
  margin-left: var(--gap);
}

.pagetext-highlight {
  font-weight: 900;
}

.pagetext-fullwidth-image {
  display: block;
  width: 100vw;
  max-width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
}

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
        gap: calc(var(--gap) *3);
        font-weight: bold;
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