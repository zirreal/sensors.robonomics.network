export default {
  label: "Pr",
  name: {
    en: "Atmospheric pressure",
    ru: "Атмосферное давление"
  },
  nameshort: {
    en: "Pressure",
    ru: "Давление"
  },
  unit: "mmHg",
  range: [0, 747, 767, 775],
  zones: [
    {
      value: 747,
      color: "#12bfcc",
      label: {
        en: "Very low",
        ru: "Очень низкое давление"
      }
    },
    {
      value: 767,
      color: "#60bc2a",
      label: {
        en: "Normal",
        ru: "Нормальное давление"
      }
    },
    {
      value: 775,
      color: "#ff9d00",
      label: {
        en: "High",
        ru: "Высокое давление"
      }
    },
    {
      color: "#ff4d00",
      label: {
        en: "Very high",
        ru: "Очень высокое давление"
      }
    },
  ],
};
