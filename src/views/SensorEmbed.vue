<template>
  <Header />
  <section class="container-pagetext">
    <div class="sensor-embed">
      <h3>Sensor: {{ sensorId }}</h3>

      <p></p>
      <div class="sensor-embed__data" v-if="data.values">
        <p>
          <b>Address:</b> {{ data.address && data.address.location }} -
          {{ data.address && data.address.country }}
        </p>

        <p v-if="data.values.pm10"><b>PM10</b>: {{ data.values.pm10 }}</p>
        <p v-if="data.values.pm25"><b>PM2.5</b>: {{ data.values.pm25 }}</p>
        <p v-if="data.values.temperature"><b>Temperature</b>: {{ data.values.temperature }} °C</p>
        <p v-if="data.values.humidity"><b>Humidity:</b> {{ data.values.humidity }}</p>
        <p v-if="data.values.gc"><b>GC:</b> {{ data.values.gc }}</p>
        <p v-if="data.values.noisemax && data.values.noiseavg">
          <b>Noise:</b> max - {{ data.values.noisemax }}, average - {{ data.values.noiseavg }}
        </p>
        <!-- Optional: Graph here -->
        <Chart v-if="log.length" :log="log" />
      </div>
      <div v-else>Loading sensor data...</div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import moment from "moment";

import { getAddressByPos } from "../utils/map/utils";

import Header from "../components/header/Header.vue";
import Chart from "../components/sensor/Chart.vue";

const route = useRoute();
const sensorId = route.query.id;
const data = ref({});
const log = ref([]);

const startTimestamp = moment().startOf("day").unix();
const endTimestamp = moment().endOf("day").unix();

const apiUrl = `https://roseman.airalab.org/api/sensor/${sensorId}/${startTimestamp}/${endTimestamp}`;

onMounted(async () => {
  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then(async (res) => {
      // console.log("Sensor data for today:", res.result);

      const lat = res.result[0].geo.lat;
      const lng = res.result[0].geo.lng;
      const adrs = await getAddressByPos(lat, lng, "en");
      data.value.address = {
        country: adrs.country,
        location: adrs.address.join(" "),
      };

      data.value.values = res.result[0].data;

      log.value = res.result;
    })
    .catch((error) => {
      console.error("Fetch error:", error);
    });
  // test url = /#/embed/sensor/6cbea54e4f1ca357ed492cf852e85ea567cf5fae829c368c665e017e114a39a8

  // f6ae8f6d898aad407801d83b8f840122891e1d712b7a08b9c684f86770a1e652
});
</script>

<style>
.sensor-embed {
  padding: 1rem;
  font-size: 0.9rem;
}

.sensor-embed__data p {
}
</style>
