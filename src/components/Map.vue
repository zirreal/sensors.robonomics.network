<template>
  <div :class="{ inactive: mapStore.mapinactive }" class="mapcontainer" id="map"></div>
  <Footer
    :currentProvider="provider"
    :canHistory="historyready"
    @history="historyhandler"
    :measuretype="measuretype"
    :isLoad="isLoad"
    @typeChanged="handleTypeChange"
  >
    <button
      class="popovercontrol popoovergeo"
      v-if="geoavailable"
      @click.prevent="resetgeo"
      :area-label="$t('showlocation')"
      :title="geoisloading ? $t('locationloading') : $t('showlocation')"
    >
      <font-awesome-icon icon="fa-solid fa-location-arrow" :fade="geoisloading" />

      <div class="popoovergeo-tip" v-if="geomsg !== ''" :class="geomsgopened ? 'opened' : 'closed'">
        {{ geomsg }}
        <font-awesome-icon
          icon="fa-solid fa-xmark"
          class="popoovergeo-tipclose"
          @click.stop="geomsg = ''"
        />
      </div>
    </button>
  </Footer>
</template>

<script>
import { settings } from "@config";
import { toRaw } from "vue";
import Footer from "../components/footer/Footer.vue";
import { drawuser, init, removeMap, setTheme, setview } from "../utils/map/instance";
import { init as initMarkers } from "../utils/map/markers";
import { init as initWind } from "../utils/map/wind";
// import { getTypeProvider } from "../utils/utils"; // deprecated

import { useMapStore } from "@/stores/map";
import { useBookmarksStore } from "@/stores/bookmarks";

