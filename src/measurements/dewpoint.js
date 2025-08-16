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
      color: "var(--measure-orange)",
      label: {
        en: "Very Dry Air",
        ru: "Очень сухой воздух"
      }
    },
    {
      value: 15,
      color: "var(--measure-yellow)",
      label: {
        en: "Dry",
        ru: "Сухо"
      }
    },
    {
      value: 18,
      color: "var(--measure-green)",
      label: {
        en: "Comfortable",
        ru: "Комфортно"
      }
    },
    {
      value: 21,
      color: "var(--measure-bluegreen)",
      label: {
        en: "Humid",
        ru: "Влажно"
      }
    },
    {
      value: 24,
      color: "var(--measure-blue)",
      label: {
        en: "High Humidity Level",
        ru: "Высокий уровень влажности"
      }
    },
    {
      color: "var(--measure-darkblue)",
      label: {
        en: "Extremely Humid",
        ru: "Очень влажно"
      }
    }
  ],
}