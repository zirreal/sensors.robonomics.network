// stores/account.js  (массив аккаунтов)

import { defineStore } from "pinia";
import {
  IDBworkflow,
  IDBgettable,
  IDBdeleteByKey,
  notifyDBChange,
  hasIndexedDB,
} from "../utils/idb";
import schemas from "@/config/default/idb-schemas.json";

const schema = schemas?.Altruist || {};
const DB_NAME = schema.dbname || "Altruist";
const STORE = Object.keys(schema.stores || { Accounts: {} })[0] || "Accounts";

export const useAccountStore = defineStore("account", {
  state: () => ({
    accounts: [] // [{ phrase, address, type, devices, ts }]
  }),
  actions: {
    async addAccount({ phrase, address, type, devices, ts }, { persist = true } = {}) {
      // console.log('addAccount', phrase, address, type, devices, ts, persist)
      const idx = this.accounts.findIndex(a => a.address === address);
      const item = { phrase, address, type, devices, ts: ts || Date.now() };
      if (idx !== -1) this.accounts[idx] = item; else this.accounts.push(item);

      if (persist && hasIndexedDB()) {
        IDBworkflow(DB_NAME, STORE, "readwrite", store => { store.put(item); });
        notifyDBChange(DB_NAME, STORE);
      }
      return item;
    },

    async removeAccounts(addresses) {
      const list = Array.isArray(addresses) ? addresses : (addresses ? [addresses] : []);
      if (list.length === 0) return;

      const toDelete = new Set(list);

      this.accounts = this.accounts.filter(a => !toDelete.has(a.address));

      console.log('removeAccounts this.accounts', this.accounts)

      if (hasIndexedDB()) {
        await Promise.all(list.map(addr => IDBdeleteByKey(DB_NAME, STORE, addr)));
        notifyDBChange(DB_NAME, STORE);
      }
    },

    async getAccounts() {
      if (!hasIndexedDB()) {
        return this.accounts;
      }
      const data = await IDBgettable(DB_NAME, STORE);
      this.accounts = Array.isArray(data) ? data : [];
      return this.accounts;
    },

    async getUserSensors(owner) {
      try {
        const response = await fetch(
          `https://roseman.airalab.org/api/sensor/sensors/${owner}`
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        return Array.isArray(result.sensors) ? result.sensors : [];
      } catch (error) {
        console.warn("getUserSensors error:", error);
        return [];
      }
    }
  },
});
