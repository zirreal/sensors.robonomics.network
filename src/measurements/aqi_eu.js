export default [
  {
    valueMax: 50,
    pm25: { concentrationMin: 0.0, concentrationMax: 10.0 },
    pm10: { concentrationMin: 0, concentrationMax: 20 },
    color: "var(--measure-green)",
    label: {
      en: "Good",
      ru: "Хорошо"
    }
  },
  {
    valueMax: 100,
    pm25: { concentrationMin: 10.1, concentrationMax: 25.0 },
    pm10: { concentrationMin: 21, concentrationMax: 40 },
    color: "var(--measure-bluegreen)",
    label: {
      en: "Moderate",
      ru: "Умеренно"
    }
  },
  {
    valueMax: 150,
    pm25: { concentrationMin: 25.1, concentrationMax: 50.0 },
    pm10: { concentrationMin: 41, concentrationMax: 80 },
    color: "var(--measure-yellow)",
    label: {
      en: "Unhealthy for Sensitive Groups",
      ru: "Вредно для чувствительных групп"
    }
  },
  {
    valueMax: 200,
    pm25: { concentrationMin: 50.1, concentrationMax: 75.0 },
    pm10: { concentrationMin: 81, concentrationMax: 120 },
    color: "var(--measure-orange)",
    label: {
      en: "Unhealthy",
      ru: "Вредно"
    }
  },
  {
    valueMax: 300,
    pm25: { concentrationMin: 75.1, concentrationMax: 100.0 },
    pm10: { concentrationMin: 121, concentrationMax: 200 },
    color: "var(--measure-red)",
    label: {
      en: "Very Unhealthy",
      ru: "Очень вредно"
    }
  },
  {
    valueMax: 500,
    pm25: { concentrationMin: 100.1, concentrationMax: 150.0 },
    pm10: { concentrationMin: 201, concentrationMax: 300 },
    color: "var(--measure-darkred)",
    label: {
      en: "Hazardous",
      ru: "Опасно"
    }
  }
];
