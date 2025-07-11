<template>
  <Header />
  <section class="air-measurements container-pagetext">
    <h1>{{ $t("measures.title") }}</h1>

    <div
      v-for="(measurement, key) in measurements"
      :key="key"
      :id="key.toUpperCase()"
    >
    <div v-if="measurement.zones"       class="air-measurements__wrapper">
      <div class="air-measurements__header">
        <h2 class="air-measurements__subtitle">
          {{ measurement.nameshort?.[locale] || measurement.label }}
        </h2>
        <p class="air-measurements__descr">
          {{ measurement.name?.[locale] || measurement.label }}
        </p>
        <p
          v-if="$t(`measures.${measurement.label}`) !== `measures.${measurement.label}`"
          class="air-measurements__descr"
        >
          {{ $t(`measures.${measurement.label}`) }}
        </p>
      </div>

      <div v-if="measurement.zones && measurement.zones.length" class="air-measurements__content">
        <ul>
          <li
            v-for="(zone, index) in measurement.zones"
            :key="index"
            :style="{ backgroundColor: zone.color }"
          >
            <b>
            {{ zone.label[locale] ? zone.label[locale] : zone.label.en }}
            </b>
            (<template v-if="zone.value">{{ $t("scales.upto")}}  {{ zone.value }} {{ measurement.unit }}</template>
            <template v-else>{{ $t("scales.above") }}</template
            >)
          </li>
        </ul>
        <div
          class="air-measurements__recs"
          v-if="measurement.recommendations && measurement.recommendations.length"
        >
          <template
            v-for="(recGroup, recGroupIndex) in measurement.recommendations"
            :key="recGroupIndex"
          >
            <template
              v-for="(value, fieldKey, index) in recGroup"
              :key="fieldKey"
            >
              <template v-if="fieldKey.includes(measurement.label.toUpperCase().replace('.', ''))">
                <p v-if="fieldKey.toLowerCase().includes('text')">
                  {{
                    $t(`measures.${fieldKey}`) !== `measures.${fieldKey}`
                      ? $t(`measures.${fieldKey}`)
                      : value
                  }}
                </p>

                <ol
                  v-else-if="Array.isArray(value)"
                  :class="{ mb: shouldAddMargin(recGroup, measurement.label, index) }"
                >
                  <li
                    v-for="(item, i) in value"
                    :key="i"
                  >
                    {{
                      $t(`measures.${fieldKey}.${i + 1}`) !== `measures.${fieldKey}.${i + 1}`
                        ? $t(`measures.${fieldKey}.${i + 1}`)
                        : item
                    }}
                  </li>
                </ol>
              </template>
            </template>
          </template>
        </div>
      </div>
    </div>
    </div>
  </section>
</template>


<script setup>
import {ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import Header from '../components/header/Header.vue';
import measurements from '../measurements';

// i18n support
const { locale } = useI18n();
const currentLocale = ref(locale.value);

// reactively update locale when changed
watch(locale, (newLocale) => {
  currentLocale.value = newLocale;
});

const shouldAddMargin = (recGroup, label, currentIndex) => {
  const labelKey = label.toUpperCase();
  const arrayKeys = Object.keys(recGroup).filter(
    (key) => key.includes(labelKey) && Array.isArray(recGroup[key])
  );
  return arrayKeys.length > 1 && currentIndex < arrayKeys.length * 2 - 1;
};

</script>


<style scoped>
header {
  width: 99vw;
}

.mb {
  margin-bottom: calc(var(--gap) * 2) !important;
}

.air-measurements__header p {
  font-size: calc(var(--font-size) * 0.9);
  font-weight: 500;
  line-height: 1.7;
}

.air-measurements__wrapper:not(:last-of-type) {
  margin-bottom: 5rem;
}

.air-measurements__header {
  max-width: 800px;
  margin: 0 auto;
  margin-bottom: calc(var(--gap) * 2);
}

.air-measurements__content {
  display: grid;
  grid-template-columns: 350px 630px;
  justify-content: center;
  gap: calc(var(--gap) * 2);
  font-weight: 500;
}

.air-measurements__recs {
  font-size: calc(var(--font-size) * 0.9);
}

.air-measurements ol {
  padding-left: calc(var(--gap) * 1.5);
  margin-bottom: calc(var(--gap) * 0.5);
}

.air-measurements ul li {
  width: 100%;
  padding: calc(var(--gap) * 0.5) calc(var(--gap) * 0.9);
  color: var(--color-light);
  font-size: calc(var(--font-size) * 0.8);
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

@media screen and (max-width: 880px) {
  .air-measurements__content {
    grid-template-columns: 1fr;
    gap: var(--gap);
  }
}
</style>
