// Проверка датчиков на стабильную работу

// Воздух
/**
 * Проверяет стандартное отклонение и сравнивает с порогом
 * @param {number[]} values - массив значений PM
 * @param {number} threshold - порог std
 * @returns {boolean} - true, если std < threshold
 */
export function checkStdDeviation(values, threshold) {
  if (values.length < 2) return false; // слишком мало данных
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  return std < threshold;
}

/**
 * Проверяет постоянно высокие значения PM (например, 1999, 999)
 * Если большинство значений > 1000, это проблема
 * @param {number[]} values
 * @returns {boolean}
 */
export function checkConstantlyHighValues(values) {
  if (!values || values.length < 3) return false;
  
  const VERY_HIGH_THRESHOLD = 1000; // Порог для "очень высоких" значений
  const MIN_HIGH_RATIO = 0.6; // Если 60%+ значений очень высокие - это проблема
  
  let highCount = 0;
  for (const value of values) {
    if (value >= VERY_HIGH_THRESHOLD) {
      highCount++;
    }
  }
  
  const highRatio = highCount / values.length;
  return highRatio >= MIN_HIGH_RATIO;
}

/**
 * Проверяет паттерн: высокие значения → резкое падение → снова высокие
 * Например: 1999 → 50 → 1999 → 30 → 1999
 * @param {number[]} values
 * @returns {boolean}
 */
export function checkHighLowHighPattern(values) {
  if (!values || values.length < 5) return false;
  
  const VERY_HIGH_THRESHOLD = 1000;
  const LOW_THRESHOLD = 200; // Низкое значение после высокого
  const MIN_PATTERN_COUNT = 2; // Минимум 2 цикла высокое→низкое→высокое
  
  let patternCount = 0;
  let wasHigh = false;
  let wasLow = false;
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    
    if (value >= VERY_HIGH_THRESHOLD) {
      if (wasLow) {
        // Было низкое, стало высокое - это завершение паттерна
        patternCount++;
        wasLow = false;
      }
      wasHigh = true;
    } else if (value <= LOW_THRESHOLD && wasHigh) {
      // Было высокое, стало низкое - начало паттерна
      wasLow = true;
      wasHigh = false;
    } else if (value > LOW_THRESHOLD && value < VERY_HIGH_THRESHOLD) {
      // Средние значения - сбрасываем паттерн
      wasHigh = false;
      wasLow = false;
    }
  }
  
  return patternCount >= MIN_PATTERN_COUNT;
}

/**
 * Проверяет паттерн постоянных резких скачков значений PM
 * Один скачок (например, 700 -> нормальное значение) - это нормально
 * Но если скачки происходят постоянно (паттерн), это проблема
 * @param {number[]} values
 * @returns {boolean}
 */
export function checkInstantJumps(values) {
  if (!values || values.length < 4) return false; // Нужно минимум 4 точки для паттерна
  
  const ZERO_THRESHOLD = 5;
  const MAX_PHYSICAL_PM = 5000;
  const LARGE_VALUE_THRESHOLD = 100; // Порог для "больших" значений
  const MIN_ABSOLUTE_JUMP = 500; // Минимальный абсолютный скачок для больших значений
  const MIN_PERCENT_JUMP = 0.5; // Минимальный процентный скачок (50%) для больших значений
  const MIN_JUMP_COUNT = 3; // Минимум скачков для паттерна (например, 3 из 5 последних)

  // Проверка на постоянно высокие значения (1999, 999)
  if (checkConstantlyHighValues(values)) {
    return true;
  }
  
  // Проверка на паттерн высокое→низкое→высокое
  if (checkHighLowHighPattern(values)) {
    return true;
  }

  let jumpCount = 0;
  let totalChecks = 0;

  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1];
    const b = values[i];
    
    // Проверка на отрицательные значения
    if (a < 0 || b < 0) return true;
    
    // Проверка на физически невозможные значения
    if (a > MAX_PHYSICAL_PM || b > MAX_PHYSICAL_PM) return true;
    
    // Проверка на скачки от нуля к большому значению или наоборот
    if ((a < ZERO_THRESHOLD && b > 100) || (b < ZERO_THRESHOLD && a > 100)) {
      jumpCount++;
      totalChecks++;
      continue;
    }
    
    // Проверка на очень большие скачки только для больших значений
    // Например: 1000 -> 100, 1999 -> 900
    if (a >= LARGE_VALUE_THRESHOLD || b >= LARGE_VALUE_THRESHOLD) {
      totalChecks++;
      const jump = Math.abs(a - b);
      const maxValue = Math.max(a, b);
      
      // Проверяем абсолютный скачок (например, 1000 -> 100 = 900 единиц)
      if (jump >= MIN_ABSOLUTE_JUMP) {
        // Проверяем процентный скачок (например, 1000 -> 100 = 90% падение)
        const percentJump = jump / maxValue;
        if (percentJump >= MIN_PERCENT_JUMP) {
          jumpCount++;
        }
      }
    }
  }

  // Если было достаточно проверок и много скачков - это паттерн проблемы
  // Например, если из 5 проверок 3+ были большими скачками
  if (totalChecks >= 3 && jumpCount >= MIN_JUMP_COUNT) {
    // Проверяем процент скачков от общего числа проверок
    const jumpRatio = jumpCount / totalChecks;
    // Если больше 50% проверок показали большие скачки - это проблема
    if (jumpRatio >= 0.5) {
      return true;
    }
  }

  return false;
}