export default {
  emits: ["city", "clickMarker", "close", "activateMarker"],
  props: ["measuretype", "historyready", "historyhandler", "isLoad"],
  components: { Footer },
  data() {
    return {
      mapStore: useMapStore(),
      bookmarksStore: useBookmarksStore(),
      locale: localStorage.getItem("locale") || this.$i18n.locale || "en",
      theme: window?.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
      userposition: null,
      geoavailable: false,
      geoisloading: false,
      geomsg: "",
      geomsgopened: false,
      geomsgopenedtime: 5000, // 5 seconds
      geomsgopenedtimer: null,
      map: null,
    };
  },

  computed: {
    zoom() {
      return this.mapStore.mapposition.zoom;
    },
    lat() {
      return this.mapStore.mapposition.lat;
    },
    lng() {
      return this.mapStore.mapposition.lng;
    },
    provider() {
      return this.mapStore.currentProvider;
    },
  },

  methods: {
    themelistener({ matches, media }) {
      if (!matches) {
        // Not matching anymore = not interesting
        return;
      }

      if (media === "(prefers-color-scheme: dark)") {
        this.theme = "dark";
      } else if (media === "(prefers-color-scheme: light)") {
        this.theme = "light";
      }

      setTheme(this.theme);
    },

    relocatemap(lat, lng, zoom, type = "default") {
      console.debug("relocatemap", lat, lng, zoom, type);
      const options = {
        name: "main",
        query: {
          provider: this.mapStore.currentProvider,
          type: this.$route.query.type || "pm10",
          zoom: zoom,
          lat: lat,
          lng: lng,
          sensor: this.$route.query.sensor,
          date: this.$route.query.date, // Preserve date parameter
        },
      };

      if (this.$router.currentRoute.value.name === "main") {
        /* added here check for current route is map (main), as it caused problems with other pages */
        if (type === "reload") {
          this.$router.push(options).catch((e) => {
            console.warn(e);
          });
          setview([lat, lng], zoom);
        } else {
          this.$router.replace(options).catch((e) => {
            console.warn(e);
          });
        }
      }
    },

    closegeotip() {
      this.geomsg = "";
      this.geomsgopened = false;

      if (this.geomsgopenedtimer) {
        clearTimeout(this.geomsgopenedtimer);
      }
    },

    opengeotip(msg) {
      this.closegeotip();

      this.geomsg = msg;
      this.geomsgopened = true;

      this.geomsgopenedtimer = setTimeout(() => {
        this.geomsg = "";
        this.geomsgopened = false;
      }, this.geomsgopenedtime);
    },

    getlocalmappos() {
      // console.log("Geolocation setting up default values");
      const lastsettings =
        localStorage.getItem("map-position") ||
        JSON.stringify({
          lat: settings.MAP.position.lat,
          lng: settings.MAP.position.lng,
          zoom: settings.MAP.zoom,
        });
      let savelocally = true;

      /* We don't need to save position loacally if there is set from config */
      if (!localStorage.getItem("map-position")) {
        savelocally = false;
      }

      this.mapStore.setmapposition(
        JSON.parse(lastsettings).lat,
        JSON.parse(lastsettings).lng,
        JSON.parse(lastsettings).zoom,
        savelocally
      );

      // if(localStorage.getItem("map-position")) {
      //   this.geomsg += "Geolocation is set from saved data";
      // } else {
      //   this.geomsg += "Geolocation is set by default";
      // }
    },

    handleActivePoint() {
      if (this.$route.query.sensor) {
        this.$emit("activateMarker", this.$route.query.sensor);
      }
    },

    checkPosFromURI() {
      if (this.$route.query.lat || this.$route.query.lng || this.$route.query.zoom) {
        return true;
      }
      return false;
    },
    setPosFromURI() {
      const lat = this.$route.query.lat || settings.MAP.position.lat;
      const lng = this.$route.query.lng || settings.MAP.position.lng;
      const zoom = this.$route.query.zoom || settings.MAP.zoom;
      this.mapStore.setmapposition(lat, lng, zoom, true);
    },
    setPosDefault() {
      this.mapStore.setmapposition(
        settings.MAP.position.lat,
        settings.MAP.position.lng,
        settings.MAP.zoom,
        true
      );
    },

    handleTypeChange(newType) {
      // If sensor popup is open — do not repaint the map now
      if (this.$route.query.sensor) return;
      // Otherwise, redraw markers for the new type
      if (this.map) {
        this.$emit('typeChanged', newType);
      }
    },

    setgeo(forse = false) {
      return new Promise((resolve, reject) => {
        this.geoisloading = true;

        if ("geolocation" in navigator) {
          this.geoavailable = true;

          if (this.checkPosFromURI() && !forse) {
            this.setPosFromURI();
            resolve(this.$t("geolocationfromparams"));
          } else if (localStorage.getItem("map-position") && !forse) {
            this.getlocalmappos();
            resolve(this.$t("geolocationlocal"));
          } else if (!forse) {
            this.setPosDefault();
            resolve(this.$t("geolocationdefault"));
          } else {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                /* setting for the app globally user's geo position and zoom 20 for better view */
                this.userposition = [position.coords.latitude, position.coords.longitude];
                this.mapStore.setmapposition(this.userposition[0], this.userposition[1], 20);

                if (this.userposition && this.map) {
                  drawuser(this.userposition, this.zoom);
                }

                resolve(this.$t("geolocationisdetermined"));
              },
              (e) => {
                reject(`${this.$t("geolocationerror")} ${e.code}]`);
              },
              {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 5 * 60 * 1000,
              }
            );
          }
        } else {
          this.geoavailable = false;
          reject(this.$t("geolocationnotavailable"));
        }
      });
    },

    resetgeo() {
      this.closegeotip();

      this.setgeo(true)
        .then((m) => {
          // console.log("Geolocation set succesfully");
          this.relocatemap(this.lat, this.lng, this.zoom, "reload");
          this.geoisloading = false;
          this.opengeotip(m);
        })
        .catch((m) => {
          // console.log("Error in 'resetgeo': ", e);
          this.geoisloading = false;
          this.opengeotip(m);
        });
    },

    async loadMap() {
      this.geoisloading = false;

      this.map = init([this.lat, this.lng], this.zoom, this.theme);
      this.relocatemap(this.lat, this.lng, this.zoom, "reload");

      this.map.on("zoomend", (e) => {
        this.relocatemap(
          e.target.getCenter().lat.toFixed(4),
          e.target.getCenter().lng.toFixed(4),
          e.target.getZoom()
        );
        this.mapStore.setmapposition(
          e.target.getCenter().lat.toFixed(4),
          e.target.getCenter().lng.toFixed(4),
          e.target.getZoom()
        );
      });

      this.map.on("moveend", (e) => {
        /* setTimeout for mobiles (when swiping up app, it causes unpleasant map moving before closing app) */
        setTimeout(() => {
          this.relocatemap(
            e.target.getCenter().lat.toFixed(4),
            e.target.getCenter().lng.toFixed(4),
            e.target.getZoom()
          );
          this.mapStore.setmapposition(
            e.target.getCenter().lat.toFixed(4),
            e.target.getCenter().lng.toFixed(4),
            e.target.getZoom()
          );

          this.handleActivePoint();
        }, 50);
      });

      initMarkers(toRaw(this.map), (data) => {
        this.$emit("clickMarker", data);
      }, this.measuretype);

      if (this.provider === "realtime") {
        await initWind();
      }

      /* get bookmarks and listenning for broadcast from DB */
      await this.bookmarksStore.idbBookmarkGet();
    },
  },

  unmounted() {
    removeMap();
  },
  watch: {
    geoisloading(v) {
      console.debug("geoisloading changed", v);
    },
    geomsg(v) {
      console.debug("geomsg changed", v);
    },
  },

  async mounted() {
    /* + get user's system theme */
    if (window.matchMedia) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", this.themelistener);
      window
        .matchMedia("(prefers-color-scheme: light)")
        .addEventListener("change", this.themelistener);
    }
    /* - get user's system theme */

    /* + Operate with a map */

    /* retrieve coordinates */
    this.setgeo()
      .then(async (m) => {
        this.opengeotip(m);
        this.loadMap();
      })
      .catch((m) => {
        /* Если нет возможности "geolocation", то проверяем локальное хранилище */
        this.opengeotip(m + `, ${this.$t("geolocationdefaultsetup")}`);
        this.loadMap();
      });
    /* - Operate with a map */

    // keep measure type from props/route only
  },

  watch: {},
};
</script>


