import { settings } from "@config";
import { defineStore } from "pinia";

export const useMapStore = defineStore('map', {
  state: () => ({
    mapposition: {
      zoom: settings?.MAP.zoom || '4',
      lat:  settings?.MAP.position.lat || '0',
      lng:  settings?.MAP.position.lng || '0',
    },
    mapinactive: false,
    sensors: [], // all uploaded sensors (getting via broadcast messages)
  }),
  actions: {
    setmapposition(lat, lng, zoom, save = true) {
      this.mapposition.lat = lat;
      this.mapposition.lng = lng;
      this.mapposition.zoom = zoom;

      if(save) {
        localStorage.setItem("map-position", JSON.stringify({lat, lng, zoom}));
      }
    },
    setSensors(sensorsArr) {
      this.sensors = sensorsArr;
    },
    clearSensors() {
      this.sensors = [];
    },
  },
});
