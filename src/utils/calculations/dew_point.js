/**
 * =============================================================================
 *
 *     Функции для расчета точки росы
 *
 *     Точка росы - это температура, при которой водяной пар в воздухе
 *     начинает конденсироваться в жидкую воду.
 *
 *     Формула Магнуса-Тетенса:
 *     Td = (b * γ) / (a - γ)
 *     где γ = (a * T) / (b + T) + ln(RH/100)
 *
 *     где:
 *     - Td - точка росы в °C
 *     - T - температура в °C
 *     - RH - относительная влажность в %
 *     - a = 17.27
 *     - b = 237.7
 *
 * =============================================================================
 */

/**
 * Вычисляет точку росы по температуре и влажности
 * @param {number} temperature - Температура в градусах Цельсия
 * @param {number} humidity - Влажность в процентах (0-100)
 * @returns {number|null} Точка росы в градусах Цельсия или null при неверных данных
 */
export const calculateDewPoint = (temperature, humidity) => {
  if (
    typeof temperature !== "number" ||
    typeof humidity !== "number" ||
    humidity <= 0 ||
    humidity > 100
  ) {
    return null;
  }

  const a = 17.27;
  const b = 237.7;
  const gamma = (a * temperature) / (b + temperature) + Math.log(humidity / 100);
  const dewPoint = (b * gamma) / (a - gamma);

  return parseFloat(dewPoint.toFixed(2));
};

/**
 * Обогащает данные сенсора точкой росы, если доступны температура и влажность
 * @param {Object} data - Объект с данными сенсора
 * @returns {Object} Обогащенные данные с точкой росы (если возможно)
 */
export const enrichWithDewPoint = (data) => {
  if (data && typeof data.temperature === "number" && typeof data.humidity === "number") {
    const dew = calculateDewPoint(data.temperature, data.humidity);
    if (dew !== null) {
      return { ...data, dewpoint: dew };
    }
  }
  return data;
};

/**
 * Обогащает массив логов данными о точке росы
 * @param {Array} logArr - Массив логов сенсора
 */
export const enrichLogsWithDewPoint = (logArr) => {
  if (!Array.isArray(logArr)) return;

  logArr.forEach((entry) => {
    if (entry?.data) {
      entry.data = enrichWithDewPoint(entry.data);
    }
  });
};
