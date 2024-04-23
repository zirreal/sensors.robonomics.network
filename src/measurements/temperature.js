import { toFixed } from "./tools";

export default {
  label: "Tmp",
  unit: "℃",
  icon: "temperature-high",
  chartColor: "#2d7ac7",
  colors: ["#fc0202", "#ff9d00", "#60bc2a", "#ff9d00", "#fc0202"],
  range: [-10, 0, 10, 25],
  zones: [
    {
      value: -9,
      color: "#7a00da",
    },
    {
      value: 0,
      color: "#2a5cbc",
    },
    {
      value: 10,
      color: "#03a5ed",
    },
    {
      value: 25,
      color: "#60bc2a",
    },
    {
      color: "#ff9d00",
    },
  ],
  states: ["danger", "attention", "good", "attention", "danger", "neutral"],
  calculate: function (v) {
    return toFixed(v);
  },
  info: "Показатель температуры воздуха",
};
