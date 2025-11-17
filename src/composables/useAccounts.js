import { ref } from "vue";
import {
  IDBworkflow,
  IDBgettable,
  IDBdeleteByKey,
  notifyDBChange,
  hasIndexedDB,
} from "../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.Altruist || {};
const DB_NAME = schema.dbname;
const STORE = Object.keys(schema.stores || { Accounts: {} })[0] || "Accounts";

// Small in-memory cache for getUserSensors to prevent request storms.
// - USER_SENSORS_TTL_MS: how long a successful result is considered fresh.
// - userSensorsCache: stores either the last resolved data with timestamp,
//   or a pending promise to deduplicate parallel calls for the same owner.
const USER_SENSORS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const userSensorsCache = new Map(); // owner -> { ts, data } | { promise }

// Глобальное состояние аккаунтов (разделяется между всеми экземплярами composable)
const accounts = ref([]); // [{ phrase, address, type, devices, ts }]

export function useAccounts() {
  const addAccount = async ({ phrase, address, type, devices, ts }, { persist = true } = {}) => {
    // console.log('addAccount', phrase, address, type, devices, ts, persist)
    const idx = accounts.value.findIndex((a) => a.address === address);
    const item = { phrase, address, type, devices, ts: ts || Date.now() };
    if (idx !== -1) accounts.value[idx] = item;
    else accounts.value.push(item);

    if (persist && hasIndexedDB()) {
      IDBworkflow(DB_NAME, STORE, "readwrite", (store) => {
        store.put(item);
      });
      notifyDBChange(DB_NAME, STORE);
    }
    return item;
  };

  const removeAccounts = async (addresses) => {
    const list = Array.isArray(addresses) ? addresses : addresses ? [addresses] : [];
    if (list.length === 0) return;

    const toDelete = new Set(list);

    accounts.value = accounts.value.filter((a) => !toDelete.has(a.address));

    if (hasIndexedDB()) {
      await Promise.all(list.map((addr) => IDBdeleteByKey(DB_NAME, STORE, addr)));
      notifyDBChange(DB_NAME, STORE);
    }
  };

  const getAccounts = async () => {
    if (!hasIndexedDB()) {
      return accounts.value;
    }
    const data = await IDBgettable(DB_NAME, STORE);
    accounts.value = Array.isArray(data) ? data : [];
    return accounts.value;
  };

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
  const getUserSensors = async (owner) => {
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
        const response = await fetch(`https://roseman.airalab.org/api/sensor/sensors/${key}`);
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
  };

  return {
    // State
    accounts,

    // Actions
    addAccount,
    removeAccounts,
    getAccounts,
    getUserSensors,
  };
}