<style scoped>
.mapcontainer {
  background-color: var(--color-light-gray);
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  width: 100%;
  height: 100svh;
  overflow: hidden;
}


.popoovergeo {
  position: relative;
}

.popoovergeo-tip {
  --gettime: v-bind("geomsgopenedtime");
  --openedtime: calc(var(--gettime) / 1000 * 1s);
  position: absolute;
  padding: 5px 25px 5px 10px;
  background-color: color-mix(in srgb, var(--color-dark) 70%, transparent);
  color: var(--color-light);
  backdrop-filter: blur(5px);
  font-weight: bold;
  border-radius: 2px;
  bottom: calc(var(--app-inputheight) + 10px);
  width: 220px;
  right: -10px;
  font-size: 0.9em;
}

/* .popoovergeo-tip.opened {
  animation: fadeOut 0.3s linear var(--openedtime) forwards;
} */

.popoovergeo-tip:before {
  content: "";
  height: 2px;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--color-light);
  animation: rolldownLeft var(--openedtime) linear 0s forwards;
  transform-origin: 0 50%;
}

.popoovergeo-tip:after {
  content: "";
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid color-mix(in srgb, var(--color-dark) 70%, transparent);
  position: absolute;
  bottom: -10px;
  right: 15px;
}

.popoovergeo-tipclose {
  position: absolute;
  top: 5px;
  right: 5px;
}
</style>
