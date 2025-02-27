<template>
  <header class="flexline space-between">
    <div class="flexline align-start">
      <router-link to="/" class="appicon"
        ><img alt="App logo" src="../../../public/app-icon-512.png"
      /></router-link>
      <b class="sensorscount" v-if="countPoints > 0"><IconSensor /> {{ countPoints }}</b>
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
            >{{ $t("header.link1") }}</a
          >
          {{ $t("header.text2") }}
          <a
            href="https://robonomics.academy/en/learn/sensors-connectivity-course/sensors-connectivity-module/"
            target="_blank"
            rel="noopener"
            >{{ $t("header.link2") }}</a
          >
          {{ $t("header.text3") }}
        </p>
        <h3>{{ $t("header.addSensorTitle") }}</h3>
        <p>
          {{ $t("header.addSensorText1") }}
          <a
            href="https://robonomics.academy/en/learn/sensors-connectivity-course/sensor-hardware/"
            target="_blank"
            rel="noopener"
            >{{ $t("header.addSensorLink1") }}</a
          >
          {{ $t("header.addSensorText2") }}
          <a
            href="https://robonomics.academy/en/learn/sensors-connectivity-course/setting-up-and-connecting-sensors/"
            target="_blank"
            rel="noopener"
            >{{ $t("header.addSensorLink2") }}</a
          >{{ $t("header.addSensorText3") }}
        </p>
        <p>
          <a href="https://youtu.be/AQ7ZzgbN7jU?si=Y_FsDCEw5T97" target="_blank" rel="noopener">{{
            $t("header.addSensorLink3")
          }}</a>
        </p>

        <hr />
        <section class="navlinks">
          <a
            href="https://github.com/airalab/sensors.robonomics.network"
            target="_blank"
            rel="noopener"
            >{{ $t("links.github") }}</a
          >
          <router-link to="/air-measurements">{{ $t("links.measurement") }}</router-link>
          <router-link to="/privacy-policy">{{ $t("links.privacy") }}</router-link>
        </section>
      </div>
      <button class="popovercontrol" popovertarget="about">
        <font-awesome-icon icon="fa-solid fa-bars" />
      </button>
    </div>
  </header>
</template>

<script>
import { useStore } from "@/store";
import { languages } from "@/translate";
import IconSensor from "../icons/Sensor.vue";

export default {
  components: { IconSensor },

  data() {
    return {
      locale: localStorage.getItem("locale") || this.$i18n.locale || "en",
      locales: languages || this.$i18n.availableLocales || ["en"],
      store: useStore(),
    };
  },
  watch: {
    locale(newValue) {
      this.$i18n.locale = newValue;
      localStorage.setItem("locale", newValue);
    },
  },
  computed: {
    countPoints() {
      return this.store.sensors.length;
    },
  },
};
</script>

<style scoped>
header {
  left: 0;
  padding: var(--app-controlsgap);
  position: absolute;
  top: 0;
  width: 100vw;
  z-index: 10;
  pointer-events: none;
}

header > * {
  pointer-events: all;
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
}

.navlinks a:not(:last-child) {
  margin-bottom: calc(var(--gap) * 0.5);
}

.sensorscount {
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
}
</style>
