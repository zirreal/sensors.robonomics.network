<template>
  <section>
    <h2>{{ $t('Air Sensor Comparison Table') }}</h2>

    <img alt="" src="@/assets/images/pages/altruist-compare/compare-stand.gif" v-if="gif" class="gif" />

    <table>
      <thead>
        <tr>
          <th>{{$t('Model')}}</th>
          <th v-for="(device, i) in deviceHeaders" :key="'name-' + i">
            {{ device.name }}
          </th>
        </tr>
        <tr>
          <th>{{ $t('Photo') }}</th>
          <th v-for="(device, i) in deviceHeaders" :key="'img-' + i">
            <img :src="device.img" :alt="device.name + ' device'" class="device-photo" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
          <td>{{ row.feature }}</td>
          <td
            v-for="(value, i) in [row.altruist, row.purpleair, row.airgradient, row.netatmo, row.airvisual]"
            :key="i"
            :class="getMarkClass(value.mark)"
          >
            <template v-if="isMobile">
              <div class="device-mobile-label">
                <img :src="deviceHeaders[i].img" :alt="deviceHeaders[i].name" class="device-label-img" />
                <span class="device-label-title">{{ deviceHeaders[i].name }}</span>
              </div>
            </template>

            <template v-if="row.feature === 'Price'">
              <a :href="priceLinks[i]" target="_blank"><b>{{ formatValue(value) }}</b></a>
            </template>
            <template v-else>
              {{ formatValue(value) }}
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

import altruistImg from '@/assets/images/altruist-device/Altruist-bundle.webp';
import purpleAirImg from '@/assets/images/compare-table/purpleAir-device.webp';
import airGradientImg from '@/assets/images/compare-table/airGradient-device.webp';
import netatmoImg from '@/assets/images/compare-table/netatmo-device.webp';
import airVisualImg from '@/assets/images/compare-table/airvisual-device.webp';

import { useI18n } from 'vue-i18n';
const { t: $t } = useI18n();

const props = defineProps({
  gif: { type: Boolean, default: false }
});



const deviceHeaders = [
  { name: $t("Altruist Urban & Insight"), img: altruistImg },
  { name: $t("PurpleAir Zen"), img: purpleAirImg },
  { name: $t("AirGradient Indoor & Outdoor"), img: airGradientImg },
  { name: $t("Netatmo Weather Station"), img: netatmoImg },
  { name: $t("AirVisual Pro & Outdoor"), img: airVisualImg },
];

const priceLinks = [
  'https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight/coming_soon?utm_source=sensors.social&utm_medium=compare',
  'https://www2.purpleair.com/products/purpleair-zen',
  'https://www.airgradient.com',
  'https://www.netatmo.com/en-gb/weather-station-original-sand',
  'https://www.iqair.com/us/air-quality-monitors',
];

