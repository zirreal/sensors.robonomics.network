<template>
  <section>
    <h2>Air Sensor Comparison Table</h2>
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th v-for="(device, i) in deviceHeaders" :key="'name-' + i">
            {{ device.name }}
          </th>
        </tr>
        <tr>
          <th>Photo</th>
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
import { ref, onMounted, onUnmounted } from 'vue'

import altruistImg from '@/assets/images/altruist-device/Altruist-bundle.webp'
import purpleAirImg from '@/assets/images/compare-table/purpleAir-device.webp'
import airGradientImg from '@/assets/images/compare-table/airGradient-device.webp'
import netatmoImg from '@/assets/images/compare-table/netatmo-device.webp'
import airVisualImg from '@/assets/images/compare-table/airvisual-device.webp'

const deviceHeaders = [
  { name: "Altruist Urban & Insight", img: altruistImg },
  { name: "PurpleAir Zen", img: purpleAirImg },
  { name: "AirGradient Indoor & Outdoor", img: airGradientImg },
  { name: "Netatmo Weather Station", img: netatmoImg },
  { name: "AirVisual Pro & Outdoor", img: airVisualImg },
]

const priceLinks = [
  'https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight/coming_soon?utm_source=sensors.social&utm_medium=compare',
  'https://www2.purpleair.com/products/purpleair-zen',
  'https://www.airgradient.com',
  'https://www.netatmo.com/en-gb/weather-station-original-sand',
  'https://www.iqair.com/us/air-quality-monitors',
]

