<template>
  <div class="comparison-wrapper">
    <h2 class="table-title">Air Sensor Comparison Table</h2>
    <div class="table-container">
      <table class="comparison-table">
        <thead>
          <tr>
            <th></th>
            <th>
              <div class="sensor-header">
                <img src="../../../assets/images/pages/altruist-use-cases/table/altruist-logo.png" alt="Altruist Icon" class="sensor-icon" />
                <span class="sensor-name">Altruist Urban & Insight</span>
              </div>
            </th>
            <th>
              <div class="sensor-header">
                <img src="../../../assets/images/pages/altruist-use-cases/table/purpleAir-logo.png" alt="PurpleAir Icon" class="sensor-icon" />
                <span class="sensor-name">PurpleAir Zen</span>
              </div>
            </th>
            <th>
              <div class="sensor-header">
              <img src="../../../assets/images/pages/altruist-use-cases/table/airGradient-logo.png" alt="AirGradient Indoor & Outdoor Icon" class="sensor-icon" />
                <span class="sensor-name">AirGradient Indoor & Outdoor</span>
              </div>
            </th>
            <th>
              <div class="sensor-header">
                <img src="../../../assets/images/pages/altruist-use-cases/table/netatmo-logo.png" alt="Netatmo Icon" class="sensor-icon" />
                <span class="sensor-name">Netatmo</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr class="device-image-row">
            <th></th>
            <td>
              <img src="../../../assets/images/pages/altruist-use-cases/table/altruist-device.png" alt="Altruist Device" class="device-photo" />
            </td>
            <td>
              <img src="../../../assets/images/pages/altruist-use-cases/table/purpleAir-device.png" alt="PurpleAir Device" class="device-photo" />
            </td>
            <td>
              <img src="../../../assets/images/pages/altruist-use-cases/table/airGradient-device.png" alt="AirGradient Device" class="device-photo" />
            </td>
            <td>
              <img src="../../../assets/images/pages/altruist-use-cases/table/netatmo-device.webp" alt="Netatmo Device" class="device-photo" />
            </td>
          </tr>
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


<style>
/* table accent colors */
  :root {
    --blue-table-main: hsl(219, 63%, 45%);
    --blue-table-light: hsl(219, 100%, 95%);
    --blue-table-soft: hsl(219, 80%, 90%);
    --blue-table-border: hsl(219, 80%, 85%);
    --blue-table-dark: hsl(219, 80%, 30%);
  }
</style>


<style scoped>

.yes-value {
  color: #2e7d32;
  font-weight: 600;
}

.no-value {
  color: #c62828;
  font-weight: 600;
}

/* .even-row {
  background-color: #fff9fd;
}

.odd-row {
  background-color: #fff;
} */

.even-row {
  background-color: #f8fbff;
}

.odd-row {
  background-color: #ffffff;
}

.table-title {
  text-align: center;
  /* color: #d16ba5; */
  /* font-size: 1.8rem; */
  color: var(--app-buttoncolor);
  margin-bottom: 1.5rem;
}

.table-container {
  overflow-x: auto;
}

.comparison-table {
  width: 99%;
  border-collapse: collapse;
  min-width: 800px;
  /* border: 1px solid #f3d1e0;  */
  background: var(--color-light);
  border: 1px solid var(--blue-table-border);
}

.comparison-table thead {
  /* background: linear-gradient(to bottom, #ffe6f4, #ffd1ec);
  color: #8b3970;
  border-bottom: 2px solid #f3c2e0; */
  background: linear-gradient(to bottom, hsl(220, 100%, 95%), hsl(219, 100%, 88%));
  color: var(--blue-table-dark);
  border-bottom: 2px solid var(--blue-table-border);
}

.comparison-table thead th {
  text-align: center;
  vertical-align: bottom;
  padding: 1rem 0.5rem;
}

.comparison-table th,
.comparison-table td {
  padding: 0.8rem 1rem;
  /* border: 1px solid #f3d1e0; */
  border: 1px solid var(--blue-table-border);
  text-align: left;
  vertical-align: top;
}

.comparison-table th:first-child {
  /* background-color: #fff0fa;
  color: #b45291; */
  background-color: var(--blue-table-soft);
  color: var(--blue-table-main);
  font-weight: 600;
  min-width: 180px;
}

.comparison-table tbody tr {
  transition: transform 0.2s ease, background-color 0.2s ease;
}

/* .comparison-table tbody tr:hover {
  background-color: #ffeaf8;
  transform: scale(1.01);
} */

.comparison-table tbody tr:hover {
  background-color: hsl(219, 80%, 95%);
  transform: scale(1.01);
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

.sensor-icon {
  max-width: 60px;
  height: auto;
  object-fit: contain;
  border-radius: 0;
  display: block;
}

.sensor-name {
  font-size: 0.85rem;
  font-weight: 600;
  /* color: #b14d8f; */
  color: var(--blue-table-dark);
  line-height: 1.2;
}


.device-photo {
  max-width: 130px;
  height: auto;
  display: block;
  margin: 0 auto;
  transition: transform 0.3s ease;
}

.device-photo:hover {
  transform: scale(1.05);
}

.device-image-row td {
  padding: 1rem 0.5rem;
  vertical-align: middle;
  /* background-color: #fffafc; */
  background-color: #f0f6ff;
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
