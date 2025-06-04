import { toFixed } from "./tools";

export default {
  label: "CO2",
  name: {
    en: "Carbon Dioxide",
    ru: "Углекислый газ"
  },
  nameshort: {
    en: "CO₂",
    ru: "CO₂"
  },
  unit: "ppm",
  chartColor: "#76c7c0",
  range: [0, 400, 1000, 2000, 5000],
  zones: [
    {
      value: 400,
      color: "#03a5ed",
      label: {
        en: "Background",
        ru: "Фоновый"
      }
    },
    {
      value: 1000,
      color: "#60bc2a",
      label: {
        en: "Moderate",
        ru: "Умеренный"
      }
    },
    {
      value: 2000,
      color: "#ff9d00",
      label: {
        en: "Elevated",
        ru: "Повышенный"
      }
    },
    {
      value: 5000,
      color: "#ff4d00",
      label: {
        en: "High",
        ru: "Высокий"
      }
    },
    {
      color: "#7a00da",
      label: {
        en: "Unacceptable",
        ru: "Неприемлемо"
      }
    }
  ],
  calculate: function (v) {
    return toFixed(v);
  }
};