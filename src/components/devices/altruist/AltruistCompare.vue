<template>
  <section>
    <h2>Air Sensor Comparison Table</h2>
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th v-for="(device, i) in deviceHeaders" :key="i">
            <p>{{ device.name }}</p>
            <img :src="device.img" :alt="device.name + ' device'" class="device-photo" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, rowIndex) in tableData"
          :key="rowIndex"
        >

          <td>{{ row.feature }}</td>

          <td
            v-for="(value, i) in [row.altruist, row.purpleair, row.airgradient, row.netatmo]"
            :key="i"
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
import purpleAirImg from '@/assets/images/compare-table/purpleAir-device.png'
import airGradientImg from '@/assets/images/compare-table/airGradient-device.png'
import netatmoImg from '@/assets/images/compare-table/netatmo-device.png'

const deviceHeaders = [
  { name: "Altruist Urban & Insight", img: altruistImg },
  { name: "PurpleAir Zen", img: purpleAirImg },
  { name: "AirGradient Indoor & Outdoor", img: airGradientImg },
  { name: "Netatmo Weather Station", img: netatmoImg },
];

const priceLinks = [
  'https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight/coming_soon?utm_source=sensors.social&utm_medium=compare',
  'https://www2.purpleair.com/products/purpleair-zen',
  'https://www.airgradient.com',
  'https://www.netatmo.com/en-gb/weather-station-original-sand',
]

const tableData = [
  { feature: 'Price', altruist: '€189', purpleair: '$299', airgradient: '$385', netatmo: '£149.99' },
  { feature: 'Type', altruist: 'Dual-module, outdoor and indoor', purpleair: 'Can be outdoor or indoor', airgradient: 'Two separate modules', netatmo: 'Dual-module, outdoor and indoor' },
  { feature: 'Urban Noise Sensor', altruist: 'Yes', purpleair: 'No', airgradient: 'No', netatmo: 'Only indoor' },
  { feature: 'Indoor CO2', altruist: 'Yes', purpleair: 'No', airgradient: 'Yes', netatmo: 'Yes' },
  { feature: 'User Interface on Device', altruist: 'LED indication on Urban + E-ink screen on Insight', purpleair: 'Only LED strip', airgradient: 'LED indication and small screen on Indoor', netatmo: 'Only LED strip' },
  { feature: 'microSD Support', altruist: 'Yes', purpleair: 'Yes', airgradient: 'No', netatmo: 'No' },
  { feature: 'Power Connector', altruist: 'USB Type-C', purpleair: 'Micro USB', airgradient: 'USB Type-C', netatmo: 'Micro USB' },
  { feature: 'Housing', altruist: '3D printed, different colors and icons', purpleair: 'Only one color available', airgradient: 'Only one color available', netatmo: 'Only one color available' },
  { feature: 'Water Protection', altruist: 'Fully sealed housing, air supply tube', purpleair: 'Unprotected open bottom of the sensor', airgradient: 'Fully sealed housing', netatmo: 'Fully sealed housing' },
  { feature: 'UV Protection', altruist: 'Protective shield made of ASA plastic', purpleair: 'Not specified', airgradient: 'Housing is made of ASA plastic', netatmo: 'Not specified' },
  { feature: 'Mandatory Cloud Connection', altruist: 'No', purpleair: 'Yes', airgradient: 'No', netatmo: 'Yes' },
  { feature: 'Local Device Management via IP', altruist: 'Full control over settings', purpleair: 'Most functions are not available, settings only via corporate cloud', airgradient: 'No, but available via Home Assistant', netatmo: 'No, only in app' },
  { feature: 'Online Air Quality Map by Community', altruist: 'Yes, optional', purpleair: 'Yes, main entry point to view data', airgradient: 'Yes, optional', netatmo: 'Yes, optional' },
  { feature: 'Home Assistant Integration', altruist: 'Yes, only the HA addon is needed', purpleair: 'Yes, but limited API and cloud connection are required', airgradient: 'Yes, only the HA addon is needed', netatmo: 'Yes, only the HA addon is needed' },
  { feature: 'Data Control and Ownership', altruist: 'User owns data and controls where it goes', purpleair: 'Data is owned by company; users can view/export data with restrictions', airgradient: 'User owns data and controls where it goes', netatmo: 'Formally belong to the users, but they are obliged to agree to data use by the company' },
  { feature: 'Open Source and Hardware', altruist: 'Yes', purpleair: 'No', airgradient: 'Yes', netatmo: 'No' },
  { feature: 'Custom Firmware and DIY-mods', altruist: 'Yes', purpleair: 'No', airgradient: 'Yes', netatmo: 'No' },
];

const highlightClass = (value) => {
  if (value.trim().toLowerCase() === 'yes') return 'yes-value'
  if (value.trim().toLowerCase() === 'no') return 'no-value'
  return ''
}

const formatValue = (value) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'yes') return 'Yes'
  if (trimmed === 'no') return 'No'
  return value
}

// Responsive flag for mobile/desktop
const isMobile = ref(window.innerWidth < 1000)
const updateMobile = () => { isMobile.value = window.innerWidth < 1000 }
onMounted(() => window.addEventListener('resize', updateMobile))
onUnmounted(() => window.removeEventListener('resize', updateMobile))
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

th:not(:first-child) {
  text-align: center;
}

h2 {
  position: sticky;
  top: 0;
  background-color: var(--app-bodybg);
  z-index: 1000;
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
    border-bottom: 2px solid var(--app-bordercolor);
  }
  td {
    position: relative;
    min-height: 40px;
    border: none;
    border-bottom: 1px solid var(--app-bordercolor);
    text-align: center !important;
  }
  .device-photo {
    display: none;
  }
  td:first-child {
    font-weight: 900;
    text-transform: uppercase;
    border-bottom: 0;
    padding-bottom: 0;
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
