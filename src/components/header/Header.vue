<template>
  <header>
    <div class="header-banner flexline align-center" :style="{ backgroundColor: banner.color }">
      <a :href="banner.href" target="_blank">
        <span v-html="banner.label"></span>
        <img class="header-banner-svg" alt="Indiegogo" src="../../assets/images/indiegogo.svg"/>
      </a>
    </div>

    <div class="header-content flexline space-between">
      <div class="flexline align-start">
        <router-link to="/" class="appicon">
          <img :alt="config.TITLE" src="../../../public/app-icon-512.png" />
        </router-link>

        <div class="sensors" v-if="store.sensors?.length > 0">

          <IconSensor class="sensors-mainicon" />
          <b class="sensor-item">{{ store.sensors?.length }}</b>

          <details v-if="zeroGeoSensors.length > 0" tabindex="0">
            <summary class="sensor-item">
              <font-awesome-icon icon="fa-solid fa-exclamation" /> 
              {{ zeroGeoSensors.length }}
            </summary>
            <div class="details-content">
              <h4>No geo sensors list</h4>
              <ul>
                <li v-for="sensor in zeroGeoSensors" :key="sensor.id">
                  <a :href="getSensorLink(sensor)" @click.prevent="showsensor(sensor)">
                    <b>{{ formatSensorId(sensor.sensor_id) }}</b>
                  </a>
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>

      <div class="flexline">
        <select v-model="locale">
          <option v-for="lang in locales" :key="lang.code" :value="lang.code">
            {{ lang.title }}
          </option>
        </select>

        <div id="about" class="popover popover-top-right" popover>
          <h3>{{ $t("header.title") }}</h3>
          <p>
            {{ $t("header.text1") }}
            <a
              href="https://www.fsf.org/campaigns/priority-projects/decentralization-federation"
              target="_blank"
              rel="noopener"
            >{{ $t("header.link1") }}</a>
            {{ $t("header.text2") }}
            <a
              href="https://robonomics.academy/en/learn/sensors-connectivity-course/sensors-connectivity-module/"
              target="_blank"
              rel="noopener"
            >{{ $t("header.link2") }}</a>
            {{ $t("header.text3") }}
          </p>

          <AltruistPromo utmMedium="header_popup" />

          <h3>{{ $t("header.addSensorTitle") }}</h3>
          <p>
            {{ $t("header.addSensorText1") }}
            <a
              href="https://robonomics.academy/en/learn/sensors-connectivity-course/sensor-hardware/"
              target="_blank"
              rel="noopener"
            >{{ $t("header.addSensorLink1") }}</a>
            {{ $t("header.addSensorText2") }}
            <a
              href="https://robonomics.academy/en/learn/sensors-connectivity-course/setting-up-and-connecting-sensors/"
              target="_blank"
              rel="noopener"
            >{{ $t("header.addSensorLink2") }}</a>
            {{ $t("header.addSensorText3") }}
          </p>
          <p>
            <a
              href="https://youtu.be/AQ7ZzgbN7jU?si=Y_FsDCEw5T97"
              target="_blank"
              rel="noopener"
            >{{ $t("header.addSensorLink3") }}</a>
          </p>

          <section class="navlinks">
            <a
              href="https://github.com/airalab/sensors.robonomics.network"
              target="_blank"
              rel="noopener"
            >{{ $t("links.github") }}</a>
            <router-link to="/air-measurements">{{ $t("links.measurement") }}</router-link>
            <router-link to="/privacy-policy">{{ $t("links.privacy") }}</router-link>
          </section>

          <ReleaseInfo />
        </div>
        <button class="popovercontrol" popovertarget="about">
          <font-awesome-icon icon="fa-solid fa-info" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useStore } from "@/store";
import { languages } from "@/translate";
import config from "@config";
import { useI18n } from "vue-i18n";
import IconSensor from "../icons/Sensor.vue";
import AltruistPromo from "../AltruistPromo.vue";
import ReleaseInfo from "../ReleaseInfo.vue";

const { locale: i18nLocale } = useI18n();

const locale = ref(localStorage.getItem("locale") || i18nLocale.value || "en");
const locales = languages || ["en"];
const store = useStore();
const banner = reactive({ label: "", color: "", href: "" });

const bannerVariants = [
  {
    label: "<b>New Altruist</b> [Urban + Insight + Add-ons] on",
    textKey: "text_a",
  },
  {
    label: "<b>Limited</b> Altruist Bundles on",
    textKey: "text_b",
  },
];

const bannerColors = [
  { color: "#e51075", colorKey: "color_1" },
  { color: "#000",    colorKey: "color_2" },
  { color: "#4b01d4", colorKey: "color_3" },
];



const zeroGeoSensors = computed(() => {
  const tolerance = 0.001; // допуск для сравнения
  return store.sensors.filter(sensor => {
    const lat = Number(sensor.geo.lat);
    const lng = Number(sensor.geo.lng);
    return Math.abs(lat) < tolerance && Math.abs(lng) < tolerance;
  });
});