/**
 * Проверяет, что отношение PM2.5/PM10 слишком низкое (<0.05) в большинстве часов
 */
export function checkLowRatio(pm25Values, pm10Values) {
  const hours = pm25Values.length;
  if (hours < 1) return false;
  let count = 0;
  for (let i = 0; i < hours; i++) {
    if (pm10Values[i] > 0) {
      const ratio = pm25Values[i] / pm10Values[i];
      if (ratio < 0.05) count++;
    }
  }
  return count / hours > 0.8;
}

/**
 * Проверяет невозможную ситуацию, когда PM2.5 > PM10 в более чем 10% измерений
 */
export function checkImpossiblePM(pm25Values, pm10Values) {
  const len = pm25Values.length;
  if (len < 1) return false;
  let count = 0;
  for (let i = 0; i < len; i++) {
    if (pm25Values[i] > pm10Values[i]) count++;
  }
  return count / len > 0.1;
}

/**
 * Проверяет, что PM2.5 почти всегда = 0 (≥80% измерений за минимум 10 часов)
 * @param {number[]} pm25Values
 * @returns {boolean}
 */
export function checkAlwaysZeroPM25(pm25Values) {
  const MIN_HOURS = 10;
  const THRESHOLD = 0.8;

  if (pm25Values.length < MIN_HOURS) return false;

  let count = 0;
  for (let v of pm25Values) {
    if (v < 1) count++;
  }
  return count / pm25Values.length >= THRESHOLD;
}


// Температура и влажность
/**
 * Проверяет, что RH = 100% больше 8 часов подряд
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 */
export function checkRH100ForTooLong(logArr) {
  const EIGHT_HOURS = 8 * 3600; // секунды
  if (!logArr || logArr.length < 2) return false;

  const sortedLogs = [...logArr].sort((a, b) => a.timestamp - b.timestamp);
  
  let consecutive100Start = null;
  let consecutive100End = null;

  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    const rh = log?.data?.humidity;
    
    if (rh !== undefined && rh !== null && rh >= 100) {
      if (consecutive100Start === null) {
        consecutive100Start = log.timestamp;
      }
      consecutive100End = log.timestamp;
    } else {
      // Если был период с RH=100, проверяем его длительность
      if (consecutive100Start !== null && consecutive100End !== null) {
        const duration = consecutive100End - consecutive100Start;
        if (duration >= EIGHT_HOURS) {
          return true;
        }
      }
      consecutive100Start = null;
      consecutive100End = null;
    }
  }

  // Проверяем последний период (если он еще не закончился)
  if (consecutive100Start !== null && consecutive100End !== null) {
    const duration = consecutive100End - consecutive100Start;
    if (duration >= EIGHT_HOURS) {
      return true;
    }
  }

  return false;
}

