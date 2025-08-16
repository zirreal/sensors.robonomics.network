import { toFixed } from "./tools";

export default {
  label: "PM2.5",
  name: {
    en: "Particulate matter with diameter ≤ 2.5 µm (PM2.5)",
    ru: "Взвешенные частицы диаметром до 2,5 мкм (PM2.5)"
  },
  nameshort: {
    en: "PM2.5",
    ru: "PM2.5"
  },
  unit: "μg/m3",
  chartColor: "#89b268",
  // colors: ["#76E436", "#01EAEA", "#FDCB24"],
  range: [0, 30, 55, 110, 250],
  zones: [
    {
      value: 30,
      color: "var(--measure-green)",
      label: {
        en: "Good",
        ru: "Хорошо"
      }
    },
    {
      value: 55,
      color: "var(--measure-bluegreen)",
      label: {
        en: "Moderate",
        ru: "Приемлемо"
      }
    },
    {
      value: 110,
      color: "var(--measure-yellow)",
      label: {
        en: "Unhealthy",
        ru: "Вредно для здоровья"
      }
    },
    {
      value: 250,
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
      en: 'PM 2.5 is atmospheric particles with a size of up to 2.5 micrometers, which include dust, soot, and smoke. They can be harmful to health, causing breathing problems, allergies, and cardiovascular diseases. Sources of PM 2.5 include industry, transportation, and household emissions. Monitoring and reducing their levels are important for health and clean air.',
      ru: 'PM 2,5 (взвешенные частицы диаметром до 2,5 мкм) — пыль, сажа, дым и другие мелкие аэрозоли. Они проникают глубоко в лёгкие и могут вызывать затруднённое дыхание, аллергические реакции и сердечно-сосудистые заболевания. Основные источники PM 2,5 — промышленность, транспорт и бытовые выбросы. Контроль и снижение их концентрации важны для здоровья и чистого воздуха.'
    }
  },
  {
    tag: 'subtitle',
    text: {
      en: 'If PM2.5 levels are high, take the following precautions:',
      ru: 'Если уровень PM 2,5 высок, соблюдайте следующие меры предосторожности:'
    }
  },
  {
    tag: 'ul',
    items: {
      en: [
        'Stay indoors with good ventilation.',
        'Avoid outdoor physical activities.',
        'Keep windows and doors closed.',
        'Use face masks with good filtration.',
        'Monitor the air quality forecast.'
      ],
      ru: [
        'Оставайтесь в помещении с хорошей вентиляцией.',
        'Избегайте физических нагрузок на открытом воздухе.',
        'Держите окна и двери закрытыми.',
        'Используйте маски с хорошей фильтрацией.',
        'Следите за прогнозом качества воздуха.'
      ]
    }
  }
]
};
