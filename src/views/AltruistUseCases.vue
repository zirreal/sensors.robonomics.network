<template>
  <MetaInfo
    pageTitle= "Who Altruist Was Created For - Sensors use cases"
    pageDescription="Monitoring the environment involves plenty of pitfalls, making the job far harder than it looks at first glance. Our team—the creators of Altruist and the open-source project sensors.social—has spent seven years studying and working in this field, and we hope our experience will pleasantly surprise you and give you a practical tool for adapting to the conditions in which you and your loved ones live. Below we explain which main user groups Altruist is designed for…"
    :pageImage="ogImage"
  />
  <Header />
  <section class="container-pagetext">
    <h1>Who Altruist Was Created For</h1>

    <section class="pagetext-highlight">
      <p>Monitoring the environment involves plenty of pitfalls, making the job far harder than it looks at first glance. Our team—the creators of Altruist and the open-source project sensors.social—has spent seven years studying and working in this field, and we hope our experience will pleasantly surprise you and give you a practical tool for adapting to the conditions in which you and your loved ones live. Below we explain which main user groups Altruist is designed for…</p>
      <AltruistPromo utmMedium="altruist-use-cases" />
    </section>

    <section>
      <h2>🏙️ You live in a big city or an ecologically challenged region</h2>
      <p><img alt="" class="pagetext-fullwidth-image" src="../assets/images/pages/altruist-use-cases/altruist-use-cases-1.jpg" /></p>
      <p>Think of it as a little adventure: getting to know your city better. The top-priority reason to buy a home air-quality station is to gain solid knowledge of what is happening indoors and outside throughout the year so you can adapt accordingly.</p>
      <p>There’s always something to worry about, but it’s best not to let the extremes—“nothing is happening” vs. “everything is definitely bad”—take root. After seven years working with citizen air-quality monitoring around the world, we can assure you that personal, quantitative monitoring shows the real situation right where you live. After a year with Altruist you will see, in clear graphs with insights from the developers, how air quality varies by time of day, season, the operation of waste-incineration plants, industrial sites, power stations, seasonal fires, dust storms… and you’ll form an objective view of what is happening right outside your window—and adapt to it.</p>
      
      <details class="details-link">
        <summary>Altruist features for urban conditions</summary>
        <ul>
          <li><b>Street-grade particle sensor</b> — tough enough to hang outside yet still fine indoors. If you mount Altruist Urban outside your window it won’t “choke” after the first sand truck rumbles past.</li>
          <li><b>Outdoor noise measurement</b> — Altruist is currently the only product in its class that adds a city-grade noise sensor, covering another important urban factor.</li>
        </ul>
      </details>
    </section>

    <section>
      <h2>🤧🌿 You or your loved ones have allergies or bronchial asthma</h2>
      <p><img alt="" class="pagetext-fullwidth-image" src="../assets/images/pages/altruist-use-cases/altruist-use-cases-2.jpg" /></p>
      <p>Some of Altruist’s developers suffer from house-dust allergy; one of us spent childhood in hospital every few weeks with asthma attacks. Life is harder for such people, so it is especially important to help them control indoor air quality.</p>
      
      <details class="details-link">
        <summary>How Altruist helps allergy and asthma sufferers</summary>
        <ul>
          <li><b>Room profiling</b> for particulate matter and humidity: in the first week you will get 24-hour snapshots with highlighted insights—graphs that let you compare rooms instead of staring at bare numbers.</li>
          <li><b>Ventilation hints</b> an Altruist on the balcony or even on a windowsill will warn you when outdoor air is bad so you can close the windows, turn on the purifier and postpone walks until traffic or a dust storm subsides.</li>
          <li><b>Children’s rooms</b> place a unit there to spot dust problems early and reduce the risk of developing dust allergy.</li>
        </ul>
      </details>
    </section>

    <section>
      <h2>🛠️🏠 You are building a smart home</h2>
      <p><img alt="" class="pagetext-fullwidth-image" src="../assets/images/pages/altruist-use-cases/altruist-use-cases-3.jpg" /></p>
      <p>Most of our team are engineers who automate their homes. We provide an official integration in Home Assistant Store so you can add Altruist to your local smart-home setup in two clicks, plus ready-made automation blueprints that need no coding.</p>
      
      <details class="details-link">
        <summary>How Altruist is useful for a DIY smart-home engineer</summary>
        <ul>
          <li><b>RGB lamp indicator</b> — link any parameter to a smart bulb so your room quietly signals changes (no need to turn the whole living-room red just because Grandpa lights his pipe on the balcony).</li>
          <li><b>Air-purifier trigger</b> — start a purifier inside whenever the outdoor unit detects smoke or dust.</li>
          <li><b>Air-conditioner control</b> — react automatically to rising outdoor humidity or temperature at dawn.</li>
        </ul>
      </details>
    </section>

    <section>
      <h2>🕵️‍♂️📈 You like to support community initiatives independent of governments and corporations</h2>
      <p><img alt="" class="pagetext-fullwidth-image" src="../assets/images/pages/altruist-use-cases/altruist-use-cases-4.jpg" /></p>
      <p>Become a data source and join other Altruists to build a citizen network monitoring environmental issues in your region. The developers have open-sourced the entire sensors.social backend so local communities can launch an independent sensor map.</p>

      <details class="details-link">
        <summary>How Altruist helps independent monitoring</summary>
        <ul>
          <li><b>Trusted hardware</b> — open-source and field-tested by thousands of users, easy to recommend to neighbours.</li>
          <li><b>Your own map in one day</b> — clone the GitHub repo, deploy on any domain and run a fully independent service that even the Altruist developers can’t interfere with.</li>
        </ul>
      </details>
    </section>

    <section class="pagetext-highlight">
      <p>The most fascinating lesson from seven years of experiments is the sheer diversity of motives, methods and analysis styles in environmental monitoring—from health concerns to activism, from outdated test tubes to high-end sampling stations, from smiley-faces to daily graphs. It all makes the task far more complex than it first appears, but we hope our team’s perspective embodied in Altruist and sensors.social will delight you and give you a useful tool for adapting to your environment.</p>
    </section>

    <AltruistCompare />

    <AltruistPromo utmMedium="altruist-use-cases" />

  </section>
</template>


<script setup>
import {ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import Header from '../components/header/Header.vue';
import MetaInfo from '../components/MetaInfo.vue';
import AltruistPromo from "../components/devices/altruist/AltruistPromo.vue";
import AltruistCompare from "../components/devices/altruist/AltruistCompare.vue";

// i18n support
const { locale } = useI18n();
const currentLocale = ref(locale.value);

const ogImage = new URL('@/assets/images/pages/altruist-use-cases/altruist-use-cases-all.jpg', import.meta.url).href

// reactively update locale when changed
watch(locale, (newLocale) => {
  currentLocale.value = newLocale;
});

</script>
