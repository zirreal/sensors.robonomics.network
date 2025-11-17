<template>
  <div class="sensor-timeline">
    <div class="sensor-timeline-tabs">
      <button 
        :class="{ active: timelineMode === 'realtime' }"
        @click="handleTimelineModeChange('realtime')"
      >
        Realtime
      </button>
      <button 
        :class="{ active: timelineMode === 'day' }"
        @click="handleTimelineModeChange('day')"
      >
        Day
      </button>
      <button 
        :class="{ active: timelineMode === 'week' }"
        @click="handleTimelineModeChange('week')"
      >
        Week
      </button>
      <button 
        :class="{ active: timelineMode === 'month' }"
        @click="handleTimelineModeChange('month')"
      >
        Month
      </button>
    </div>
    
    <div class="sensor-timeline-span">
      <!-- Realtime - текущее время + last updated -->
      <div v-if="timelineMode === 'realtime'" class="realtime-info">
        <div class="rt-time">{{ getCurrentTime() }}</div>
        <div v-if="lastUpdatedTime" class="rt-status">Last updated: {{ lastUpdatedTime }}</div>
      </div>
      
      <!-- Day - input type date -->
      <div v-else-if="timelineMode === 'day'" class="day-controls">
        <input 
          type="date" 
          v-model="pickedDate" 
          :max="maxDate" 
          @change="handleDateChange" 
        />
      </div>
      
      <!-- Week, Month - диапазон дат -->
      <div v-else-if="timelineMode === 'week'" class="range-controls">
        <input 
          type="date" 
          :value="getWeekStartDate()" 
          :max="maxDate"
          disabled
        />
        <span>—</span>
        <input 
          type="date" 
          v-model="pickedDate" 
          :max="maxDate"
          @change="handleWeekEndChange"
        />
      </div>
      
      <div v-else-if="timelineMode === 'month'" class="range-controls">
        <input 
          type="date" 
          :value="getMonthStartDate()" 
          :max="maxDate"
          disabled
        />
        <span>—</span>
        <input 
          type="date" 
          v-model="pickedDate" 
          :max="maxDate"
          @change="handleMonthEndChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useMap } from '@/composables/useMap';
import { useSensors } from '@/composables/useSensors';
import { dayISO } from '../../../utils/date';

const props = defineProps({
  log: Array,
  point: Object
});

const emit = defineEmits(['dateChange']);

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const mapState = useMap();
const sensorsUI = useSensors();

// Локальное состояние
const state = reactive({
  timelineMode: 'realtime' // 'realtime', 'day', 'week', 'month'
});

// Максимальная дата (сегодня) - computed для реактивности
const maxDate = computed(() => dayISO());

// Реактивная переменная для обновления времени
const currentTime = ref(new Date().toLocaleTimeString('en-GB', { 
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}));

// Выбранная пользователем дата для v-model (синхронизируется с store)
const pickedDate = computed({
  get: () => mapState.currentDate.value,
  set: (value) => {
    mapState.setCurrentDate(value);
  }
});

// Computed для режима таймлайна
const timelineMode = computed(() => state.timelineMode);

/**
 * Обрабатывает переключение режима таймлайна
 * @param {string} mode - 'realtime', 'day', 'week', 'month'
 */
const handleTimelineModeChange = (mode) => {
  state.timelineMode = mode;
  
  // Обнуляем logs при переключении периодов для показа skeleton
  if (props.point?.sensor_id && sensorsUI) {
    sensorsUI.clearSensorLogs(props.point.sensor_id);
  }
  
  if (mode === 'realtime') {
    // Переключаемся на realtime провайдер с текущей датой
    mapState.setMapSettings(route, router, { 
      provider: 'realtime',
      date: dayISO() // Устанавливаем текущую дату
    });
    mapState.setTimelineMode('realtime');
  } else {
    // Для day/week/month переключаемся на remote провайдер
    mapState.setMapSettings(route, router, { provider: 'remote' });
    mapState.setTimelineMode(mode);
    
    // Для day/week/month не меняем дату - только переключаем провайдер
    // Логи будут загружены с правильными границами в updateSensorLogs
  }
};

/**
 * Получает начальную дату недели
 * @returns {string} дата в формате ISO
 */
const getWeekStartDate = () => {
  const currentDate = new Date(mapState.currentDate.value);
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - 6);
  return dayISO(weekStart);
};

/**
 * Получает начальную дату месяца
 * @returns {string} дата в формате ISO
 */
const getMonthStartDate = () => {
  const currentDate = new Date(mapState.currentDate.value);
  const monthStart = new Date(currentDate);
  monthStart.setDate(currentDate.getDate() - 29);
  return dayISO(monthStart);
};

