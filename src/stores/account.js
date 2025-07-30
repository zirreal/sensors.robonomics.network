import { defineStore } from "pinia";
import { IDBworkflow, IDBgettable } from "@/idb";
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
      // удаляем аккаунт, после чего если есть другие — помечаем первый активным
      IDBworkflow(
        config.INDEXEDDB.accounts.dbname,
        config.INDEXEDDB.accounts.dbversion,
        config.INDEXEDDB.accounts.tablename,
        "readwrite",
        (store) => {
          store.delete(address);

          // после удаления отмечаем активным первый аккаунт (если остался)
          IDBgettable(config.INDEXEDDB.accounts.dbname, config.INDEXEDDB.accounts.dbversion, config.INDEXEDDB.accounts.tablename).then((accounts) => {
            if (accounts && accounts.length > 0) {
              // снимаем active у всех, потом ставим первому
              accounts.forEach(acc => {
                acc.active = false;
                store.put(acc);
              });
              const first = accounts[0];
              first.active = true;
              store.put(first);
            }
          });
        },
        "address",
        false
      );
    },
    markActiveInDB(address) {
      // сбрасываем active у всех, отмечаем active для address
      IDBgettable(config.INDEXEDDB.accounts.dbname, config.INDEXEDDB.accounts.dbversion, config.INDEXEDDB.accounts.tablename).then((accounts) => {
        IDBworkflow(
          config.INDEXEDDB.accounts.dbname,
          config.INDEXEDDB.accounts.dbversion,
          config.INDEXEDDB.accounts.tablename,
          "readwrite",
          (store) => {
            accounts.forEach(acc => {
              acc.active = acc.address === address;
              store.put(acc);
            });
          },
          "address",
          false
        );
      });
    },
    saveToDB({ address, data, type, devices, ts }) {
      // сохраняем аккаунт: снимаем active со всех, ставим active новому
      IDBgettable(config.INDEXEDDB.accounts.dbname, config.INDEXEDDB.accounts.dbversion, config.INDEXEDDB.accounts.tablename)
        .then((accounts) => {
          IDBworkflow(
            config.INDEXEDDB.accounts.dbname,
            config.INDEXEDDB.accounts.dbversion,
            config.INDEXEDDB.accounts.tablename,
            "readwrite",
            (store) => {
              if (accounts && accounts.length > 0) {
                accounts.forEach(acc => {
                  acc.active = false;
                  store.put(acc);
                });
              }
              store.put({
                address,
                data,
                type,
                devices,
                ts: ts || Date.now(),
                active: true
              });
            },
            "address",
            false
          );
        });
    }
  },
});
