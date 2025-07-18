<template>
<div class="export-data"  v-if="provider !== 'realtime'">
  <div class="export-data__checkboxes">
    <label class="checkbox-item">
      <input
        type="checkbox"
        :checked="!selectedMeasurements.length"
        @change="toggleAllMeasurements"
      />
      All Measurements
    </label>
    <label
      v-for="m in availableMeasurements"
      :key="m"
      class="checkbox-item"
    >
      <input
        type="checkbox"
        :value="m"
        v-model="selectedMeasurements"
        @change="onMeasureChange"
      />
      {{ m.toUpperCase().replace('PM25', 'PM2.5') }}
    </label>
  </div>
  <select v-model="exportType">
    <option value="csv">CSV</option>
    <option value="pdf">PDF</option>
  </select>
  <button class="button" @click="exportData">Export Data</button>
</div>
<div ref="pdfContent" class="pdf-container" :class="{'pdf-container-exporting': isExporting}">
  <section v-if="isExporting">
    <h3 class="flexline clipoverflow">
      <img v-if="icon" :src="icon" class="icontitle" />
      <font-awesome-icon v-else icon="fa-solid fa-location-dot" />
      <span v-if="addressformatted">{{ addressformatted }}</span>
      <span v-else class="skeleton-text"></span>
    </h3>
    <p>Coordinates - {{ geo.lat }}, {{ geo.lng }}</p>
    <h2>{{ sensor_id }}</h2>
    <p v-if="!isExporting">{{ start }}<span v-if="provider === 'realtime'"> – {{ rttime }}</span></p>
    <p v-else>
        {{ formattedStart }}
        <span v-if="provider === 'realtime'"> – {{ rttime }}</span>
    </p>
  </section>
  <section v-show="isExporting">
    <ExportChart ref="chartRef" :log="log" :unit="unit" />
  </section>
</div>

<!-- Loader overlay -->
<div v-if="isExporting" class="export-loader-overlay">
  <span>Exporting PDF</span>
  <div class="loader"></div>
</div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from "vue";
import { useStore } from "@/store";

import { RobotoFont } from "../../utils/pdfFont";

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import measurements from "../../measurements";

import ExportChart from "./ExportChart.vue";

const props = defineProps({
  type: String,
  log: {
    type: Array,
    default: () => []
  },
  unit: String,
  icon: String,
  geo: Object,
  addressformatted: String,
  sensor_id: String,
  provider: String,
  start: String,
  rttime: String,
  rtdata: {
    type: Array,
    default: () => []
  },

});
const store = useStore();

const chartRef = ref(null);
const exportType = ref('pdf');
const selectedMeasurements = ref([]); 
const isExporting = ref(false)
const pdfContent = ref(null);

// checkboxes options
const availableMeasurements = computed(() => {
  const set = new Set();

  for (const entry of props.log) {
    if (entry?.data) {
      Object.keys(entry.data).forEach(k => set.add(k));
    }
  }

  return Array.from(set).sort();
});


const formattedStart = computed(() => {
  if (!props.start) return ''

  const startStr = props.start.toString()
  const [year, month, day] = startStr.split('-').map(Number)

  const startDate = new Date(year, month - 1, day)
  const now = new Date()

  const isToday = startDate.toDateString() === now.toDateString()

  if (isToday) {
    const hh = now.getHours().toString().padStart(2, '0')
    const mm = now.getMinutes().toString().padStart(2, '0')
    return `${startStr} ${hh}:${mm}`
  }

  return startStr
})