/**
 * Обрабатывает изменение конечной даты недели
 * @param {Event} event - событие изменения
 */
const handleWeekEndChange = (event) => {
  const endDate = new Date(event.target.value);
  // Обновляем currentDate на выбранную дату
  mapState.setMapSettings(route, router, { date: dayISO(endDate) });
};

/**
 * Обрабатывает изменение конечной даты месяца
 * @param {Event} event - событие изменения
 */
const handleMonthEndChange = (event) => {
  const endDate = new Date(event.target.value);
  // Обновляем currentDate на выбранную дату
  mapState.setMapSettings(route, router, { date: dayISO(endDate) });
};

/**
 * Получает текущее время в формате ЧЧ:ММ:СС
 * @returns {string} текущее время
 */
const getCurrentTime = () => {
  return currentTime.value;
};

/**
 * Получает время последнего обновления данных из логов
 * @returns {string|null} время последнего обновления или null если данных нет
 */
const lastUpdatedTime = computed(() => {
  if (!Array.isArray(props.log) || props.log.length === 0) {
    return null;
  }
  
  // Берем последний элемент логов (самое свежее измерение)
  const last = props.log[props.log.length - 1];
  
  if (!last || !last.timestamp) {
    return null;
  }
  
  // Форматируем время последнего обновления
  return new Date(last.timestamp * 1000).toLocaleString();
});

// Обрабатывает изменение даты: убирает фокус и очищает логи
const handleDateChange = async (event) => {
  // Убираем фокус с input (особенно важно на мобильных)
  event.target.blur();
  
  // Ждем следующего тика, чтобы v-model успел обновиться
  await nextTick();
  
  // Эмитим событие изменения даты
  emit('dateChange');
};

onMounted(() => {
  // Инициализируем режим таймлайна в зависимости от провайдера
  if (mapState.currentProvider.value === 'realtime') {
    state.timelineMode = 'realtime';
  } else {
    // Используем глобальное состояние или day по умолчанию
    const globalMode = mapState.timelineMode.value;
    state.timelineMode = globalMode || 'day';
  }
  
  // Обновляем время каждую секунду для realtime режима
  const timeInterval = setInterval(() => {
    if (state.timelineMode === 'realtime') {
      const now = new Date();
      currentTime.value = now.toLocaleTimeString('en-GB', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }, 1000);
  
  // Очищаем интервал при размонтировании
  onUnmounted(() => {
    clearInterval(timeInterval);
  });
});

// Watcher для синхронизации локального timelineMode с глобальным состоянием
watch(
  () => mapState.timelineMode.value,
  (newMode) => {
    if (newMode && newMode !== state.timelineMode) {
      state.timelineMode = newMode;
    }
  }
);

// Watcher для изменений провайдера извне
watch(
  () => mapState.currentProvider.value,
  (newProvider) => {
    if (newProvider) {
      // Автоматически переключаем режим таймлайна в зависимости от провайдера
      if (newProvider === 'realtime') {
        state.timelineMode = 'realtime';
      } else if (state.timelineMode === 'realtime') {
        // Если переключились с realtime на remote, переключаемся на day
        state.timelineMode = 'day';
      }
    }
  }
);
</script>

<style scoped>

.sensor-timeline {
  text-align: center;
}

.sensor-timeline-tabs {
  display: inline-flex;
  border: 1px solid #ccc;
  background-color: #f2f2f2;
  border-radius: 20px;
}

.sensor-timeline-tabs button{
  padding: 0.2rem 0.8rem;
  color: var(--color-dark);
  font-weight: bold;
  border: 0;
  cursor: pointer;
}

.sensor-timeline-tabs button.active {
  background-color: var(--color-link);
  color: var(--color-light);
  border-radius: 20px;
}

.sensor-timeline-span {
  display: flex;
  align-items: center;
  gap: var(--gap);
  justify-content: center;
}

.realtime-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.rt-time {
  font-size: 1.2em;
  font-weight: bold;
  color: var(--color-dark);
  font-family: monospace;
  text-align: center;
}

.rt-status {
  font-size: 0.8em;
  color: var(--color-gray);
  font-style: italic;
}

.day-controls {
  cursor: pointer;
  display: inline-block;
}

.day-controls input,
.range-controls input {
  padding: 0;
  border: 0;
  border: 0;
  background-color: transparent;
  color: var(--color-link);
  font-size: inherit;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
}

.day-controls input:focus,
.range-controls input:focus:not(:disabled) {
  outline: none;
}

.range-controls input:disabled {
  background-color: transparent;
  color: var(--color-text);
  cursor: not-allowed;
}

.range-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range-controls span {
  font-weight: bold;
  color: var(--color-dark);
}
</style>
