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
  // colors: ["#76E436", "#01EAEA", "#FDCB24"],
  range: [0, 50, 100, 250, 350],
  zones: [
    {
      value: 50,
      color: "var(--measure-green)",
      label: {
        en: "Good",
        ru: "Хорошо"
      }
    },
    {
      value: 100,
      color: "var(--measure-bluegreen)",
      label: {
        en: "Moderate",
        ru: "Приемлемо"
      }
    },
    {
      value: 250,
      color: "var(--measure-yellow)",
      label: {
        en: "Unhealthy",
        ru: "Вредно для здоровья"
      }
    },
    {
      value: 350,
      color: "var(--measure-orange)",
      label: {
        en: "Very Unhealthy",
        ru: "Очень вредно для здоровья"
      }
    },
    {
      color: "var(--measure-red)",
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
        en: 'PM 10 (Particulate Matter 10) consists of atmospheric particles with a size of up to 10 µm, including dust, soot and other pollutants. They can cause health problems by affecting breathing and contributing to respiratory diseases. Sources include industrial emissions, road dust and fuel combustion.',
        ru: 'PM 10 (взвешенные частицы до 10 мкм) — пыль, сажа и другие аэрозоли. Частицы проникают в дыхательные пути и вызывают болезни органов дыхания. Основные источники — промышленные выбросы, дорожная пыль и сгорание топлива.'
      }
    },
    {
      tag: 'subtitle',
      text: {
        en: 'If PM10 levels are high, take the following precautions:',
        ru: 'При повышенном уровне PM 10 рекомендуется:'
      }
    },
    {
      tag: 'ul',
      items: {
        en: [
          'Limit the time spent outdoors.',
          'Avoid intense physical activity, especially for people with respiratory problems.',
          'Keep windows and doors closed to reduce indoor pollution.',
          'Use well-filtering masks if necessary.',
          'Monitor air-quality information and heed local health-authority advice.'
        ],
        ru: [
          'Сократите время пребывания на улице.',
          'Избегайте активных нагрузок, особенно при заболеваниях органов дыхания.',
          'Держите окна и двери закрытыми, чтобы снизить попадание загрязнённого воздуха внутрь.',
          'При необходимости используйте маски с хорошей фильтрацией.',
          'Следите за данными о качестве воздуха и рекомендациями местных органов здравоохранения.'
        ]
      }
    }
  ]
};
