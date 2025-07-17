import { toFixed } from "./tools";

export default {
  label: "CO2",
  name: {
    en: "Carbon Dioxide",
    ru: "Углекислый газ"
  },
  nameshort: {
    en: "CO₂",
    ru: "CO₂"
  },
  unit: "ppm",
  chartColor: "#76c7c0",
  range: [0, 400, 1000, 2000, 5000],
  zones: [
    {
      value: 400,
      color: "#03a5ed",
      label: {
        en: "Background",
        ru: "Фоновый"
      }
    },
    {
      value: 1000,
      color: "#60bc2a",
      label: {
        en: "Moderate",
        ru: "Умеренный"
      }
    },
    {
      value: 2000,
      color: "#ff9d00",
      label: {
        en: "Elevated",
        ru: "Повышенный"
      }
    },
    {
      value: 5000,
      color: "#ff4d00",
      label: {
        en: "High",
        ru: "Высокий"
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
  description: [
  {
    tag: 'p',
    text: {
      en: 'Carbon dioxide (CO₂) is a colourless, odourless gas naturally present outdoors at about 400 ppm and produced indoors by breathing, combustion and some appliances. Concentrations above 1 000 ppm indicate insufficient ventilation and can lead to drowsiness, headaches and reduced concentration. Good CO₂ control is a reliable proxy for fresh-air supply and overall indoor-air quality.',
      ru: 'Углекислый газ (CO₂) — бесцветный и без запаха; на улице его фоновая концентрация около 400 ppm. В помещениях уровень CO₂ быстро растёт из-за дыхания людей, горения и бытовых приборов. Превышение 1 000 ppm сигнализирует о плохой вентиляции и может вызывать сонливость, головную боль и снижение концентрации внимания. Поддержание низкого CO₂ — ключевой показатель достаточного притока свежего воздуха и качества внутренней среды.'
    }
  },
  {
    tag: 'subtitle',
    text: {
      en: 'If CO₂ levels are high, take the following precautions:',
      ru: 'Если уровень CO₂ высок, соблюдайте следующие меры предосторожности:'
    }
  },
  {
    tag: 'ul',
    items: {
      en: [
        'Increase ventilation by fully opening windows or switching on mechanical/HRV systems.',
        'Take regular breaks outdoors to get fresh air.',
        'Reduce the number of people or the time they spend in the room.',
        'Avoid activities that add extra CO₂, such as intense exercise or burning candles.',
        'Watch the CO₂ monitor and ventilate again whenever the reading exceeds 1 000 ppm.'
      ],
      ru: [
        'Усилите вентиляцию: полностью откройте окна или включите приточно-вытяжную систему.',
        'Регулярно выходите на свежий воздух и делайте перерывы.',
        'Сократите число людей и время пребывания в комнате.',
        'Избегайте действий, повышающих CO₂ (интенсивные тренировки, горящие свечи и т. д.).',
        'Следите за датчиком CO₂ и проветривайте помещение, когда показания превышают 1 000 ppm.'
      ]
    }
  }
]
};