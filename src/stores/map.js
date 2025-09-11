import { settings } from "@config";
import { defineStore } from "pinia";
import { dayISO } from "@/utils/date";

export const useMapStore = defineStore('map', {
  state: () => ({
    mapposition: {
      zoom: settings?.MAP.zoom || '4',
      lat:  settings?.MAP.position.lat || '0',
      lng:  settings?.MAP.position.lng || '0',
    },
    mapinactive: false,
    sensors: [], // all uploaded sensors (getting via broadcast messages)
    sensorsLoaded: false, // flag to indicate if sensors are loaded
    currentUnit: (localStorage.getItem('currentUnit') || settings?.MAP?.measure || 'pm25').toLowerCase(),
    currentDate: dayISO(), // current selected date
    aqiVersion: (localStorage.getItem('aqiVersion') || 'us'), // AQI calculation version: 'us', 'eu'
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
      this.sensorsLoaded = true;
    },
    clearSensors() {
      this.sensors = [];
      this.sensorsLoaded = false;
    },
    setCurrentUnit(unit) {
      const u = String(unit || '').toLowerCase();
      this.currentUnit = u;
      try { localStorage.setItem('currentUnit', u); } catch {}
    },
    setCurrentDate(date) {
      const d = String(date || dayISO());
      this.currentDate = d;
    },
    setAQIVersion(version) {
      const v = String(version || 'us');
      if (['us', 'eu'].includes(v)) {
        this.aqiVersion = v;
        try { localStorage.setItem('aqiVersion', v); } catch {}
      }
    }
  },
});
