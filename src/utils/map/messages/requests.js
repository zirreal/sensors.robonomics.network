/**
 * Message API requests
 * Handles fetching message data from remote provider
 */

import Provider from "@/providers/remote";
import { hasValidCoordinates } from "../../utils";
import { getConfigBounds, filterByBounds } from "../map";
import { settings } from "@config";

const REMOTE_PROVIDER = new Provider(settings.REMOTE_PROVIDER);

/**
 * Функция для получения сообщений за период
 * @param {number} startTimestamp - Начальный timestamp (Unix)
 * @param {number} endTimestamp - Конечный timestamp (Unix)
 * @returns {Promise<Object>} - Объект с сообщениями и сообщениями без локации
 */
export async function getMessagesForPeriod(startTimestamp, endTimestamp) {
  try {

    // Используем messagesForPeriod из remote.js
    const messagesData = await REMOTE_PROVIDER.messagesForPeriod(startTimestamp, endTimestamp);


    // Обрабатываем данные сообщений
    const messages = [];
    const messagesNoLocation = [];
    const processedMessages = new Set(); // Для отслеживания дублей

    // messagesData всегда приходит как массив
    const messagesArray = messagesData || [];

    for (const messageData of messagesArray) {
      if (!messageData || !messageData.id || !messageData.geo) {
        continue;
      }

      // Проверяем валидность координат
      const lat = parseFloat(messageData.geo.lat);
      const lng = parseFloat(messageData.geo.lng);
      const timestamp = messageData.timestamp || Date.now();

      // Создаем ключ для проверки дублей (гео + таймстамп)
      const duplicateKey = `${lat}_${lng}_${timestamp}`;
      
      // Пропускаем дубли
      if (processedMessages.has(duplicateKey)) {
        continue;
      }
      
      // Добавляем в набор обработанных
      processedMessages.add(duplicateKey);

      const messageInfo = {
        message_id: timestamp + '_' + lat + '_' + lng, // уникальный ID
        geo: { lat, lng },
        message: messageData.message || '',
        timestamp: timestamp,
        author: messageData.author || 'Unknown',
        address: messageData.address || '' // добавляем поле адреса
      };

      if (!hasValidCoordinates({ lat, lng })) {
        // Сообщения с невалидными координатами
        messagesNoLocation.push(messageInfo);
      } else {
        // Сообщения с валидными координатами
        messages.push(messageInfo);
      }
    }

    // Применяем фильтрацию по границам карты
    const bounds = getConfigBounds(settings);

    // Применяем фильтрацию
    const filteredMessages = filterByBounds(messages, bounds);
    const filteredNoLocation = messagesNoLocation;

    // Возвращаем отфильтрованные данные
    return {
      messages: filteredMessages,
      messagesNoLocation: filteredNoLocation
    };

  } catch (error) {
    console.error('Error loading messages:', error);
    return {
      messages: [],
      messagesNoLocation: []
    };
  }
}
