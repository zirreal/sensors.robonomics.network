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
    currentUnit: (localStorage.getItem('currentUnit') || settings?.MAP?.measure || 'pm25').toLowerCase(),
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
    setCurrentUnit(unit) {
      const u = String(unit || '').toLowerCase();
      this.currentUnit = u;
      try { localStorage.setItem('currentUnit', u); } catch {}
    }
  },
});