const tableData = [
  {
    feature: $t('Price'),
    altruist: { value: '€189 ($221)', mark: ' ' },
    purpleair: { value: '€254 ($299)', mark: ' ' },
    airgradient: { value: '€328 ($385)', mark: ' ' },
    netatmo: { value: '€152 ($179)', mark: ' ' },
    airvisual: { value: '€638 ($748)', mark: ' ' }
  },
  {
    feature: $t('Type'),
    altruist: { value: $t('Dual-module, outdoor and indoor'), mark: ' ' },
    purpleair: { value: $t('Can be outdoor or indoor'), mark: ' ' },
    airgradient: { value: $t('Two separate modules'), mark: ' ' },
    netatmo: { value: $t('Dual-module, outdoor and indoor'), mark: ' ' },
    airvisual: { value: $t('Two separate modules'), mark: ' ' }
  },
  {
    feature: $t('Particle Sensor'),
    altruist: { value: $t('Yes'), mark: 'good' },
    purpleair: { value: $t('Yes'), mark: 'good' },
    airgradient: { value: $t('Yes'), mark: 'good' },
    netatmo: { value: $t('No'), mark: 'bad' },
    airvisual: { value: $t('Yes'), mark: 'good' }
  },
  {
    feature: $t('Urban Noise Sensor'),
    altruist: { value: $t('Yes'), mark: 'good' },
    purpleair: { value: $t('No'), mark: 'bad' },
    airgradient: { value: $t('No'), mark: 'bad' },
    netatmo: { value: $t('Only indoor'), mark: 'neutral' },
    airvisual: { value: $t('No'), mark: 'bad' }
  },
  {
    feature: $t('Indoor CO2'),
    altruist: { value: $t('Yes'), mark: 'good' },
    purpleair: { value: $t('No'), mark: 'bad' },
    airgradient: { value: $t('Yes'), mark: 'good' },
    netatmo: { value: $t('Yes'), mark: 'good' },
    airvisual: { value: $t('Yes'), mark: 'good' }
  },
  {
    feature: $t('User Interface on Device'),
    altruist: { value: $t('LED indication on Urban + E-ink screen on Insight'), mark: 'neutral' },
    purpleair: { value: $t('Only LED strip'), mark: 'neutral' },
    airgradient: { value: $t('LED indication and small screen on Indoor'), mark: 'neutral' },
    netatmo: { value: $t('Only LED strip'), mark: 'neutral' },
    airvisual: { value: $t('LED indication on Outdoor and LCD screen on Pro'), mark: 'neutral' }
  },
  {
    feature: $t('microSD Support'),
    altruist: { value: $t('Yes'), mark: 'good' },
    purpleair: { value: $t('Yes'), mark: 'good' },
    airgradient: { value: $t('No'), mark: 'bad' },
    netatmo: { value: $t('No'), mark: 'bad' },
    airvisual: { value: $t('No'), mark: 'bad' }
  },
  {
    feature: $t('Power Connector'),
    altruist: { value: $t('USB Type-C'), mark: 'good' },
    purpleair: { value: $t('Micro USB'), mark: 'bad' },
    airgradient: { value: $t('USB Type-C'), mark: 'good' },
    netatmo: { value: $t('Micro USB'), mark: 'bad' },
    airvisual: { value: $t('Micro USB on Pro & Ethernet PoE on Outdoor'), mark: 'neutral' }
  },
  {
    feature: $t('Housing'),
    altruist: { value: $t('3D printed, different colors and icons'), mark: 'good' },
    purpleair: { value: $t('Only one color available'), mark: 'bad' },
    airgradient: { value: $t('Only one color available'), mark: 'bad' },
    netatmo: { value: $t('Only one color available'), mark: 'bad' },
    airvisual: { value: $t('Only one color available'), mark: 'bad' }
  },
  {
    feature: $t('Water Protection'),
    altruist: { value: $t('Fully sealed housing, air supply tube'), mark: 'good' },
    purpleair: { value: $t('Unprotected open bottom of the sensor'), mark: 'bad' },
    airgradient: { value: $t('Fully sealed housing'), mark: 'good' },
    netatmo: { value: $t('Fully sealed housing'), mark: 'good' },
    airvisual: { value: $t('Fully sealed housing'), mark: 'good' }
  },
  {
    feature: $t('UV Protection'),
    altruist: { value: $t('Protective shield made of ASA plastic'), mark: 'good' },
    purpleair: { value: $t('Not specified'), mark: 'bad' },
    airgradient: { value: $t('Housing is made of ASA plastic'), mark: 'good' },
    netatmo: { value: $t('Not specified'), mark: 'bad' },
    airvisual: { value: $t('Yes'), mark: 'good' }
  },
  {
    feature: $t('Mandatory Cloud Connection'),
    altruist: { value: $t('No'), mark: 'good' },
    purpleair: { value: $t('Yes'), mark: 'bad' },
    airgradient: { value: $t('No'), mark: 'good' },
    netatmo: { value: $t('Yes'), mark: 'bad' },
    airvisual: { value: $t('Yes'), mark: 'bad' }
  },
  {
    feature: $t('Local Device Management via IP'),
    altruist: { value: $t('Full control over settings'), mark: 'good' },
    purpleair: { value: $t('Most functions are not available, settings only via corporate cloud'), mark: 'bad' },
    airgradient: { value: $t('No, but available via Home Assistant'), mark: 'neutral' },
    netatmo: { value: $t('No, only in the app'), mark: 'bad' },
    airvisual: { value: $t('No, only in the app'), mark: 'bad' }
  },
  {
    feature: $t('Online Air Quality Map by Community'),
    altruist: { value: $t('Yes, optional'), mark: 'good' },
    purpleair: { value: $t( 'Yes, main entry point to view data'), mark: 'good' },
    airgradient: { value: $t('Yes, optional'), mark: 'good' },
    netatmo: { value: $t('Yes, optional'), mark: 'good' },
    airvisual: { value: $t( 'Yes, optional'), mark: 'good' }
  },
  {
    feature: $t('Home Assistant Integration'),
    altruist: { value: $t('Yes, only the HA addon is needed'), mark: 'good' },
    purpleair: { value: $t('Yes, but limited API and cloud connection are required'), mark: 'bad' },
    airgradient: { value: $t( 'Yes, only the HA addon is needed'), mark: 'good' },
    netatmo: { value: $t('Yes, only the HA addon is needed'), mark: 'good' },
    airvisual: { value: $t('Yes, but only for Pro'), mark: 'bad' }
  },
  {
    feature: $t('Data Control and Ownership'),
    altruist: { value: $t('The user owns the data and controls its distribution'), mark: 'good' },
    purpleair: { value: $t('The company owns the data, but users can view and export it with some limitations'), mark: 'bad' },
    airgradient: { value: $t('The user owns the data and controls its distribution'), mark: 'good' },
    netatmo: { value: $t("Officially owned by users, but they must consent to the company's use of their data"), mark: 'bad' },
    airvisual: { value: $t("Officially owned by users, but they must consent to the company's use of their data"), mark: 'bad' }
  },
  {
    feature: $t('Open Source and Hardware'),
    altruist: { value: $t('Yes'), mark: 'good' },
    purpleair: { value: $t('No'), mark: 'bad' },
    airgradient: { value: $t( 'Yes'), mark: 'good' },
    netatmo: { value: $t('No'), mark: 'bad' },
    airvisual: { value: $t('No'), mark: 'bad' }
  },
  {
    feature: $t('Custom Firmware and DIY-mods'),
    altruist: { value: $t('Yes'), mark: 'good' },
    purpleair: { value: $t('No'), mark: 'bad' },
    airgradient: { value: $t('Yes'), mark: 'good' },
    netatmo: { value: $t('No'), mark: 'bad' },
    airvisual: { value: $t('No'), mark: 'bad' }
  }
];

