import { defineStore } from "pinia";
import { IDBgettable } from "../idb";

export const useBookmarksStore = defineStore('bookmarks', {
  state: () => ({
    idbBookmarkDbname: 'SensorsDBBookmarks',
    idbBookmarkVDbver: 6,
    idbBookmarkVDbtable: 'bookmarks',
    idbWatcherBroadcast: 'idb_changed', /* this we need until IndexedDB Observer will be available in browsers */
    idbBookmarks: null,
  }),
  actions: {
    async idbBookmarkGet() {
      this.idbBookmarks = await IDBgettable(this.idbBookmarkDbname, this.idbBookmarkVDbver, this.idbBookmarkVDbtable);

      const bc = new BroadcastChannel(this.idbWatcherBroadcast);
      bc.onmessage = async (e) => {
        if(e.data === this.idbBookmarkVDbtable) {
          this.idbBookmarks = await IDBgettable(this.idbBookmarkDbname, this.idbBookmarkVDbver, this.idbBookmarkVDbtable);
        }
      };
    },
  },
});
