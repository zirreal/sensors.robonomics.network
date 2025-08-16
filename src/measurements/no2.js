import { converterPpmToMgm3 } from "./tools";

export default {
  label: "NO2",
  name: {
    en: "Nitrogen Dioxide",
    ru: "Диоксид азота"
  },
  unit: "mg/m3",
  chartColor: "#d4dd53",
  // colors: ["var(--measure-green)", "#ff9d00", "#fc0202"],
  range: [0, 1, 5],
  zones: [
    {
      value: 1,
      color: "var(--measure-green)",
      label: {
        en: "Good",
        ru: "Хорошо"
      }
    },
    {
      value: 5,
      color: "var(--measure-yellow)",
      label: {
        en: "Satisfyingly",
        ru: "Удовлетворительно"
      }
    },
    {
      color: "#fc0202",
      label: {
        en: "Poor",
        ru: "Плохо"
      }
    },
  ],
  calculate: function (v) {
    return converterPpmToMgm3(v, 46.01);
  },
  description: "Nitrogen oxide. Poisonous red-brown gas with a sharp unpleasant odor or yellowish liquid. The source is the combustion of various types of fuel. NO2 in the atmosphere can cause acid rain and irritation of mucous membranes. The maximum single concentration is 0.085 mg/m3, the average daily concentration is 0.4 mg/m3."
};