// Make a link for sensor. E.g. origin/#/provider/pm10/20/lat/lng/sensor_id
const getSensorLink = (sensor) => {
  const provider = localStorage.getItem("provider_type") || "remote";
  const measureType = (localStorage.getItem("currentUnit") || "pm10").toLowerCase();
  return (
    window.location.origin +
    "/#/" +
    provider +
    "/" +
    measureType +
    "/20/" +
    sensor.geo.lat +
    "/" +
    sensor.geo.lng +
    "/" +
    sensor.sensor_id
  );
};

const showsensor = (sensor) => {
  /* 
    I'm really sorry for that, but current routing system is very complicated and it seems 
    very hard to impelement proper router mechanism here, so I just reload - positivecrash */
  window.location.href = getSensorLink(sensor);
  location.reload();
};

// Функция форматирования sensor_id: первые 6 символов, троеточие, последние 6
const formatSensorId = (id) => {
  id = String(id);
  if (id.length > 12) {
    return id.substring(0, 6) + "..." + id.substring(id.length - 6);
  }
  return id;
};

watch(locale, (newValue) => {
  i18nLocale.value = newValue;
  localStorage.setItem("locale", newValue);
}, {immediate: true});

onMounted(() => {

  // Close all opened details on body click if this is Tooltip
    
  document.body.onclick = (e) => {

      const current = e.target.closest('details[tabindex="0"]'); //save clicked element to detect if it is our current detail
      document.body.querySelectorAll('details[tabindex="0"]')
          .forEach((e) => {
              if(e !== current){ //we need this condition not to break details behavior
                e.open = false
              }
      })
  }

  /* + BANNER */
  const v = bannerVariants[Math.floor(Math.random() * bannerVariants.length)];
  const c = bannerColors[Math.floor(Math.random() * bannerColors.length)];

  banner.label = v.label;
  banner.color = c.color;
  banner.href =
    `https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight/coming_soon` +
    `?utm_source=sensors.social&utm_medium=head_banner&utm_content=${v.textKey}_${c.colorKey}`;
  /* - BANNER */
});

</script>

<style scoped>
header {
  left: 0;
  position: absolute;
  top: 0;
  width: 100vw;
  z-index: 10;
  pointer-events: none;
}

header > * {
  pointer-events: all;
}

.header-content {
  /* padding: var(--app-controlsgap); */
  padding: var(--gap);
}

.header-banner {
  /* background-color: #e51075; */
  color: #fff;
}

.header-banner a {
  width: 100%;
  padding: calc(var(--gap) /2) var(--gap);
  color: currentColor;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-banner-svg {
  max-height: 16px;
  padding: 0 5px;
}

.header-banner b {
  font-weight: 900;
}

.appicon {
  border-radius: 0.5rem;
  display: block;
  overflow: hidden;
  user-select: none;
  width: 2.5rem;
}

.appicon img {
  display: block;
  max-width: 100%;
}

.popover {
  max-height: 80svh;
  overflow-x: auto;
}

.popover-top-right {
  top: calc(var(--gap) * 3 + var(--app-inputheight));
  right: var(--gap);
  width: 500px;
  max-width: calc(100vw - var(--gap) * 2);
}

@supports not selector(:popover-open) {
  .popover-top-right {
    right: var(--gap) !important;
  }
}

#about p {
  font-size: 0.9em;
}

.navlinks {
  font-weight: bold;
}

.navlinks a {
  display: block;
  padding: 5px 0;
}

.navlinks a:not(:last-child) {
  margin-bottom: calc(var(--gap) * 0.5);
  border-bottom: 1px dotted #000;
}


/* + Sensors panel */

/* .sensorscount {
  color: #fff;
  background: var(--color-orange);
  padding: 4px 10px;
  display: block;
  border-radius: 5px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.sensorscount svg {
  width: 22px;
} */

.sensors {
  color: #000;
  background: var(--color-orange);
  display: flex;
  align-content: center;
  border-radius: 5px;
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.sensors-mainicon {
  width: 22px;
  margin: 4px 0 4px 4px;
}

.sensor-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

details {
  position: relative;
}

details summary::-webkit-details-marker,
details summary::marker {
  content: "";
  display: none; 
}

summary {
  cursor: pointer;
  background-color: #fff;
  border-radius: 0 5px 5px 0;
  padding: 0 5px;
  height: 100%;
}

.details-content {
  border-radius: 5px;
  background-color: #fff;
  padding: 10px;
  position: absolute;
  top: calc(100% + 10px);
  max-height: calc(100svh - 200px);
  min-width: 25svw;
  max-width: calc(100svw - 180px);
  overflow: auto;
  border: 1px solid var(--color-middle-gray);
}

.details-content li:not(:last-child) {
  border-bottom: 1px solid var(--color-middle-gray);
}

.details-content a {
  display: block;
  padding: 5px 0;
}

/* - Sensors panel */

</style>
