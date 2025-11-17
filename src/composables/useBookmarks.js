import { ref } from "vue";
import { IDBgettable, watchDBChange, migrateDB, IDBworkflow } from "../utils/idb";
import { idbschemas } from "@config";

// Проверяем наличие конфигурации для новой базы данных
if (!idbschemas?.Sensors) {
  console.warn('Sensors database configuration not found. Bookmarks functionality disabled.');
}

const schema = idbschemas?.Sensors;
const DB_NAME = schema?.dbname;
const STORE = Object.keys(schema?.stores || {}).find(key => key === "bookmarks") || null;

// Конфигурация для старой базы данных (может отсутствовать)
const oldSchema = idbschemas?.SensorsDBBookmarks;
const OLD_DB_NAME = oldSchema?.dbname;
const OLD_STORE = oldSchema ? Object.keys(oldSchema.stores || {}).find(key => key === "bookmarks") || null : null;

// Глобальное состояние для закладок
const idbBookmarks = ref([]);


// Автоматическая миграция при запуске приложения
const autoMigrate = async () => {
  // Если нет конфигурации для старой базы, пропускаем миграцию
  if (!oldSchema || !OLD_DB_NAME || !OLD_STORE) {
    return;
  }

  try {
    // Сначала проверим, есть ли данные в старой базе
    let oldBookmarks = [];
    try {
      oldBookmarks = await IDBgettable(OLD_DB_NAME, OLD_STORE);
    } catch (error) {
      // Старая база не существует, это нормально
    }
    
    // Если в старой базе нет данных, пропускаем миграцию
    if (!oldBookmarks || oldBookmarks.length === 0) {
      return;
    }
    
    const { forceMigration } = useBookmarks();
    const success = await forceMigration();
    if (success) {
      // После успешной миграции удаляем старую базу
      try {
        const deleteReq = indexedDB.deleteDatabase(OLD_DB_NAME);
        await new Promise((resolve, reject) => {
          deleteReq.onsuccess = () => resolve();
          deleteReq.onerror = () => reject(deleteReq.error);
          deleteReq.onblocked = () => reject(new Error('Database deletion blocked'));
        });
      } catch (error) {
        console.warn('Could not delete old database automatically:', error);
      }
    }
  } catch (error) {
    console.error('Auto-migration failed:', error);
  }
};

// Запускаем автоматическую миграцию при загрузке модуля
autoMigrate();

export function useBookmarks() {
  const idbBookmarkGet = async () => {
    // Если нет конфигурации, возвращаем пустой массив
    if (!schema || !DB_NAME || !STORE) {
      return;
    }

    try {
      // Сначала инициализируем новую базу данных, создав пустую запись
      IDBworkflow(DB_NAME, STORE, 'readwrite', (store) => {
        // Создаем пустую запись для инициализации базы
        const initRecord = { id: 'init', temp: true };
        store.put(initRecord);
        // Сразу удаляем инициализационную запись
        store.delete('init');
      });

      // Проверяем, есть ли данные в старой базе перед миграцией (только если есть конфигурация)
      if (oldSchema && OLD_DB_NAME && OLD_STORE) {
        let oldBookmarks = [];
        try {
          oldBookmarks = await IDBgettable(OLD_DB_NAME, OLD_STORE);
        } catch (error) {
          // Старая база не существует, пропускаем миграцию
        }

        // Выполняем миграцию только если есть данные для миграции
        if (oldBookmarks && oldBookmarks.length > 0) {
          await migrateDB({
            fromDB: OLD_DB_NAME,
            fromStore: OLD_STORE,
            toDB: DB_NAME,
            toStore: STORE,
            transform: (oldBookmark) => ({
              id: oldBookmark.id,
              name: oldBookmark.customName || oldBookmark.id // Используем customName или id как fallback
            }),
            clearSource: true
          });
        }
      }
      
      idbBookmarks.value = await IDBgettable(DB_NAME, STORE);
    } catch (error) {
      console.error('Error in idbBookmarkGet:', error);
      // Fallback: пытаемся получить данные напрямую
      try {
        idbBookmarks.value = await IDBgettable(DB_NAME, STORE);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        idbBookmarks.value = [];
      }
    }
  };

  const watchBookmarks = () => {
    // Если нет конфигурации, возвращаем пустую функцию
    if (!schema || !DB_NAME || !STORE) {
      return;
    }
    return watchDBChange(DB_NAME, STORE, () => idbBookmarkGet());
  };

  // Функция для принудительной миграции
  const forceMigration = async () => {
    // Если нет конфигурации для старой базы, возвращаем false
    if (!oldSchema || !OLD_DB_NAME || !OLD_STORE) {
      return false;
    }

    try {
      // Инициализируем базу данных
      IDBworkflow(DB_NAME, STORE, 'readwrite', (store) => {
        const initRecord = { id: 'init', temp: true };
        store.put(initRecord);
        store.delete('init');
      });

      // Выполняем миграцию с преобразованием структуры
      const success = await migrateDB({
        fromDB: OLD_DB_NAME,
        fromStore: OLD_STORE,
        toDB: DB_NAME,
        toStore: STORE,
        transform: (oldBookmark) => ({
          id: oldBookmark.id,
          name: oldBookmark.customName || oldBookmark.id
        }),
        clearSource: true
      });

      if (success) {
        // Обновляем данные
        idbBookmarks.value = await IDBgettable(DB_NAME, STORE);
      }

      return success;
    } catch (error) {
      console.error('Force migration error:', error);
      return false;
    }
  };

  return {
    idbBookmarks,
    idbBookmarkGet,
    watchBookmarks,
    forceMigration,
  };
}

