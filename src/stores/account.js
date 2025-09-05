// stores/account.js  (массив аккаунтов)

import { defineStore } from "pinia";
import {
  IDBworkflow,
  IDBgettable,
  IDBdeleteByKey,
  notifyDBChange,
  hasIndexedDB,
} from "../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.Altruist || {};
const DB_NAME = schema.dbname || "Altruist";
const STORE = Object.keys(schema.stores || { Accounts: {} })[0] || "Accounts";

// Small in-memory cache for getUserSensors to prevent request storms.
// - USER_SENSORS_TTL_MS: how long a successful result is considered fresh.
// - userSensorsCache: stores either the last resolved data with timestamp,
//   or a pending promise to deduplicate parallel calls for the same owner.
const USER_SENSORS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const userSensorsCache = new Map(); // owner -> { ts, data } | { promise }

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

    /**
     * Fetches the list of sensors for a given owner with basic request coalescing and TTL cache.
     *
     * Behavior:
     * - Returns cached data if it's younger than USER_SENSORS_TTL_MS.
     * - If there is an in-flight request for the same owner, returns that promise instead of firing a new one.
     * - On success, caches the result with a timestamp; on failure, clears pending state and returns an empty array.
     *
     * Rationale:
     * - This method can be called by multiple UI parts at startup (App.vue, Login.vue, etc.).
     * - Without coalescing, it may create many identical XHRs and cause UI hitches.
     */
    async getUserSensors(owner) {
      const key = String(owner || "").trim();
      if (!key) return [];

      const now = Date.now();
      const cached = userSensorsCache.get(key);

      // Serve fresh cache
      if (cached && cached.data && now - cached.ts < USER_SENSORS_TTL_MS) {
        return cached.data;
      }
      // Share in-flight request
      if (cached && cached.promise) {
        return cached.promise;
      }

      const promise = (async () => {
        try {
          const response = await fetch(
            `https://roseman.airalab.org/api/sensor/sensors/${key}`
          );
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const result = await response.json();
          const data = Array.isArray(result.sensors) ? result.sensors : [];
          userSensorsCache.set(key, { ts: Date.now(), data });
          return data;
        } catch (error) {
          console.warn("getUserSensors error:", error);
          userSensorsCache.delete(key);
          return [];
        }
      })();

      userSensorsCache.set(key, { promise });
      return promise;
    }
  },
});