const tableData = [
  {
    feature: 'Price',
    altruist: { value: '€189 ($221)', mark: ' ' },
    purpleair: { value: '€254 ($299)', mark: ' ' },
    airgradient: { value: '€328 ($385)', mark: ' ' },
    netatmo: { value: '€152 ($179)', mark: ' ' },
    airvisual: { value: '€638 ($748)', mark: ' ' }
  },
  {
    feature: 'Type',
    altruist: { value: 'Dual-module, outdoor and indoor', mark: ' ' },
    purpleair: { value: 'Can be outdoor or indoor', mark: ' ' },
    airgradient: { value: 'Two separate modules', mark: ' ' },
    netatmo: { value: 'Dual-module, outdoor and indoor', mark: ' ' },
    airvisual: { value: 'Two separate modules', mark: ' ' }
  },
  {
    feature: 'Particle Sensor',
    altruist: { value: 'Yes', mark: 'good' },
    purpleair: { value: 'Yes', mark: 'good' },
    airgradient: { value: 'Yes', mark: 'good' },
    netatmo: { value: 'No', mark: 'bad' },
    airvisual: { value: 'Yes', mark: 'good' }
  },
  {
    feature: 'Urban Noise Sensor',
    altruist: { value: 'Yes', mark: 'good' },
    purpleair: { value: 'No', mark: 'bad' },
    airgradient: { value: 'No', mark: 'bad' },
    netatmo: { value: 'Only indoor', mark: 'neutral' },
    airvisual: { value: 'No', mark: 'bad' }
  },
  {
    feature: 'Indoor CO2',
    altruist: { value: 'Yes', mark: 'good' },
    purpleair: { value: 'No', mark: 'bad' },
    airgradient: { value: 'Yes', mark: 'good' },
    netatmo: { value: 'Yes', mark: 'good' },
    airvisual: { value: 'Yes', mark: 'good' }
  },
  {
    feature: 'User Interface on Device',
    altruist: { value: 'LED indication on Urban + E-ink screen on Insight', mark: 'neutral' },
    purpleair: { value: 'Only LED strip', mark: 'neutral' },
    airgradient: { value: 'LED indication and small screen on Indoor', mark: 'neutral' },
    netatmo: { value: 'Only LED strip', mark: 'neutral' },
    airvisual: { value: 'LED indication on Outdoor and LCD screen on Pro', mark: 'neutral' }
  },
  {
    feature: 'microSD Support',
    altruist: { value: 'Yes', mark: 'good' },
    purpleair: { value: 'Yes', mark: 'good' },
    airgradient: { value: 'No', mark: 'bad' },
    netatmo: { value: 'No', mark: 'bad' },
    airvisual: { value: 'No', mark: 'bad' }
  },
  {
    feature: 'Power Connector',
    altruist: { value: 'USB Type-C', mark: 'good' },
    purpleair: { value: 'Micro USB', mark: 'bad' },
    airgradient: { value: 'USB Type-C', mark: 'good' },
    netatmo: { value: 'Micro USB', mark: 'bad' },
    airvisual: { value: 'Micro USB on Pro & Ethernet PoE on Outdoor', mark: 'neutral' }
  },
  {
    feature: 'Housing',
    altruist: { value: '3D printed, different colors and icons', mark: 'good' },
    purpleair: { value: 'Only one color available', mark: 'bad' },
    airgradient: { value: 'Only one color available', mark: 'bad' },
    netatmo: { value: 'Only one color available', mark: 'bad' },
    airvisual: { value: 'Only one color available', mark: 'bad' }
  },
  {
    feature: 'Water Protection',
    altruist: { value: 'Fully sealed housing, air supply tube', mark: 'good' },
    purpleair: { value: 'Unprotected open bottom of the sensor', mark: 'bad' },
    airgradient: { value: 'Fully sealed housing', mark: 'good' },
    netatmo: { value: 'Fully sealed housing', mark: 'good' },
    airvisual: { value: 'Fully sealed housing', mark: 'good' }
  },
  {
    feature: 'UV Protection',
    altruist: { value: 'Protective shield made of ASA plastic', mark: 'good' },
    purpleair: { value: 'Not specified', mark: 'bad' },
    airgradient: { value: 'Housing is made of ASA plastic', mark: 'good' },
    netatmo: { value: 'Not specified', mark: 'bad' },
    airvisual: { value: 'Yes', mark: 'good' }
  },
  {
    feature: 'Mandatory Cloud Connection',
    altruist: { value: 'No', mark: 'good' },
    purpleair: { value: 'Yes', mark: 'bad' },
    airgradient: { value: 'No', mark: 'good' },
    netatmo: { value: 'Yes', mark: 'bad' },
    airvisual: { value: 'Yes', mark: 'bad' }
  },
  {
    feature: 'Local Device Management via IP',
    altruist: { value: 'Full control over settings', mark: 'good' },
    purpleair: { value: 'Most functions are not available, settings only via corporate cloud', mark: 'bad' },
    airgradient: { value: 'No, but available via Home Assistant', mark: 'neutral' },
    netatmo: { value: 'No, only in the app', mark: 'bad' },
    airvisual: { value: 'No, only in the app', mark: 'bad' }
  },
  {
    feature: 'Online Air Quality Map by Community',
    altruist: { value: 'Yes, optional', mark: 'good' },
    purpleair: { value: 'Yes, main entry point to view data', mark: 'good' },
    airgradient: { value: 'Yes, optional', mark: 'good' },
    netatmo: { value: 'Yes, optional', mark: 'good' },
    airvisual: { value: 'Yes, optional ', mark: 'good' }
  },
  {
    feature: 'Home Assistant Integration',
    altruist: { value: 'Yes, only the HA addon is needed', mark: 'good' },
    purpleair: { value: 'Yes, but limited API and cloud connection are required', mark: 'bad' },
    airgradient: { value: 'Yes, only the HA addon is needed', mark: 'good' },
    netatmo: { value: 'Yes, only the HA addon is needed', mark: 'good' },
    airvisual: { value: 'Yes, but only for Pro', mark: 'bad' }
  },
  {
    feature: 'Data Control and Ownership',
    altruist: { value: 'The user owns the data and controls its distribution', mark: 'good' },
    purpleair: { value: 'The company owns the data, but users can view and export it with some limitations', mark: 'bad' },
    airgradient: { value: 'The user owns the data and controls its distribution', mark: 'good' },
    netatmo: { value: "Officially owned by users, but they must consent to the company's use of their data", mark: 'bad' },
    airvisual: { value: "Officially owned by users, but they must consent to the company's use of their data", mark: 'bad' }
  },
  {
    feature: 'Open Source and Hardware',
    altruist: { value: 'Yes', mark: 'good' },
    purpleair: { value: 'No', mark: 'bad' },
    airgradient: { value: 'Yes', mark: 'good' },
    netatmo: { value: 'No', mark: 'bad' },
    airvisual: { value: 'No', mark: 'bad' }
  },
  {
    feature: 'Custom Firmware and DIY-mods',
    altruist: { value: 'Yes', mark: 'good' },
    purpleair: { value: 'No', mark: 'bad' },
    airgradient: { value: 'Yes', mark: 'good' },
    netatmo: { value: 'No', mark: 'bad' },
    airvisual: { value: 'No', mark: 'bad' }
  }
];

const formatValue = (valObj) => valObj?.value || '';
const getMarkClass = (mark) => mark?.trim() ? `mark-${mark}` : '';

const isMobile = ref(window.innerWidth < 1000);

const updateMobile = () => { 
  isMobile.value = window.innerWidth < 1000
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
</style>
