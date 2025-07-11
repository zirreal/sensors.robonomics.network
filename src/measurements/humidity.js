import { toFixed } from "./tools";

export default {
  label: "Hm",
  name: {
    en: "Humidity",
    ru: "Влажность"
  },
  nameshort: {
    en: "Humidity",
    ru: "Влажность"
  },
  unit: "%",
  chartColor: "#6fd3ff",
  range: [0, 30, 40, 60, 70],
  zones: [
    {
      value: 30,
      color: "#ff4d00",
      label: {
        en: "Very dry",
        ru: "Очень сухо"
      }
    },
    {
      value: 40,
      color: "#ff9d00",
      label: {
        en: "Dry",
        ru: "Сухо"
      }
    },
    {
      value: 60,
      color: "#60bc2a",
      label: {
        en: "Comfortable",
        ru: "Комфортно"
      }
    },
    {
      value: 70,
      color: "#12bfcc",
      label: {
        en: "Humid",
        ru: "Влажно"
      }
    },
    {
      color: "#2a5cbc",
      label: {
        en: "Very humid",
        ru: "Очень влажно"
      }
    }
  ],
  calculate: function (v) {
    return toFixed(v);
  },
  description: "Air humidity is a measure of the water vapor content in the atmosphere. The optimal humidity level for comfort and health is in the range of 40% to 60%. High humidity can cause stuffiness, while low humidity can lead to dryness. Measuring humidity is useful for controlling the indoor air climate. The optimal humidity level may vary depending on individual preferences and climatic conditions.",
  recommendations: [
    {
      recsHMText: 'During low outdoor humidity:',
      recsHM: ["Moisturize your skin and mucous membranes.", "Drink an adequate amount of water.", "Avoid prolonged exposure to the sun."
      ],
      recsHMText2: 'During high outdoor humidity:',
      recsHM2: ["Avoid physical activity during hot and humid times of the day.", "Wear lightweight, breathable clothing.", "Protect yourself from direct sunlight.", "Drink an adequate amount of water.", "Seek a cool place and use fans or air conditioning."
      ]
    }
  ]
};