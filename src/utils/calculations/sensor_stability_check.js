// Проверка датчиков на стабильную работу

// Воздух
/**
 * Проверяет, что значения слишком стабильны (залипли) - std слишком маленькое
 * Это может означать, что датчик застрял на одном значении
 * @param {number[]} values - массив значений PM
 * @param {number} threshold - порог std (слишком маленькое отклонение = проблема)
 * @returns {boolean} - true, если std < threshold (данные слишком стабильны)
 */
export function checkStdDeviation(values, threshold) {
  if (values.length < 3) return false; // слишком мало данных для проверки
  
  // Фильтруем нулевые значения - они не считаются "залипшими"
  const nonZeroValues = values.filter(v => v !== undefined && v !== null && v > 0);
  if (nonZeroValues.length < 3) return false;
  
  const mean = nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length;
  const variance = nonZeroValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nonZeroValues.length;
  const std = Math.sqrt(variance);
  
  // Проверяем, что std слишком маленькое И среднее значение не нулевое
  // Это означает, что значения "залипли" на одном числе
  return std < threshold && mean > 1;
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
  const MIN_JUMP_COUNT = 3; // Минимум скачков для паттерна

  // Проверка на постоянно высокие значения (1999, 999)
  const VERY_HIGH_THRESHOLD = 1000;
  const MIN_HIGH_RATIO = 0.7; // Если 70%+ значений очень высокие - это проблема
  let highCount = 0;
  for (const value of values) {
    if (value >= VERY_HIGH_THRESHOLD) {
      highCount++;
    }
  }
  if (highCount / values.length >= MIN_HIGH_RATIO) {
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
    // Если больше 60% проверок показали большие скачки - это проблема
    if (jumpRatio >= 0.6) {
      return true;
    }
  }

  return false;
}

/**
 * Проверяет, что отношение PM2.5/PM10 слишком низкое (<0.05) в большинстве часов
 * Учитывает, что в некоторых условиях это может быть нормально
 */
export function checkLowRatio(pm25Values, pm10Values) {
  const hours = pm25Values.length;
  if (hours < 3) return false; // Нужно минимум 3 часа для проверки
  
  let count = 0;
  let validPairs = 0;
  
  for (let i = 0; i < hours; i++) {
    if (pm10Values[i] > 0 && pm25Values[i] !== undefined && pm25Values[i] !== null) {
      validPairs++;
      const ratio = pm25Values[i] / pm10Values[i];
      if (ratio < 0.05) count++;
    }
  }
  
  if (validPairs < 3) return false;
  
  // Требуем 90%+ случаев с низким ratio - более строгая проверка
  // И только если PM10 достаточно высокий (не нулевой шум)
  const avgPM10 = pm10Values.filter(v => v > 0).reduce((a, b) => a + b, 0) / pm10Values.filter(v => v > 0).length;
  if (avgPM10 < 5) return false; // Если PM10 в среднем очень низкий, ratio может быть низким естественно
  
  return count / validPairs > 0.9;
}

/**
 * Проверяет невозможную ситуацию, когда PM2.5 > PM10
 * Учитывает погрешность измерений - небольшие отклонения нормальны
 */
export function checkImpossiblePM(pm25Values, pm10Values) {
  const len = pm25Values.length;
  if (len < 3) return false; // Нужно минимум 3 измерения
  
  const ERROR_MARGIN = 5; // Погрешность измерений (5 единиц)
  let count = 0;
  let validPairs = 0;
  
  for (let i = 0; i < len; i++) {
    if (pm25Values[i] !== undefined && pm25Values[i] !== null && 
        pm10Values[i] !== undefined && pm10Values[i] !== null) {
      validPairs++;
      // Учитываем погрешность - если PM2.5 больше PM10 более чем на погрешность
      if (pm25Values[i] > pm10Values[i] + ERROR_MARGIN) {
        count++;
      }
    }
  }
  
  if (validPairs < 3) return false;
  
  // Требуем 20%+ случаев - более строгая проверка
  return count / validPairs > 0.2;
}

/**
 * Проверяет, что PM2.5 почти всегда = 0 (залип на нуле)
 * Учитывает, что в чистом воздухе это может быть нормально
 * @param {number[]} pm25Values
 * @returns {boolean}
 */
