import { defineStore } from "pinia";
import { IDBgettable, watchDBChange } from "../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.SensorsDBBookmarks || {};
const DB_NAME = schema.dbname || "SensorsDBBookmarks";
const STORE = Object.keys(schema.stores || { bookmarks: {} })[0] || "bookmarks";

export const useBookmarksStore = defineStore("bookmarks", {
  state: () => ({
    idbBookmarks: [],
  }),
  actions: {
    async idbBookmarkGet() {
      this.idbBookmarks = await IDBgettable(DB_NAME, STORE);
    },
    watchBookmarks() {
      return watchDBChange(DB_NAME, STORE, () => this.idbBookmarkGet());
    },
  },
});