const formatValue = (valObj) => valObj?.value || '';
const getMarkClass = (mark) => mark?.trim() ? `mark-${mark}` : '';

const isMobile = ref(window.innerWidth < 1000);

const updateMobile = () => { 
  isMobile.value = window.innerWidth < 1000;
}

onMounted(() => window.addEventListener('resize', updateMobile));
onUnmounted(() => window.removeEventListener('resize', updateMobile));

</script>

<style scoped>
.device-photo,
.device-label-img {
  display: inline-block;
  object-fit: contain;
}

.device-photo {
  max-width: 150px;
}

.device-label-img {
  max-width: 40px;
}

td:first-child {
  font-weight: bold;
}

th:first-child {
  min-width: 160px;
}

th:not(:first-child) {
  text-align: center;
}

h2 {
  position: sticky;
  top: 0;
  background-color: var(--app-bodybg);
  z-index: 1000;
}

.mark-good {
  background-color: #f3ffed;
}

.mark-bad {
  background-color: #ffefee;
}

.mark-neutral {
  background-color: #f1f1f1;
}

@media (prefers-color-scheme: dark) {

  .mark-good {
    background-color: #043107;
  }

  .mark-bad {
    background-color: #5f0f09;
  }

  .mark-neutral {
    background-color: #3f3f3f;
  }

}

@media (width > 1000px) {
  thead tr:first-child th {
    position: sticky;
    top: 3.5rem; /* чтобы не перекрывало h2 */
    background: var(--app-bodybg);
    z-index: 999;
  }
}

@media (width < 1000px) {
  table, thead, tbody, th, td, tr {
    display: block;
  }

  thead tr {
    display: none;
  }

  tr {
    margin-bottom: calc(var(--gap) * 2);
    /* border-bottom: 2px solid var(--app-bordercolor); */
  }

  td {
    position: relative;
    min-height: 40px;
    border: none;
    border-bottom: 1px solid var(--app-bordercolor);
    text-align: center !important;
  }

  td:first-child {
    font-weight: 900;
    text-transform: uppercase;
    border-bottom: 0;
  }

  td:last-child {
    border-bottom: 0;
  }

  .device-photo {
    display: none;
  }

  .device-mobile-label {
    display: flex;
    gap: calc(var(--gap) / 2);
    align-items: center;
    justify-content: center;
    font-weight: bold;
    margin-bottom: calc(var(--gap) / 2);
  }

  tbody tr:last-child td,
  tfoot tr:last-child td {
    border-bottom-width: 1px;
  }
}
.gif {
  display: block;
  width: 100%;
  margin-bottom: calc(var(--gap) * 2);
}
</style>
