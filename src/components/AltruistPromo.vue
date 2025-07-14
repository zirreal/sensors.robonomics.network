<template>
    <div class="buySensor">

      <div class="buySensor-grid">
        <a
          class="buySensor-preview"
          :href="link"
          target="_blank"
          rel="noopener"
        >
          <img alt="" src="../assets/altruist-device/Altruist-bundle.png" />
          <span>New</span>
        </a>

        <div>
          <h2>Where to get a sensor</h2>
          <p>Air monitor for indoors & outdoors: urban PM & noise, bedroom CO₂, indoor vs outdoor temp & humidity, barometric pressure, E-Ink display, Wi-Fi, USB-C, no forced cloud, Home Assistant ready. DIY & modding friendly! Super Early Bird – €149 | Amazon – €295 (Fall 2025).&nbsp;</p>
          <p><a :href="link" target="_blank">Join Indiegogo Campaign &rarr;</a></p>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, defineProps, onMounted } from "vue";

const props = defineProps({
  utmMedium: { type: String, default: "sensor" }, // sensor | header_popup or url
});

const link = ref("");

onMounted(() => {
  link.value =
    "https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight/coming_soon" +
    `?utm_source=sensors.social&utm_medium=${props.utmMedium}`;
});

</script>

<style scoped>
.buySensor {
  font-weight: bold;
  container-type: inline-size;
}

.buySensor:not(:first-child) {
  margin-top: calc(var(--gap) *2);
}

.buySensor:not(:last-child) {
  margin-bottom: calc(var(--gap) *2);
}

.buySensor-grid {
    display: grid;
    grid-template-columns: 150px auto;
    align-items: center;
    gap: 20px;
    font-size: 85%;
}

.buySensor-preview {
  position: relative;
}

.buySensor-preview span {
  align-items: center;
  background-color: var(--color-link);
  border-radius: 20px;
  border: 2px solid #fff;
  color: #fff;
  display: flex;
  font-size: 0.8rem;
  height: 40px;
  justify-content: center;
  right: 0;
  position: absolute;
  text-transform: uppercase;
  top: 0;
  width: 40px;
}

.buySensor-preview img {
  display: inline-block;
  max-width: 100%;
  /* padding: var(--gap); */
}

@container (width > 600px) {
  .buySensor-grid {
    font-size: 110%;
    padding: 20px;
    gap: 40px;
  }

  .buySensor-grid h3 {
    font-size: 1.6rem;
  }
}
</style>