export function checkAlwaysZeroPM25(pm25Values) {
  const MIN_HOURS = 10;
  const THRESHOLD = 0.9; // Требуем 90%+ - более строгая проверка

  if (pm25Values.length < MIN_HOURS) return false;

  let zeroCount = 0;
  let totalCount = 0;
  
  for (let v of pm25Values) {
    if (v !== undefined && v !== null) {
      totalCount++;
      if (v < 1) zeroCount++;
    }
  }
  
  if (totalCount < MIN_HOURS) return false;
  
  // Проверяем, что PM2.5 действительно залип на нуле
  // Если есть хотя бы несколько ненулевых значений, это нормально
  const nonZeroCount = totalCount - zeroCount;
  if (nonZeroCount >= 2) return false; // Если есть хотя бы 2 ненулевых значения, это не залип
  
  return zeroCount / totalCount >= THRESHOLD;
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
    // Проверка на "залипшие" значения - слишком маленькое отклонение
    // Увеличиваем пороги: PM2.5 < 0.3, PM10 < 0.5 
    stableStd: checkStdDeviation(pm25Values, 0.3) && checkStdDeviation(pm10Values, 0.5),
    instantJumps: checkInstantJumps(pm25Values) || checkInstantJumps(pm10Values),
    lowRatio: checkLowRatio(pm25Values, pm10Values),
    impossiblePM: checkImpossiblePM(pm25Values, pm10Values),
    alwaysZeroPM25: checkAlwaysZeroPM25(pm25Values)
  };
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
  if (!logArr || logArr.length < 5) return false; // Нужно минимум 5 записей

  const now = Math.max(...logArr.map(d => d.timestamp));
  const last5h = logArr
    .filter(d => now - d.timestamp <= FIVE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last5h.length < 5) return false;

  let sameCount = 0;
  let validCount = 0;
  const EPSILON = 0.5; // погрешность для сравнения 

  for (const log of last5h) {
    const avg = log?.data?.noiseavg;
    const max = log?.data?.noisemax;
    if (avg !== undefined && avg !== null && max !== undefined && max !== null) {
      validCount++;
      // Проверяем, что они почти одинаковые (с учетом погрешности)
      if (Math.abs(avg - max) < EPSILON) {
        sameCount++;
      }
    }
  }

  if (validCount < 5) return false;

  // Требуем 90%+ одинаковых значений
  // Если почти все значения одинаковые - это проблема
  return sameCount / validCount >= 0.9 && validCount >= 5;
}

/**
 * Проверяет, что Noise max < 35 и avg < 20 в течение 3 часов и больше
 * Учитывает, что в тихих местах это может быть нормально
 * Проверяем только если значения подозрительно низкие И это продолжается долго
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 */
export function checkNoiseTooLow(logArr) {
  const THREE_HOURS = 3 * 3600; // секунды
  if (!logArr || logArr.length < 5) return false; // Нужно минимум 5 записей

  const now = Math.max(...logArr.map(d => d.timestamp));
  const last3h = logArr
    .filter(d => now - d.timestamp <= THREE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last3h.length < 5) return false;

  let lowCount = 0;
  let validCount = 0;
  let suspiciouslyLowCount = 0; // Очень низкие значения (max < 30, avg < 15)

  for (const log of last3h) {
    const avg = log?.data?.noiseavg;
    const max = log?.data?.noisemax;
    if (avg !== undefined && avg !== null && max !== undefined && max !== null) {
      validCount++;
      if (max < 35 && avg < 20) {
        lowCount++;
        // Проверяем, что значения подозрительно низкие
        if (max < 30 && avg < 15) {
          suspiciouslyLowCount++;
        }
      }
    }
  }

  if (validCount < 5) return false;
  
  // Требуем 90%+ низких значений И хотя бы 50% подозрительно низких
  const lowRatio = lowCount / validCount;
  const suspiciousRatio = suspiciouslyLowCount / validCount;
  
  return lowRatio >= 0.9 && suspiciousRatio >= 0.5 && validCount >= 5;
}

/**
 * Проверяет, что значения шума не меняются в диапазоне больше 3 часов
 * Учитывает, что в тихих местах значения могут быть стабильными
 * Проверяем только если значения "залипли" на одном числе
 * @param {Array} logArr - массив логов с timestamp и data
 * @returns {boolean}
 */
export function checkNoiseNoChange(logArr) {
  const FIVE_HOURS = 5 * 3600; // секунды
  if (!logArr || logArr.length < 5) return false; // Нужно минимум 5 записей

  const now = Math.max(...logArr.map(d => d.timestamp));
  const last3h = logArr
    .filter(d => now - d.timestamp <= FIVE_HOURS)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (last3h.length < 5) return false;

  // Используем noiseavg или noisemax (приоритет noiseavg)
  const noiseValues = last3h
    .map(d => d?.data?.noiseavg ?? d?.data?.noisemax)
    .filter(v => v !== undefined && v !== null && v > 0); // Игнорируем нулевые значения

  if (noiseValues.length < 5) return false;

  // Проверяем стандартное отклонение - если оно очень маленькое, значения "залипли"
  const mean = noiseValues.reduce((a, b) => a + b, 0) / noiseValues.length;
  const variance = noiseValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / noiseValues.length;
  const std = Math.sqrt(variance);
  
  // Если std очень маленькое (< 1 dB), это подозрительно - значения "залипли"
  // И среднее значение не должно быть нулевым
  return std < 1 && mean > 0 && noiseValues.length >= 5;
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
