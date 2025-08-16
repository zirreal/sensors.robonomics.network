import { defineStore } from "pinia";
import {
  IDBworkflow,
  IDBgettable,
  IDBdeleteByKey,
  IDBcleartable,
  notifyDBChange,
  hasIndexedDB,
} from "../utils/idb";
import schemas from "@/config/default/idb-schemas.json";

const schema = schemas?.Altruist || {};
const DB_NAME = schema.dbname || "Altruist";
const STORE = "Accounts";

export const useAccountStore = defineStore("account", {
  state: () => ({
    accounts: [] // [{ phrase, address, type, devices, ts }]
  }),
  actions: {
    async addAccount({ phrase, address, type, devices, ts }) {
      const idx = this.accounts.findIndex(a => a.address === address);
      const item = { phrase, address, type, devices, ts: ts || Date.now() };
      if (idx !== -1) this.accounts[idx] = item; else this.accounts.push(item);

      if (hasIndexedDB()) {
        IDBworkflow(DB_NAME, STORE, "readwrite", store => {
          store.put(item);
        });
        notifyDBChange(DB_NAME, STORE);
      }
      return item;
    },

    async removeAccounts(targets) {
      if (typeof targets === "string" && targets) {
        this.accounts = this.accounts.filter(a => a.address !== targets);
        if (hasIndexedDB()) {
          await IDBdeleteByKey(DB_NAME, STORE, targets);
          notifyDBChange(DB_NAME, STORE);
        }
        return;
      }

      if (Array.isArray(targets) && targets.length > 0) {
        const toDelete = new Set(targets);
        this.accounts = this.accounts.filter(a => !toDelete.has(a.address));
        if (hasIndexedDB()) {
          await Promise.all(targets.map(addr => IDBdeleteByKey(DB_NAME, STORE, addr)));
          notifyDBChange(DB_NAME, STORE);
        }
        return;
      }

      this.accounts = [];
      if (hasIndexedDB()) {
        IDBcleartable(DB_NAME, STORE);
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
        const response = await fetch(`https://roseman.airalab.org/api/sensor/sensors/${owner}`);
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
