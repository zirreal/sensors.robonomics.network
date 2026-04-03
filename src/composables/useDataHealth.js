// Composable для работы с dataHealth сенсоров

import { ref } from "vue";
import { IDBworkflow, IDBgetByKey, notifyDBChange } from "../utils/idb";
import { checkAllDataHealth } from "../utils/calculations/sensor_stability_check";
import { getSensorData } from "../utils/map/sensors/requests";

const DB_NAME = "Sensors";
const STORE_NAME = "dataHealth";
const HEALTH_CHECK_VERSION = 4;

/**
 * Проверяет, нужно ли выполнить проверку (раз в день)
 * @param {Object} existingHealth - существующий dataHealth из БД
 * @returns {boolean}
 */
function shouldCheckHealth(existingHealth) {
  if (!existingHealth || !existingHealth.lastChecked) {
    return true; // Никогда не проверяли
  }

  if (existingHealth.version !== HEALTH_CHECK_VERSION) {
    return true; // Пересчитываем после изменения логики проверок
  }

  const ONE_DAY = 24 * 60 * 60 * 1000; // миллисекунды
  const now = Date.now();
  const timeSinceLastCheck = now - existingHealth.lastChecked;

  return timeSinceLastCheck >= ONE_DAY;
}

/**
 * Получает логи сенсора за последние 7 дней для проверки
 * @param {string} sensorId - ID сенсора
 * @returns {Promise<Array>} массив логов
 */
async function getRecentLogs(sensorId) {
  const now = Math.floor(Date.now() / 1000); // текущий timestamp в секундах
  const ONE_WEEK_AGO = now - 7 * 24 * 60 * 60; // 7 дней назад

  try {
    const logs = await getSensorData(sensorId, ONE_WEEK_AGO, now, "remote");
    return Array.isArray(logs) ? logs : [];
  } catch (error) {
    console.error(`Error fetching logs for sensor ${sensorId}:`, error);
    return [];
  }
}

/**
 * Выполняет проверку dataHealth для сенсора и сохраняет результат
 * @param {string} sensorId - ID сенсора
 * @param {Array} logs - массив логов (опционально, если не передан - загрузит сам)
 * @returns {Promise<Object>} объект с dataHealth
 */
async function checkAndSaveDataHealth(sensorId, logs = null) {
  try {
    // Для надежной диагностики всегда используем полный срез за 7 дней.
    // Компонент может передать только дневной лог, которого недостаточно
    // для детекторов залипания на длинном окне.
    const recentLogs = await getRecentLogs(sensorId);
    if (Array.isArray(logs) && logs.length > 0) {
      // Объединяем переданные логи с недельными, убирая дубликаты по timestamp.
      const merged = [...logs, ...recentLogs];
      const byTs = new Map();
      for (const item of merged) {
        const ts = item?.timestamp;
        if (ts !== undefined && ts !== null) byTs.set(ts, item);
      }
      logs = Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
    } else {
      logs = recentLogs;
    }

    // Выполняем проверку
    const healthData = checkAllDataHealth(logs);

    // Сохраняем в IndexedDB
    return new Promise((resolve, reject) => {
      IDBworkflow(DB_NAME, STORE_NAME, "readwrite", (store) => {
        const record = {
          sensorId,
          ...healthData,
          version: HEALTH_CHECK_VERSION,
          lastChecked: Date.now(),
        };
        const request = store.put(record);
        request.onsuccess = () => {
          notifyDBChange(DB_NAME, STORE_NAME);
          resolve(healthData);
        };
        request.onerror = (e) => {
          reject(e);
        };
      });
    });
  } catch (error) {
    console.error(`Error checking data health for sensor ${sensorId}:`, error);
    // Возвращаем здоровые значения по умолчанию при ошибке
    return {
      pm: { healthy: true, checks: {} },
      climate: { healthy: true, checks: {} },
      noise: { healthy: true, checks: {} },
    };
  }
}

/**
 * Получает dataHealth для сенсора, проверяя нужно ли обновление
 * Если нужно - выполняет проверку и сохраняет результат
 * @param {string} sensorId - ID сенсора
 * @param {Array} logs - массив логов (опционально, для проверки)
 * @returns {Promise<Object>} объект с dataHealth
 */
async function getOrCheckDataHealth(sensorId, logs = null) {
  // Получаем существующий dataHealth
  const existingHealth = await IDBgetByKey(DB_NAME, STORE_NAME, sensorId);

  // Проверяем, нужно ли обновление
  if (shouldCheckHealth(existingHealth)) {
    // Выполняем проверку и сохраняем
    return await checkAndSaveDataHealth(sensorId, logs);
  }

  // Возвращаем существующий dataHealth (убираем lastChecked из результата)
  if (existingHealth) {
    const { lastChecked, version, ...healthData } = existingHealth;
    return healthData;
  }

  // Если данных нет, выполняем проверку
  return await checkAndSaveDataHealth(sensorId, logs);
}

/**
 * Composable для работы с dataHealth сенсоров
 * @returns {Object} объект с реактивными данными и методами
 */
export function useDataHealth() {
  const dataHealth = ref(null);
  const isLoading = ref(false);
  const error = ref(null);

  /**
   * Загружает и проверяет dataHealth для сенсора
   * @param {string} sensorId - ID сенсора
   * @param {Array} logs - массив логов (опционально)
   */
  const loadDataHealth = async (sensorId, logs = null) => {
    if (!sensorId) {
      dataHealth.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const health = await getOrCheckDataHealth(sensorId, logs);
      dataHealth.value = health;
    } catch (err) {
      console.error("Error loading data health:", err);
      error.value = err;
      dataHealth.value = null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Принудительно обновляет dataHealth (игнорируя проверку раз в день)
   * @param {string} sensorId - ID сенсора
   * @param {Array} logs - массив логов (опционально)
   */
  const refreshDataHealth = async (sensorId, logs = null) => {
    if (!sensorId) {
      dataHealth.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const health = await checkAndSaveDataHealth(sensorId, logs);
      dataHealth.value = health;
    } catch (err) {
      console.error("Error refreshing data health:", err);
      error.value = err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    dataHealth,
    isLoading,
    error,
    loadDataHealth,
    refreshDataHealth,
  };
}