// timestamp conversion
const tsFormat = (sec) => {
  const d = new Date(sec * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// export checkboxes
const toggleAllMeasurements = async (evt) => {
  const isAll = evt.target.checked;

  if (isAll) {
    selectedMeasurements.value = [];

    await nextTick();

    // show all available series
    if (chartRef.value && exportType.value === 'pdf') {
      chartRef.value.showMultipleSeries([...availableMeasurements.value]);
    }
  } else {
    selectedMeasurements.value = [];
  }
};

// exporting data in pdf or csv
const exportData = async () => {
  if (!pdfContent.value) return;

  const fileType = exportType.value;
  const entries  = props.log ?? [];
  if (!entries.length) return;

  const allKeys = Array.from(entries.reduce((s,row)=>{
    Object.keys(row.data||{}).forEach(k=>s.add(k)); return s;
  }, new Set()));

  const columns = selectedMeasurements.value.length
    ? selectedMeasurements.value.filter(k => allKeys.includes(k))
    : allKeys;                 

  const label = k => {
    const up = k.toUpperCase();
    if (up === 'PM2_5' || up === 'PM25') return 'PM2.5 (dust & particles)';
    if (up === 'PM10') return 'PM10 (dust & particles)';
    return up;
  };

  /*   PDF    */
  if (fileType === 'pdf') {
    isExporting.value = true;
    await nextTick();  

    const origW = pdfContent.value.style.width;
    pdfContent.value.style.width =
      (innerWidth <= 768 ? 780 : 1100) + 'px';

    const canvas = await html2canvas(pdfContent.value, {
      useCORS: true,
      scale: devicePixelRatio || 1,
      scrollY: -scrollY
    });
    pdfContent.value.style.width = origW;

    const robotoRegularBase64 = RobotoFont;
    const pdf  = new jsPDF({ unit:'mm', format:'a4' });
    pdf.addFileToVFS('Roboto-Regular.ttf', robotoRegularBase64);
    pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    pdf.setFont('Roboto');
    pdf.setFontSize(8);
    const mm   = px=>px*25.4/96, m=10,
          ratio=Math.min((pdf.internal.pageSize.getWidth()-m*2)/mm(canvas.width),1);

    pdf.addImage(canvas.toDataURL('image/png'),'PNG', m,m,mm(canvas.width)*ratio,mm(canvas.height)*ratio);

    const header = ['Timestamp', ...columns.map(label)];

    const body = entries.map(r => [
      tsFormat(r.timestamp),
      ...columns.map(k => {
        const v = r.data?.[k];
        const unit = measurements[k]?.unit || '';
        if (typeof v === 'number') {
          return `${v.toFixed(2)} ${unit}`.trim();
        }
        return v ?? '-';
      })
    ]);

    // auto create table with needed measurements
    autoTable(pdf,{
      head:[header], body,
      startY: m+mm(canvas.height)*ratio+8,
      margin:{left:m,right:m},
      styles:{fontSize:8, font: 'Roboto', cellPadding:1.5},
      headStyles:{fillColor:[22,160,133],textColor:255},
      alternateRowStyles:{fillColor:[240,240,240]}
    });


    pdf.save(`sensor-${props.sensor_id}-${props.start}.pdf`);

    chartRef.value?.restoreSingleSeries(store.currentChartMeasure);
    await nextTick();

    isExporting.value = false;
    selectedMeasurements.value = [];

    return;
  }

  /*  CSV  */
  if (fileType === 'csv') {
    const D = ';';

    const meta = [
      ['Address',  props.addressformatted],
      ['Coordinates', props.geo.lat ?? '', props.geo.lng ?? ''].join(D),
      ['Sensor ID', props.sensor_id],
      ['Date range',
        `${formattedStart.value}${props.provider === 'realtime'
          ? ' – ' + props.rttime : ''}`],
      ''
    ].map(r => Array.isArray(r) ? r.join(D) : r);

    const header = ['Timestamp', ...columns.map(label)].join(D);

    const table = entries.map(e => {
      const vals = columns.map(c => {
        const v = e.data?.[c];
        const unit = measurements[c]?.unit || '';
        return typeof v === 'number' ? `${v.toFixed(2)} ${unit}`.trim() : (v ?? '-');
      });
      return [tsFormat(e.timestamp), ...vals].join(D);
    });

    const csvText = [...meta, header, ...table].join('\n');
    const blob    = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });

    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `sensor-${props.sensor_id}-${props.start}-custom.csv`
    });
    link.click();
    URL.revokeObjectURL(link.href);
    selectedMeasurements.value = [];
  }
};

// export checkboxes
watch(selectedMeasurements, (newVal) => {
  if(exportType.value === 'pdf') {
    if (chartRef.value) {
      chartRef.value.showMultipleSeries(newVal);
    }
  }
});
</script>

<style>
.pdf-container-exporting .highcharts-tooltip {
  visibility: hidden !important; 
}
</style>

<style scoped>

.export-data__checkboxes {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
  gap: 10px;
}

.export-data select {
  margin-right: calc(var(--gap) * 0.5);
}

.pdf-container {
  position: relative;
  margin-bottom: var(--gap);
}

.pdf-container-exporting {
  pointer-events: none;
  background: #fff;
  color: #000;
  padding: 16px;
  font-family: system-ui, sans-serif;
}

.pdf-container h2 {
  font-size: 20px;
}

.export-loader-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0);
  background-size: 200% 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 20px;
  z-index: 1000;
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--color-navy);
  animation: skeleton-loading 1.5s infinite;
}

.export-loader-overlay .loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--color-navy);; 
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: spinPdf 1s linear infinite;
  margin-right: 8px;
}

@keyframes spinPdf {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}


</style>