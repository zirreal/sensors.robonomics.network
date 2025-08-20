<template>
  <header :class="`route-${route.name || route.path.replaceAll('/', '-')}`">
    <div class="header-banner flexline align-center">
      <a href="https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight?utm_source=sensors.social&utm_medium=header-banner" target="_blank">
        <span><b>{{$t('Limited')}}</b> {{ $t('Altruist Bundles on') }}</span>
        <img class="header-banner-svg" alt="Indiegogo" src="../../assets/images/indiegogo.svg"/>
      </a>
    </div>

    <div class="header-content flexline space-between">
      <div class="flexline align-start">
        <router-link to="/" class="appicon">
          <img :alt="config.TITLE" src="../../../public/app-icon-512.png" />
        </router-link>
        <details v-if="mapStore.sensors?.length > 0" tabindex="0" class="sensors details-popup">
          <summary>
            <IconSensor class="sensors-mainicon" />
            {{ mapStore.sensors?.length + zeroGeoSensors?.length }}
          </summary>
          <div class="details-content" :class="zeroGeoSensors?.length > 0 ? 'nogeo' : null">

            <section v-if="zeroGeoSensors?.length > 0">
              <h4>{{zeroGeoSensors?.length}} sensors without geolocation</h4>
              <ul class="sensors-list">
                <li v-for="sensor in zeroGeoSensors" :key="sensor.id">
                  <a :href="getSensorLink(sensor)" @click.prevent="showsensor(sensor)">
                    <b>{{ formatSensorId(sensor.sensor_id) }}</b>
                  </a>
                </li>
              </ul>
            </section>

            <AltruistPromo utmMedium="header_popup" />
          </div>
        </details>
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
          <p>{{$t('Map data')}} © <a href="https://www.openstreetmap.org/copyright" target="_blank">{{ $t('OpenStreetMap contributors') }}</a></p>

          <section class="navlinks">
            <router-link to="/altruist-use-cases/">{{ $t('Altruist use cases') }}</router-link>
            <router-link to="/altruist-timeline/">{{ $t('Altruist timeline') }}</router-link>
            <router-link to="/altruist-compare/">{{ $t('Altruist comparison table') }}</router-link>
            <router-link to="/air-measurements/">{{ $t("links.measurement") }}</router-link>
            <router-link to="/privacy-policy/">{{ $t("links.privacy") }}</router-link>
          </section>

          <ReleaseInfo />
        </div>
        <button class="popovercontrol" popovertarget="about">
          <font-awesome-icon icon="fa-solid fa-bars" />
        </button>

        <Login v-if="config.SERVICES.accounts" />
        
        <!-- <a class="button button-promo" href="https://www.indiegogo.com/projects/altruist-air-quality-bundle-urban-insight?utm_source=sensors.social&utm_medium=header-button" target="_blank">Altruist on Indiegogo</a> -->
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { languages } from "@/translate";
import config from "@config";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { useMapStore } from "@/stores/map";

import IconSensor from "../icons/Sensor.vue";
import AltruistPromo from "../devices/altruist/AltruistPromo.vue";
import ReleaseInfo from "../ReleaseInfo.vue";
import Login from "./Login.vue";

const { locale: i18nLocale } = useI18n();
const router = useRouter();
const route = useRoute();

const locale = ref(localStorage.getItem("locale") || i18nLocale.value || "en");
const locales = languages || ["en"];
const mapStore = useMapStore();

const zeroGeoSensors = computed(() => {
  const tolerance = 0.001; // допуск для сравнения
  return mapStore.sensors.filter(sensor => {
    const lat = Number(sensor.geo.lat);
    const lng = Number(sensor.geo.lng);
    return Math.abs(lat) < tolerance && Math.abs(lng) < tolerance;
  });
});


// Make a link for sensor. E.g. origin/#/provider/pm10/20/lat/lng/sensor_id
const getSensorLink = (sensor) => {
  const provider = localStorage.getItem("provider_type") || "remote";
  const measureType = (localStorage.getItem("currentUnit") || "pm10").toLowerCase();
  return router.resolve({
    name: "main",
    query: {
      provider: provider,
      type: measureType,
      zoom: config.MAP.zoom,
      lat: sensor.geo.lat,
      lng: sensor.geo.lng,
      sensor: sensor.sensor_id,
    },
  }).href;
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
});

</script>

<style>
  .header-banner b {
    font-weight: 900;
  }
</style>

<style scoped>
  header {
    left: 0;
    position: sticky;
    top: 0;
    width: 100vw;
    z-index: 99;
    pointer-events: none;
    box-shadow: 0 6px 12px -4px rgba(0, 0, 0, 0.12);
  }

  header.route-altruist-compare {
    position: static;
  }

  header > * {
    pointer-events: all;
  }

  .header-content {
    padding: calc(var(--gap)/2) var(--gap);
    background-color: var(--app-bodybg);
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

#about p {
  font-size: 0.9em;
}

.navlinks {
  font-weight: 900;
  margin-bottom: calc(var(--gap) * 3);
}

.navlinks a {
  margin-bottom: calc(var(--gap) * 0.5);
  border-bottom: 1px dotted #000;
  display: block;
  padding: 5px 0;
  text-decoration: none;
}

/* + sensors list */

.sensors summary {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #000;
  background: var(--color-orange);
  border-radius: 5px;
  padding: 4px 5px;
  font-weight: bold;
}

.sensors-mainicon {
  width: 22px;
}

.sensors-list a {
  display: block;
  padding: 5px;
}

.sensors-list li {
  display: block;
  border-top: 1px dotted var(--app-bordercolor);
  margin: 0;
}
/* - sensors list */

/* + banner */
.header-banner {
  background-color: #4b01d4;
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
  text-decoration: none;
}

.header-banner-svg {
  max-height: 12px;
  padding: 0 5px;
}
/* - banner */


 @media screen and (max-width: 480px) {
   .header-banner {
      padding: calc(var(--gap) * 0.7);
    }
   
    .header-banner a {
      flex-direction: column;
      text-align: center;
    }
  }

  @media screen and (width > 900px) {
    .nogeo {
      display: grid;
      grid-template-columns: 350px 1fr;
      max-width: calc(100vw - var(--gap) * 2) !important;
      min-width: min(800px, calc(100vw - (var(--gap) * 2))) !important;
      gap: calc(var(--gap) * 2);
    }

    .buySensor {
      margin-top: 0 !important;
    }
  }

</style>
