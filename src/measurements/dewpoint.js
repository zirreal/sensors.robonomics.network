export default {
 label: "Dew Point",
  name: {
    en: "Dew point",
    ru: "Точка росы"
  },
  nameshort: {
    en: "Dew point",
    ru: "Точка росы"
  },
  unit: "℃",
  chartColor: "#6fd3ff",
  range: [0, 15, 18, 21, 24],
  zones: [
    {
      value: 10,
      color: "#ff4d00",
      label: {
        en: "Very Dry Air",
        ru: "Очень сухой воздух"
      }
    },
    {
      value: 15,
      color: "#ff9d00",
      label: {
        en: "Dry",
        ru: "Сухо"
      }
    },
    {
      value: 18,
      color: "#60bc2a",
      label: {
        en: "Comfortable",
        ru: "Комфортно"
      }
    },
    {
      value: 21,
      color: "#12bfcc",
      label: {
        en: "Humid",
        ru: "Влажно"
      }
    },
    {
      value: 24,
      color: "#2a5cbc",
      label: {
        en: "High Humidity Level",
        ru: "Высокий уровень влажности"
      }
    },
    {
      color: "#7a00da",
      label: {
        en: "Extremely Humid",
        ru: "Очень влажно"
      }
    }
  ],
}