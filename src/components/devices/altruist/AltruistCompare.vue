<template>
  <div class="comparison-wrapper">
    <h2 class="table-title">Air Sensor Comparison Table</h2>
    <div class="table-container">
      <table class="comparison-table">
        <thead>
          <tr>
            <th class="comparison-table__thead-title">Air quality sensor</th>
            <th>
              <div class="sensor-header">
                <img src="../../../assets/images/pages/altruist-use-cases/table/altruist-device.png" alt="Altruist Device" class="device-photo" />
                <span class="sensor-name">Altruist Urban & Insight</span>
              </div>
            </th>
            <th>
              <div class="sensor-header">
                <img src="../../../assets/images/pages/altruist-use-cases/table/purpleAir-device.png" alt="PurpleAir Device" class="device-photo" />
                <span class="sensor-name">PurpleAir Zen</span>
              </div>
            </th>
            <th>
              <div class="sensor-header">
                <img src="../../../assets/images/pages/altruist-use-cases/table/airGradient-device.png" alt="AirGradient Device" class="device-photo" />
                <span class="sensor-name">AirGradient Indoor & Outdoor</span>
              </div>
            </th>
            <th>
              <div class="sensor-header">
                <img src="../../../assets/images/pages/altruist-use-cases/table/netatmo-device.webp" alt="Netatmo Device" class="device-photo" />
                <span class="sensor-name">Netatmo</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in tableData" :key="index" :class="index % 2 === 0 ? 'even-row' : 'odd-row'">
            <th>{{ row.feature }}</th>
            <td v-for="(value, i) in [row.altruist, row.purpleair, row.airgradient, row.netatmo]" :key="i">
              <span :class="highlightClass(value)">{{ formatValue(value) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
const tableData = [
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
]

const highlightClass = (value) => {
  if (value.trim().toLowerCase() === 'yes') return 'yes-value'
  if (value.trim().toLowerCase() === 'no') return 'no-value'
  return ''
}

const formatValue = (value) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'yes') return '✅ Yes'
  if (trimmed === 'no') return '❌ No'
  return value
}
</script>

<style scoped>
.yes-value {
  color: #2e7d32;
  font-weight: 600;
}

.no-value {
  color: #c62828;
  font-weight: 600;
}

.even-row {
  background-color: var(--app-tablerow);
}

.odd-row {
  background-color: var(--app-tablebody);
}

.table-title {
  text-align: center;
  color: var(--app-textcolor);
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
}

.table-container {
  overflow-x: auto;
}

.comparison-table {
  width: 99%;
  border-collapse: collapse;
  min-width: 800px;
  background: var(--app-tablebody);
  border: 1px solid #ddd;
}

.comparison-table thead {
  background: var(--app-tablebody);
  color: #000;
}

.comparison-table thead th {
  text-align: center;
  vertical-align: bottom;
  padding: 1rem 0.5rem;
}

.comparison-table th,
.comparison-table td,
.comparison-table__thead-title {
  padding: 0.8rem 1rem;
  border: 1px solid var(--app-tableborder);
  text-align: left;
  vertical-align: top;
}

.comparison-table th:first-child {
  background-color: var(--app-tablebody);
  color: var(--app-textcolor);
  font-weight: 600;
  min-width: 180px;
}

.sensor-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  gap: 0.4rem;
  text-align: center;
  max-width: 120px;
  margin: 0 auto;
}

.sensor-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--app-textcolor);
  line-height: 1.2;
}

.device-photo {
  max-width: 130px;
  height: auto;
  display: block;
  transition: transform 0.3s ease;
}

.device-photo:hover {
  transform: scale(1.05);
}

.device-image-row td {
  padding: 1rem 0.5rem;
  vertical-align: middle;
  background-color: var(--app-tablebody);
}

@media screen and (max-width: 768px) {
  .table-title {
    font-size: 1.4rem;
  }

  .comparison-table th {
    font-size: 1.2rem;
  }

  .comparison-table tr td span {
    font-size: 0.85rem;
  }

  .sensor-icon {
    max-width: 60px;
  }
}

</style>