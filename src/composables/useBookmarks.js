import { ref } from "vue";
import { IDBgettable, watchDBChange } from "../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.SensorsDBBookmarks || {};
const DB_NAME = schema.dbname || "SensorsDBBookmarks";
const STORE = Object.keys(schema.stores || { bookmarks: {} })[0] || "bookmarks";

// Глобальное состояние для закладок
const idbBookmarks = ref([]);

export function useBookmarks() {
  const idbBookmarkGet = async () => {
    idbBookmarks.value = await IDBgettable(DB_NAME, STORE);
  };

  const watchBookmarks = () => {
    return watchDBChange(DB_NAME, STORE, () => idbBookmarkGet());
  };

  return {
    idbBookmarks,
    idbBookmarkGet,
    watchBookmarks,
  };
}

