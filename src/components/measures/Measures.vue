<template>
  <select v-model="type" v-if="store.sensors.length > 0">
    <option v-for="opt in availableoptions" :key="opt.value" :value="opt.value">
      {{ opt.name }}
    </option>
  </select>
</template>

<script>
import { useStore } from "@/store";
import measurements from "../../measurements";
import { getTypeProvider } from "../../utils/utils";
import { Remote } from "../../providers";

export default {
  props: ["current", "startTime", "endTime"],
  data() {
    return {
      type: this.current,
      measurements: Object.entries(measurements),
      store: useStore(),
      availableunits: [{ name: "PM10", value: "pm10" }],
    };
  },
  async mounted() {
    try {
      const array = await Remote.getMeasurements(this.startTime, this.endTime);
      const toMove = ["pm10", "pm25"];
      const movedElements = array.filter((item) => toMove.includes(item));
      const remainingElements = array.filter((item) => !toMove.includes(item));
      this.availableunits = [...movedElements, ...remainingElements];
    } catch (error) {
      console.log(error);
    }
  },
  computed: {
    locale() {
      return this.$i18n.locale || localStorage.getItem("locale") || "en";
    },
    availableoptions() {
      let buffer = [];
      this.availableunits.forEach((i) => {
        if (measurements[i]) {
          buffer.push({
            name: measurements[i]?.nameshort
              ? measurements[i].nameshort[this.locale]
              : measurements[i]?.label,
            value: i,
          });
        }
      });
      return buffer;
    },
  },
  watch: {
    type: async function () {
      await this.$router.push({
        name: "main",
        params: {
          provider: getTypeProvider(),
          type: this.type,
          zoom: this.$route.params.zoom,
          lat: this.$route.params.lat,
          lng: this.$route.params.lng,
          sensor: this.$route.params.sensor,
        },
      });
      this.$router.go(0);
    },
  },
};
</script>
