import { toFixed } from "./tools";

export default {
  label: "EXAMPLE", // ! Required field. Short label for the measurement
  // Optional field for more human-readable description with localization
  name: {
    en: "Example Measurement",
    ru: "Пример измерения"
  },
  nameshort: {
    en: "Example",
    ru: "Пример"
  },
  unit: "units", // ! Required field. Unit of measurement
  zones: [
    {
      valueMax: 50, // Upper threshold for this zone
      color: "var(--measure-green)", // CSS variable for color
      label: {
        en: "Good",
        ru: "Хорошо"
      }
    },
    {
      valueMax: 100, // Next threshold
      color: "var(--measure-yellow)",
      label: {
        en: "Moderate", 
        ru: "Умеренно"
      }
    },
    {
      // Last zone without valueMax (unlimited)
      color: "var(--measure-red)",
      label: {
        en: "Poor",
        ru: "Плохо"
      }
    }
  ],
  calculate: function (v) {
    // Value transformation, e.g. for unit conversion, only for realtime data
    // Return processed value or use toFixed(v) for simple rounding
    return toFixed(v);
  },
  description: [
    {
      tag: 'p', // Paragraph tag
      text: {
        en: 'This is an example measurement description. Explain what this measurement represents and why it\'s important for air quality monitoring.',
        ru: 'Это пример описания измерения. Объясните, что представляет собой это измерение и почему оно важно для мониторинга качества воздуха.'
      }
    },
    {
      tag: 'subtitle', // Subtitle tag
      text: {
        en: 'If levels are high, take the following precautions:',
        ru: 'Если уровень высок, соблюдайте следующие меры предосторожности:'
      }
    },
    {
      tag: 'ul', // Unordered list tag
      items: {
        en: [
          'First recommendation',
          'Second recommendation', 
          'Third recommendation'
        ],
        ru: [
          'Первая рекомендация',
          'Вторая рекомендация',
          'Третья рекомендация'
        ]
      }
    }
  ]
};
