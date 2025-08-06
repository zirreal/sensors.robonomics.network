import { defineStore } from "pinia";
import { IDBworkflow, IDBgettable, IDBdeleteByKey } from "@/idb";
import config from "@config";

export const useAccountStore = defineStore('account', {
  state: () => ({
    phrase: "",
    address: "",
    type: "", // sr25519 или ed25519
    devices: []
  }),
  actions: {
    setAccount(phrase, address, type, devices) {
      this.phrase = phrase;
      this.address = address;
      this.type = type;
      this.devices = devices;
    },
    clearAccount() {
      this.phrase = "";
      this.address = "";
      this.type = "";
      this.devices = "";
    },
    deleteFromDB(address) {
     return IDBdeleteByKey(
        config.INDEXEDDB.accounts.dbname,
        config.INDEXEDDB.accounts.dbversion,
        config.INDEXEDDB.accounts.tablename,
        address
      );
    },
    async saveToDB({ address, data, type, devices, ts }) {
      await this.getDB().then((accounts) => {
          IDBworkflow(
            config.INDEXEDDB.accounts.dbname,
            config.INDEXEDDB.accounts.dbversion,
            config.INDEXEDDB.accounts.tablename,
            "readwrite",
            (store) => {
              store.put({
                address,
                data,
                type,
                devices,
                ts: ts || Date.now(),
              });
            },
            "address",
            false
          );
        });
    },

    async getDB() {
      return await IDBgettable(
        config.INDEXEDDB.accounts.dbname,
        config.INDEXEDDB.accounts.dbversion,
        config.INDEXEDDB.accounts.tablename,
        "address",
        false
      );
    },

    async getUserSensors(owner) {
      try {
        const response = await fetch(`https://roseman.airalab.org/api/sensor/sensors/${owner}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return Array.isArray(result.sensors) ? result.sensors : [];
      } catch (error) {
        console.warn('getUserSensors error:', error);
        return [];
      }
    }
  },
});