/**
 * Проверяет, что RH и T не меняются вообще в течение 5 часов
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 */
export function checkNoChangeInRHAndT(logArr) {
  const FIVE_HOURS = 5 * 3600; // секунды
  if (!logArr || logArr.length < 2) return false;

  const now = Math.max(...logArr.map(d => d.timestamp));
  const last5h = logArr
    .filter(d => now - d.timestamp <= FIVE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last5h.length < 2) return false;

  const rhValues = last5h.map(d => d?.data?.humidity).filter(v => v !== undefined && v !== null);
  const tValues = last5h.map(d => d?.data?.temperature).filter(v => v !== undefined && v !== null);

  if (rhValues.length < 2 || tValues.length < 2) return false;

  // Проверяем, что все значения одинаковые (или почти одинаковые с учетом погрешности)
  const rhFirst = rhValues[0];
  const tFirst = tValues[0];
  const EPSILON = 0.01; // погрешность для сравнения

  const rhAllSame = rhValues.every(v => Math.abs(v - rhFirst) < EPSILON);
  const tAllSame = tValues.every(v => Math.abs(v - tFirst) < EPSILON);

  return rhAllSame && tAllSame;
}

/**
 * Проверяет резкие скачки RH (60 → 20 → 65 → 25 мгновенно)
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 */
export function checkRHInstantJumps(logArr) {
  if (!logArr || logArr.length < 3) return false;

  const now = Math.max(...logArr.map(d => d.timestamp));
  const FIVE_HOURS = 5 * 3600;
  const last5h = logArr
    .filter(d => now - d.timestamp <= FIVE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last5h.length < 3) return false;

  const rhValues = last5h.map(d => d?.data?.humidity).filter(v => v !== undefined && v !== null);
  if (rhValues.length < 3) return false;

  const JUMP_THRESHOLD = 30; // порог для резкого скачка (например, 60 → 20 = 40)

  for (let i = 1; i < rhValues.length; i++) {
    const prev = rhValues[i - 1];
    const curr = rhValues[i];
    const jump = Math.abs(curr - prev);

    if (jump > JUMP_THRESHOLD) {
      // Проверяем, что это действительно резкий скачок туда-сюда
      if (i >= 2) {
        const prev2 = rhValues[i - 2];
        const jump1 = Math.abs(prev - prev2);
        const jump2 = Math.abs(curr - prev);
        // Если есть паттерн: большое изменение → большое изменение в обратную сторону
        if (jump1 > JUMP_THRESHOLD && jump2 > JUMP_THRESHOLD) {
          return true;
        }
      }
    }
  }

  return false;
}

// Шум
/**
 * Проверяет, что noise AVG и noise MAX одинаковые в течение 5 часов и больше
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 */
export function checkNoiseAvgMaxSame(logArr) {
  const FIVE_HOURS = 5 * 3600; // секунды
  if (!logArr || logArr.length < 2) return false;

  const now = Math.max(...logArr.map(d => d.timestamp));
  const last5h = logArr
    .filter(d => now - d.timestamp <= FIVE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last5h.length < 2) return false;

  let sameCount = 0;
  const EPSILON = 0.1; // погрешность для сравнения

  for (const log of last5h) {
    const avg = log?.data?.noiseavg;
    const max = log?.data?.noisemax;
    if (avg !== undefined && avg !== null && max !== undefined && max !== null) {
      if (Math.abs(avg - max) < EPSILON) {
        sameCount++;
      }
    }
  }

  // Если в течение 5 часов все или почти все значения одинаковые
  return sameCount >= last5h.length * 0.9; // 90% записей
}

/**
 * Проверяет, что Noise max < 35 и avg < 20 в течение 3 часов и больше
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 */
export function checkNoiseTooLow(logArr) {
  const THREE_HOURS = 3 * 3600; // секунды
  if (!logArr || logArr.length < 2) return false;

  const now = Math.max(...logArr.map(d => d.timestamp));
  const last3h = logArr
    .filter(d => now - d.timestamp <= THREE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last3h.length < 2) return false;

  let lowCount = 0;

  for (const log of last3h) {
    const avg = log?.data?.noiseavg;
    const max = log?.data?.noisemax;
    if (avg !== undefined && avg !== null && max !== undefined && max !== null) {
      if (max < 35 && avg < 20) {
        lowCount++;
      }
    }
  }

  // Если в течение 3 часов все или почти все значения слишком низкие
  return lowCount >= last3h.length * 0.9; // 90% записей
}

