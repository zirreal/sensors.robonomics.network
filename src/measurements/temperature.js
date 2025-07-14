import { toFixed } from "./tools";

export default {
  label: "Tmp",
  name: {
    en: "Temperature",
    ru: "Температура"
  },
  nameshort: {
    en: "Temperature",
    ru: "Температура"
  },
  unit: "℃",
  chartColor: "#2d7ac7",
  colors: ["#fc0202", "#ff9d00", "#60bc2a", "#ff9d00", "#fc0202"],
  range: [-9, 1, 10, 25],
  zones: [
    {
      value: -9,
      color: "#7a00da",
      label: {
        en: "Very cold",
        ru: "Очень холодно"
      }
    },
    {
      value: 1,
      color: "#2a5cbc",
      label: {
        en: "Cold",
        ru: "Холодно"
      }
    },
    {
      value: 10,
      color: "#03a5ed",
      label: {
        en: "Cool",
        ru: "Прохладно"
      }
    },
    {
      value: 25,
      color: "#60bc2a",
      label: {
        en: "Warm",
        ru: "Тепло"
      }
    },
    {
      color: "#ff9d00",
      label: {
        en: "Hot",
        ru: "Жарко"
      }
    }
  ],
  states: ["danger", "attention", "good", "attention", "danger", "neutral"],
  calculate: function (v) {
    return toFixed(v);
  },
  info: "Показатель температуры воздуха. Зоны: ≤ -9 ℃ — очень холодно; −9…1 ℃ — холодно; 1…10 ℃ — прохладно; 10…25 ℃ — тепло; >25 ℃ — жарко.",
  description: "'Tmp' in the context of outdoor air indicators usually refers to air temperature. It is a measurable parameter that determines the thermal conditions of the environment. Air temperature can vary depending on the season and geographic location, influencing the comfort of being outdoors and requiring appropriate clothing and protection.",
  recommendations: [
    {
      recsTMPText: 'During very cold temperatures:',
      recsTMP: ["Wear warm clothing and accessories to prevent frostbite.", "Avoid prolonged exposure outdoors and stay in warm spaces."
      ],
      recsTMPText2: 'During very hot temperatures:',
      recsTMP2: ["Wear lightweight clothing and a hat for sun protection.", "Drink an adequate amount of water to avoid dehydration.", "Avoid direct sunlight during peak heat hours and seek a cool place if signs of heatstroke appear."
      ]
    }
  ]
};
