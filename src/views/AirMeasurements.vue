<template>
  <MetaInfo
    :pageTitle= "$t('Air quality measurements information')"
    :pageDescription="$t('Sensors.social Air Quality Map — an interactive tool for viewing, analyzing, and comparing real-time air quality data from sensors. Get up-to-date information on air conditions in your area.')"
    :pageImage = "ogImage"
  />
  <PageTextLayout>
    <h1>{{ $t("measures.title") }}</h1>

    <section v-for="(measurement, key) in measurements" :key="key" :id="key.toUpperCase()">

      <template v-if="measurement?.nameshort && measurement?.description && measurement?.description !== ''">

        <h2>
          {{ measurement?.nameshort?.[locale] }}
          <span v-if="measurement.name?.[locale] && measurement.name?.[locale] !== measurement?.nameshort?.[locale]">{{ measurement.name?.[locale] }}</span>
        </h2>

        <div v-if="measurement?.zones" class="measures">
          <div v-for="(zone, index) in measurement.zones" :key="index" :style="{ backgroundColor: zone.color }">
            <b>
            {{ zone.label[locale] ? zone.label[locale] : zone.label.en }}
            </b>
            <span v-if="zone.value">{{ $t("scales.upto")}}  {{ zone.value }} {{ measurement.unit }}</span>
            <span v-else>{{ $t("scales.above") }}</span>
          </div>
        </div>

        <template v-if="measurement?.description && Array.isArray(measurement?.description)">
          <template v-for="(block, idx) in measurement.description" :key="idx">

            <h4 v-if="block.tag === 'subtitle'">
              {{ block.text?.[locale] ?? block.text?.en }}
            </h4>

            <p v-if="block.tag === 'p'">
              {{ block.text?.[locale] ?? block.text?.en }}
            </p>

            <ul v-else-if="block.tag === 'ul'">
              <li v-for="(item, i) in block.items?.[locale] ?? block.items?.en" :key="i">
                {{ item }}
              </li>
            </ul>
          </template>
        </template>

      </template>
    </section>

  </PageTextLayout>
</template>


<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import PageTextLayout from "../components/layouts/PageText.vue";
import MetaInfo from '../components/MetaInfo.vue';
import measurements from '../measurements';

import ogImage from '../assets/images/pages/air-measurements/og-air-measurements.webp';

const { locale } = useI18n();
const currentLocale = ref(locale.value);

watch(locale, (newLocale) => {
  currentLocale.value = newLocale;
});
</script>


<style scoped>
h2 span {
  font-size: 60%;
  display: block;
}

.measures {
  --font-size: 1rem;
  --gap: 1rem;

  display: flex;
  gap: var(--gap);
  margin-bottom: var(--gap);
}

.measures div {
  color: #fff;
  padding: var(--gap) calc(var(--gap) * 2);
}

.measures span {
  display: block;
}


.air-measurements ol {
  padding-left: calc(var(--gap) * 1.5);
  margin-bottom: calc(var(--gap) * 0.5);
}

.air-measurements ul li {
  width: 100%;
  padding: calc(var(--gap) * 0.5) calc(var(--gap) * 0.9);
  color: var(--color-light);
  font-weight: 900;
}

.air-measurements .green {
  background-color: var(--color-green);
}
.air-measurements .blue {
  background-color: var(--color-teal);
}
.air-measurements .navy {
  background-color: var(--color-navy);
}
.air-measurements .orange {
  background-color: var(--color-orange);
}
.air-measurements .red {
  background-color: var(--color-bright-red);
}
.air-measurements .purple {
  background-color: var(--color-purple);
}

@media (width < 860px) {
  .measures {
    display: grid;
    grid-template-rows: 1;
  }
}
</style>
