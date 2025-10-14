import { ref, computed } from 'vue';
import { useMap } from '@/composables/useMap';
import { instanceMap } from '@/utils/map/map';
import { setActiveMarker } from '@/utils/map/markers';
import { getMessagesForPeriod } from '@/utils/map/messages/requests';
import { getAddress } from '@/utils/utils';
import * as messagesUtils from '@/utils/map/messages';
import { hasValidCoordinates } from '@/utils/utils';

export function useMessages(locale) {
  const mapState = useMap();

  // Локальное состояние сообщений
  const messages = ref([]);
  const messagesNoLocation = ref([]);
  const messagesLoaded = ref(false);

  // Состояние UI
  const isMessage = ref(false);
  const messagePoint = ref(null);
  const messagesLoading = ref(false);
  const messagesError = ref(null);

  // Computed свойства - используем локальные данные
  const messagesCount = computed(() => messages.value.length);
  const hasMessages = computed(() => messages.value.length > 0);

  // Функция загрузки сообщений
  const loadMessages = async (startTimestamp, endTimestamp) => {
    try {
      messagesLoading.value = true;
      messagesError.value = null;

      // Загружаем сообщения через requests.js
      const result = await getMessagesForPeriod(startTimestamp, endTimestamp);
      
      
      // Сохраняем данные в локальные переменные
      messages.value = result.messages;
      messagesNoLocation.value = result.messagesNoLocation;
      messagesLoaded.value = true;
      
      // Обновляем маркеры на карте (используем локальные данные)
      messagesUtils.updateMessages(messages.value);
      
      return result;

    } catch (error) {
      console.error('Error loading messages:', error);
      messagesError.value = error;
      messages.value = [];
      messagesNoLocation.value = [];
      messagesLoaded.value = false;
      return { messages: [], messagesNoLocation: [] };
    } finally {
      messagesLoading.value = false;
    }
  };

  // Функция форматирования точки сообщения
  const formatPointForMessage = (messageData) => {
    if (!messageData || !messageData.geo) return null;

    return {
      message_id: messageData.message_id,
      geo: messageData.geo,
      message: messageData.message,
      timestamp: messageData.timestamp,
      author: messageData.author,
      address: messageData.address || ''
    };
  };

  // Функции для открытия/закрытия попапа сообщения
  const handlerOpenMessage = (message) => {
    isMessage.value = true;
    messagePoint.value = message;
    setActiveMarker(message.message_id, 'message');
    
    // Делаем карту неактивной при открытии попапа сообщения
    mapState.mapinactive.value = true;

    // Получаем адрес сообщения асинхронно, если его нет
    if (!message.address && hasValidCoordinates(message.geo)) {
      messagePoint.value.address = `Loading address...`;
      getAddress(message.geo.lat, message.geo.lng, locale.value).then(address => {
        if (messagePoint.value && messagePoint.value.message_id === message.message_id && address) {
          messagePoint.value.address = address;
        }
      });
    }
  };

  const handlerCloseMessage = () => {
    isMessage.value = false;
    messagePoint.value = null;
    setActiveMarker(null, 'message');
    
    // Возвращаем карту в активное состояние при закрытии попапа
    mapState.mapinactive.value = false;
  };

  // Новые методы для интеграции с Main.vue
  const setActiveMessage = (messageData) => {
    const formattedMessage = formatPointForMessage(messageData);
    if (formattedMessage) {
      handlerOpenMessage(formattedMessage);
    }
  };

  const closeMessage = () => {
    handlerCloseMessage();
  };

  // Computed для данных сообщения
  const messageData = computed(() => messagePoint.value);
  const messageGeo = computed(() => messagePoint.value?.geo || null);

  // Инициализация слоя сообщений
  const initMessagesLayer = (clickCallback) => {
    messagesUtils.init(clickCallback);
  };

  // Переключение видимости слоя сообщений
  const toggleMessagesLayer = (enabled) => {
    const map = instanceMap();
    if (map) {
      messagesUtils.switchMessagesLayer(enabled);
    }
  };

  // Очистка маркеров сообщений
  const clearMessagesMarkers = () => {
    messagesUtils.clearMessages();
  };

  // Функции для управления локальными данными
  const setMessages = (messagesArr) => {
    messages.value = messagesArr;
    messagesLoaded.value = true;
  };

  const setMessagesNoLocation = (messagesArr) => {
    messagesNoLocation.value = messagesArr;
  };

  const clearMessages = () => {
    messages.value = [];
    messagesNoLocation.value = [];
    messagesLoaded.value = false;
  };

  return {
    isMessage,
    messagePoint,
    messageData,
    messageGeo,
    messagesLoading,
    messagesError,
    messages,
    messagesNoLocation,
    messagesLoaded,
    messagesCount,
    hasMessages,
    loadMessages,
    handlerOpenMessage,
    handlerCloseMessage,
    setActiveMessage,
    closeMessage,
    initMessagesLayer,
    toggleMessagesLayer,
    clearMessagesMarkers,
    formatPointForMessage,
    // Функции управления данными
    setMessages,
    setMessagesNoLocation,
    clearMessages,
  };
}
