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
          <h3>{{ variant.title }}</h3>
          <p>{{ variant.desc }}</p>
          <a
            :href="link"
            target="_blank"
            class="button"
          >{{ variant.btn }}</a>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, defineProps, onMounted } from "vue";

const props = defineProps({
  utmMedium: { type: String, default: "sensor" }, // sensor | header_popup
});

const variants = [
  {
    title: "Indiegogo campaign for the Bundle",
    desc: "Air Quality Sensor Altruist in a unique 3D-printed box with high-quality hardware, now in a new bundle version: Urban & Insight + Add-ons. Measure even more — don’t tie yourself to corporate clouds. Enjoy all the benefits of an open, independent product.",
    btn: "GoGo with New Altruist",
    key: "text_1",
  },
  {
    title: "Meet the Newest Altruist Bundle",
    desc: "Air monitor for indoors & outdoors: urban PM & noise, bedroom CO₂, indoor vs outdoor temp & humidity, barometric pressure, E-Ink display, Wi-Fi, USB-C, no forced cloud, Home Assistant ready. DIY & modding friendly! Super Early Bird – €149 | Amazon – €295 (Fall 2025)",
    btn: "Join Indiegogo campaign",
    key: "text_2",
  },
  {
    title: "New Altruist Air Quality Bundle with Urban Insight 🌆💨",
    desc: "Visit our Indiegogo pre-launch page: subscribe now to get notified at launch and claim the Super Early Bird deal — 42 % off, limited to just 42 units!",
    btn: "Ping me at launch",
    key: "text_3",
  },
];

const variant = ref(variants[0]);
const link = ref("");

onMounted(() => {
  variant.value = variants[Math.floor(Math.random() * variants.length)];
  link.value =
    "https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight/coming_soon" +
    `?utm_source=sensors.social&utm_medium=${props.utmMedium}&utm_content=${variant.value.key}`;
});

</script>

<style scoped>
.buySensor {
  padding: var(--gap);
  border: 1px solid #000;
  border-radius: 20px;
  font-weight: bold;
  margin: 40px 0;
  container-type: inline-size;
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
  background-color: #000;
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