/**
 * Проверяет, что значения шума не меняются в диапазоне больше 3 часов
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 * @note Диапазон RANGE_THRESHOLD может потребовать уточнения
 */
export function checkNoiseNoChange(logArr) {
  const THREE_HOURS = 3 * 3600; // секунды
  if (!logArr || logArr.length < 2) return false;

  const now = Math.max(...logArr.map(d => d.timestamp));
  const last3h = logArr
    .filter(d => now - d.timestamp <= THREE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last3h.length < 2) return false;

  // Используем noiseavg или noisemax (приоритет noiseavg)
  const noiseValues = last3h
    .map(d => d?.data?.noiseavg ?? d?.data?.noisemax)
    .filter(v => v !== undefined && v !== null);

  if (noiseValues.length < 2) return false;

  // TODO: Диапазон может потребовать уточнения - пользователь проверит
  const RANGE_THRESHOLD = 10; // значения не меняются больше чем на 1 единицу

  // Проверяем, что все значения в узком диапазоне
  const min = Math.min(...noiseValues);
  const max = Math.max(...noiseValues);
  const range = max - min;

  return range <= RANGE_THRESHOLD;
}

/**
 * Проверяет стабильность PM за последние 5 часов
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {Object} - результаты всех проверок
 */
export function checkStability(logArr) {
  if (!logArr || logArr.length < 2) return {};

  const FIVE_HOURS = 5 * 3600; // секунды
  const now = Math.max(...logArr.map(d => d.timestamp));
  const last5h = logArr.filter(d => now - d.timestamp <= FIVE_HOURS);

  const pm25Values = last5h.map(d => d.data.pm25);
  const pm10Values = last5h.map(d => d.data.pm10);

  return {
    stableStd: checkStdDeviation(pm25Values, 0.5) && checkStdDeviation(pm10Values, 1),
    instantJumps: checkInstantJumps(pm25Values) || checkInstantJumps(pm10Values),
    lowRatio: checkLowRatio(pm25Values, pm10Values),
    impossiblePM: checkImpossiblePM(pm25Values, pm10Values),
    alwaysZeroPM25: checkAlwaysZeroPM25(pm25Values)
  };
}

/**
 * Проверяет стабильность температуры и влажности
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {Object} - результаты всех проверок
 */
export function checkClimateStability(logArr) {
  if (!logArr || logArr.length < 2) return {};

  return {
    rh100TooLong: checkRH100ForTooLong(logArr),
    noChange: checkNoChangeInRHAndT(logArr),
    instantJumps: checkRHInstantJumps(logArr)
  };
}

/**
 * Проверяет стабильность шума
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {Object} - результаты всех проверок
 */
export function checkNoiseStability(logArr) {
  if (!logArr || logArr.length < 2) return {};

  return {
    avgMaxSame: checkNoiseAvgMaxSame(logArr),
    tooLow: checkNoiseTooLow(logArr),
    noChange: checkNoiseNoChange(logArr)
  };
}

/**
 * Проверяет стабильность всех типов данных и возвращает dataHealth для каждой категории
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {Object} - объект с dataHealth для каждой категории (pm, climate, noise)
 */
export function checkAllDataHealth(logArr) {
  if (!logArr || logArr.length < 2) {
    return {
      pm: { healthy: true, checks: {} },
      climate: { healthy: true, checks: {} },
      noise: { healthy: true, checks: {} }
    };
  }

  const pmChecks = checkStability(logArr);
  const climateChecks = checkClimateStability(logArr);
  const noiseChecks = checkNoiseStability(logArr);

  return {
    pm: {
      healthy: !Object.values(pmChecks).some(v => v === true),
      checks: pmChecks
    },
    climate: {
      healthy: !Object.values(climateChecks).some(v => v === true),
      checks: climateChecks
    },
    noise: {
      healthy: !Object.values(noiseChecks).some(v => v === true),
      checks: noiseChecks
    }
  };
}
