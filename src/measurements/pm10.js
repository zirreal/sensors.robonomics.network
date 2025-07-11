import { toFixed } from "./tools";

export default {
  label: "PM10",
  name: {
    en: "Particulate matter with diameter ≤ 10 µm (PM10)",
    ru: "Взвешенные частицы диаметром до 10 мкм (PM10)"
  },
  nameshort: {
    en: "PM10",
    ru: "PM10"
  },
  unit: "μg/m3",
  chartColor: "#e8b738",
  colors: ["#60bc2a", "#ff9d00", "#fc0202"],
  range: [0, 50, 100, 250, 350],
  zones: [
    {
      value: 50,
      color: "#60bc2a",
      label: {
        en: "Good",
        ru: "Хорошо"
      }
    },
    {
      value: 100,
      color: "#12bfcc",
      label: {
        en: "Satisfyingly",
        ru: "Приемлемо"
      }
    },
    {
      value: 250,
      color: "#ff9d00",
      label: {
        en: "Unhealthy",
        ru: "Вредно для здоровья"
      }
    },
    {
      value: 350,
      color: "#ff4d00",
      label: {
        en: "Very Unhealthy",
        ru: "Очень вредно для здоровья"
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
  },
  info: "PM10 - suspended particles (PM - particulate matter) of a substance with a diameter of less than 10 micrometers (μm). Pollen and other allergens.",
  description: "PM 10 (Particulate Matter 10) consists of atmospheric particles with a size of up to 10 micrometers, including dust, soot, and other pollutants. They can cause health problems by affecting breathing and contributing to respiratory diseases. Sources of PM 10 include industrial emissions, road dust, and fuel combustion. Monitoring and reducing PM 10 levels are important for maintaining clean air and promoting health.",
  recommendations: [
    {
      recsPM10Text: 'In case of elevated levels of PM 10, it is recommended to take the following measures:',
      recsPM10: ["Limit the time spent outdoors.", "Avoid physical activities, especially for individuals with respiratory problems.", "Close windows and doors to reduce the entry of polluted air into indoor spaces.", "Use masks with good filtration when necessary.", "Monitor information about air quality and follow recommendations from local health authorities.",
      ]
    }
  ]
};
