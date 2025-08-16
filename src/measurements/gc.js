import { toFixed } from "./tools";

export default {
  label: "GC",
  name: {
    en: "Background radiation",
    ru: "Радиационный фон"
  },
  nameshort: {
    en: "Radiation",
    ru: "Радиация"
  },
  unit: "μR/h",
  chartColor: "#e99152",
  range: [0, 10, 60, 100, 200],
  zones: [
    {
      value: 10,
      color: "#03a5ed",
      label: {
        en: "Background",
        ru: "Естественный фон"
      }
    },
    {
      value: 60,
      color: "var(--measure-green)",
      label: {
        en: "Moderate",
        ru: "Невысокая"
      }
    },
    {
      value: 100,
      color: "var(--measure-yellow)",
      label: {
        en: "Elevated",
        ru: "Повышенная"
      }
    },
    {
      value: 200,
      color: "var(--measure-orange)",
      label: {
        en: "High",
        ru: "Высокая"
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
      en: 'Background radiation (gamma radiation) is natural ionising radiation from cosmic rays and terrestrial radionuclides. Typical outdoor levels are around 10–20 µR/h. Short-term exposure to moderate levels is generally harmless, but prolonged exposure above 100 µR/h increases long-term cancer risk.',
      ru: 'Радиационный фон (гамма-излучение) — естественное ионизирующее излучение от космических лучей и природных радионуклидов в почве и породах. Обычный уровень на открытом воздухе составляет 10–20 мкР/ч. Кратковременное пребывание при умеренных значениях обычно безопасно, однако длительное воздействие свыше 100 мкР/ч повышает риск онкологических заболеваний.'
    }
  },
  {
    tag: 'subtitle',
    text: {
      en: 'If radiation levels rise above normal, follow these precautions:',
      ru: 'Если уровень радиации превышает норму, соблюдайте следующие меры:'
    }
  },
  {
    tag: 'ul',
    items: {
      en: [
        'Move indoors or to a shielded area (concrete walls or a basement).',
        'Close windows and vents, set HVAC to recirculation.',
        'Limit the time spent in high-radiation zones.',
        'Monitor official guidance and radiation reports.',
        'Avoid consuming local food and water until levels return to normal.'
      ],
      ru: [
        'Перейдите в помещение или защищённое место (бетонные стены, подвал).',
        'Закройте окна и вентиляционные отверстия, переведите вентиляцию на рециркуляцию.',
        'Сократите время пребывания в зоне повышенного излучения.',
        'Следите за официальными сообщениями и показаниями дозиметров.',
        'Воздержитесь от употребления местных продуктов и воды, пока уровень не нормализуется.'
      ]
    }
  }
]

};
