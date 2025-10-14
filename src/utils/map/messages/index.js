/**
 * Message-related marker functionality
 * Handles message markers and message visualization
 */

import { MARKER_CLASSES } from '../markers';
import { getMapContext } from '../map';
import * as utils from '../markers';
import { setActiveMarker, clearActiveMarker } from '../markers';
import * as icons from './icons';
import L from "leaflet";

/**
 * Создает кластерную группу специально для сообщений с более агрессивной кластеризацией
 * @param {Function} iconCreateFn - Функция создания иконки кластера
 * @returns {L.MarkerClusterGroup} Кластерная группа для сообщений
 */
function createMessageClusterGroup(iconCreateFn) {
  return new L.MarkerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius(zoom) {
      // Очень агрессивная кластеризация для сообщений в зависимости от зума
      if (zoom <= 10) {
        return 80; // Очень большой радиус на низких зумах
      } else if (zoom <= 12) {
        return 60; // Большой радиус на средних зумах
      } else if (zoom <= 14) {
        return 40; // Средний радиус
      } else if (zoom <= 16) {
        return 25; // Меньший радиус на высоких зумах
      } else {
        return 15; // Минимальный радиус на очень высоких зумах
      }
    },
    disableClusteringAtZoom: 17, // Отключаем кластеризацию только на очень высоком зуме
    spiderfyOnEveryZoom: false,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 3.0, // Еще больше расстояние для spiderfy
    zoomToBoundsOnClick: true, // Включаем зум к границам кластера при клике
    spiderfyOnClick: false, // Отключаем автоматический spiderfy
    chunkedLoading: true, // Улучшение производительности
    chunkDelay: 50, // Увеличиваем задержку для лучшей производительности
    iconCreateFunction: iconCreateFn,
    // Дополнительные настройки для лучшей кластеризации сообщений
    animate: true,
    animateAddingMarkers: true,
    removeOutsideVisibleBounds: true,
    chunkProgress: (processed, total, elapsed) => {
      // Можно добавить логику прогресса загрузки
    }
  });
}

/**
 * Проверяет, готов ли слой маркеров сообщений для работы
 * @returns {boolean} true если слой инициализирован
 */
export function isReadyLayer() {
  const ctx = getMapContext();
  return !!ctx.messagesLayer;
}

/**
 * Upsert маркер сообщения: создает новый или обновляет существующий
 * @param {Object} point - Данные сообщения
 * @returns {Object} - { marker: Object, isNew: boolean } - Обработанный маркер и флаг новизны
 */
function upsertMessageMarker(point) {
  // Вычисляем координаты (сообщения используют scatter)
  const coord = utils.scatterCoords([point.geo.lat, point.geo.lng], point.message_id);
  
  // Ищем существующий маркер
  const existingMarker = findMessageMarker(point.message_id);
  
  // Если маркер существует, обновляем его
  if (existingMarker) {
    // Проверяем, был ли маркер активным
    const wasActive = existingMarker.getElement()?.classList.contains(MARKER_CLASSES.active);
    
    // Обновляем данные маркера
    existingMarker.options.data = point;
    
    // Обновляем иконку
    existingMarker.setIcon(icons.createIconPoint({
      id: point.message_id
    }));
    
    // Восстанавливаем активное состояние если было
    if (wasActive) {
      existingMarker.getElement()?.classList.add(MARKER_CLASSES.active);
    }
    
    return { marker: existingMarker, isNew: false };
  }
  
  // Создаем новый маркер
  const newMarker = icons.createMarker(coord, point);
  
  // Добавляем маркер на слой
  const ctx = getMapContext();
  if (ctx.messagesLayer) {
    ctx.messagesLayer.addLayer(newMarker);
    
    // Добавляем обработчики событий для маркера
    utils.attachMarkerEvents(newMarker, (data) => {
      setActiveMarker(data.message_id, 'message');
      // Вызываем callback если он есть в контексте
      if (ctx.messageClickHandler) {
        ctx.messageClickHandler(data);
      }
    });
  }
  
  return { marker: newMarker, isNew: true };
}

/**
 * Находит маркер сообщения по ID
 * @param {string} messageId - ID сообщения
 * @returns {Object|null} - Найденный маркер или null
 */
function findMessageMarker(messageId) {
  const ctx = getMapContext();
  if (!ctx.messagesLayer) return null;
  
  let foundMarker = null;
  ctx.messagesLayer.eachLayer((layer) => {
    if (layer.options?.data?.message_id === messageId) {
      foundMarker = layer;
      return false; // Прерываем итерацию
    }
  });
  
  return foundMarker;
}

/**
 * Initialize message markers
 * @param {Function} cb - Callback for message clicks
 */
export function init(cb) {
  const ctx = getMapContext();
  
  if (!ctx.map) {
    return;
  }
  
  // Создаем кластерную группу для маркеров сообщений с более агрессивной кластеризацией
  ctx.messagesLayer = createMessageClusterGroup((cluster) => icons.createIconCluster(cluster));
  
  // Добавляем слой на карту
  if (ctx.map && ctx.messagesLayer) {
    ctx.map.addLayer(ctx.messagesLayer);
    
    // Добавляем слушатель изменения зума для обновления кластеризации
    ctx.map.on('zoomend', () => {
      // Принудительно обновляем кластеризацию при изменении зума
      if (ctx.messagesLayer) {
        ctx.messagesLayer.refreshClusters();
      }
    });
  }
  
  // Создаем обработчик клика для маркеров сообщений
  const messageClickHandler = (data) => {
    // Устанавливаем активный маркер
    setActiveMarker(data.message_id, 'message');
    cb(data);
  };

  // Сохраняем обработчик в контексте для использования в upsertMessageMarker
  ctx.messageClickHandler = messageClickHandler;

  // Используем общую логику обработки событий кластеров
  if (ctx.messagesLayer) {
    utils.attachClusterEvents(ctx.messagesLayer, messageClickHandler);
  }

}

/**
 * Update message markers
 * @param {Array} messages - Array of message data
 */
export function updateMessages(messages) {
  if (!isReadyLayer()) {
    return;
  }
  
  const ctx = getMapContext();
  
  // Очищаем существующие маркеры
  if (ctx.messagesLayer) {
    ctx.messagesLayer.clearLayers();
  }
  
  // Добавляем новые маркеры
  messages.forEach(point => {
    if (point.geo && point.geo.lat && point.geo.lng) {
      upsertMessageMarker(point);
    }
  });
}

/**
 * Clear all message markers
 */
export function clearMessages() {
  const ctx = getMapContext();
  if (ctx.messagesLayer) {
    ctx.messagesLayer.clearLayers();
    // Очищаем активный маркер при очистке слоя
    clearActiveMarker();
  }
}

/**
 * Destroy message layer and clean up resources
 */
export function destroyMessagesLayer() {
  const ctx = getMapContext();
  if (ctx.map && ctx.messagesLayer) {
    // Удаляем слушатель зума
    ctx.map.off('zoomend');
    
    // Удаляем слой с карты
    ctx.map.removeLayer(ctx.messagesLayer);
    
    // Очищаем ссылку
    ctx.messagesLayer = null;
  }
}



/**
 * Switch messages layer visibility
 * @param {boolean} enabled - Whether to enable the layer
 */
export function switchMessagesLayer(enabled = false) {
  const ctx = getMapContext();
  if (!ctx.map || !ctx.messagesLayer) return;
  
  if (enabled) {
    ctx.map.addLayer(ctx.messagesLayer);
  } else {
    ctx.map.removeLayer(ctx.messagesLayer);
  }
}
