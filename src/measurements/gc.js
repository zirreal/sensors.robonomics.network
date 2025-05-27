export default {
  label: "GC",
  name: {
    en: "Background radiation",
    ru: "Радиационный фон"
  },
  nameshort: {
    en: "Radiation",
    ru: "Радиация"
  },
  unit: "μR/h",
  chartColor: "#e99152",
  range: [10, 100, 1000],
  zones: [
    {
      value: 10,
      color: "#03a5ed",
      label: {
        en: "Background",
        ru: "Естественный фон"
      }
    },
    {
      value: 60,
      color: "#60bc2a",
      label: {
        en: "Moderate",
        ru: "Невысокая"
      }
    },
    {
      value: 100,
      color: "#ff9d00",
      label: {
        en: "Elevated",
        ru: "Повышенная"
      }
    },
    {
      value: 200,
      color: "#ff4d00",
      label: {
        en: "High",
        ru: "Высокая"
      }
    },
    {
      color: "#7a00da",
      label: {
        en: "Unacceptable",
        ru: "Неприемлемо"
      }
    },
  ],
};
