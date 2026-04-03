import { ref } from "vue";
import {
  IDBworkflow,
  IDBgettable,
  IDBdeleteByKey,
  notifyDBChange,
  hasIndexedDB,
  encryptText,
  decryptText,
} from "../utils/idb";
import { idbschemas } from "@config";

const schema = idbschemas?.Altruist || {};
const DB_NAME = schema.dbname;
const STORE = Object.keys(schema.stores || { Accounts: {} })[0] || "Accounts";
const SESSION_ACCOUNTS_KEY = "altruist_session_accounts";

// Small in-memory cache for getUserSensors to prevent request storms.
// - USER_SENSORS_TTL_MS: how long a successful result is considered fresh.
// - userSensorsCache: stores either the last resolved data with timestamp,
//   or a pending promise to deduplicate parallel calls for the same owner.
const USER_SENSORS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const userSensorsCache = new Map(); // owner -> { ts, data } | { promise }

// Глобальное состояние аккаунтов (разделяется между всеми экземплярами composable)
const accounts = ref([]); // [{ phrase, address, type, devices, ts }]

function readSessionAccounts() {
  try {
    const raw = sessionStorage.getItem(SESSION_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessionAccounts(list) {
  try {
    if (!Array.isArray(list) || list.length === 0) {
      sessionStorage.removeItem(SESSION_ACCOUNTS_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
  }
}

function isEncryptedPhrasePayload(value) {
  return !!(
    value &&
    typeof value === "object" &&
    Array.isArray(value.ciphertext) &&
    Array.isArray(value.iv) &&
    value.key
  );
}

async function encryptPhraseForStorage(phrase) {
  const text = typeof phrase === "string" ? phrase : "";
  if (!text) return "";
  try {
    return await encryptText(text);
  } catch {
    // Fallback for environments where WebCrypto is unavailable.
    return text;
  }
}

async function decryptPhraseFromStorage(phrase) {
  if (typeof phrase === "string") return phrase;
  if (!isEncryptedPhrasePayload(phrase)) return "";
  try {
    const decrypted = await decryptText(phrase);
    return typeof decrypted === "string" ? decrypted : "";
  } catch {
    return "";
  }
}

async function normalizeAccountsFromStorage(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return Promise.all(
    list.map(async (acc) => ({
      ...acc,
      phrase: await decryptPhraseFromStorage(acc?.phrase),
    }))
  );
}

export function useAccounts() {
  const addAccount = async ({ phrase, address, type, devices, ts }, { persist = true } = {}) => {
    // console.log('addAccount', phrase, address, type, devices, ts, persist)
    const idx = accounts.value.findIndex((a) => a.address === address);
    const item = { phrase, address, type, devices, ts: ts || Date.now(), persist };
    if (idx !== -1) accounts.value[idx] = item;
    else accounts.value.push(item);

    if (persist && hasIndexedDB()) {
      const encryptedPhrase = await encryptPhraseForStorage(phrase);
      const itemForStorage = { ...item, phrase: encryptedPhrase, persist: true };
      IDBworkflow(DB_NAME, STORE, "readwrite", (store) => {
        store.put(itemForStorage);
      });
      notifyDBChange(DB_NAME, STORE);
      const session = readSessionAccounts().filter((a) => a.address !== address);
      writeSessionAccounts(session);
    } else {
      const encryptedPhrase = await encryptPhraseForStorage(phrase);
      const itemForStorage = { ...item, phrase: encryptedPhrase, persist: false };
      const session = readSessionAccounts().filter((a) => a.address !== address);
      session.push(itemForStorage);
      writeSessionAccounts(session);
    }
    return item;
  };

  const removeAccounts = async (addresses) => {
    const list = Array.isArray(addresses) ? addresses : addresses ? [addresses] : [];
    if (list.length === 0) return;

    const toDelete = new Set(list);

    accounts.value = accounts.value.filter((a) => !toDelete.has(a.address));

    const session = readSessionAccounts().filter((a) => !toDelete.has(a.address));
    writeSessionAccounts(session);

    if (hasIndexedDB()) {
      await Promise.all(list.map((addr) => IDBdeleteByKey(DB_NAME, STORE, addr)));
      notifyDBChange(DB_NAME, STORE);
    }
  };

  const getAccounts = async () => {
    const sessionRaw = readSessionAccounts();
    const sessionAccounts = (await normalizeAccountsFromStorage(sessionRaw)).map((acc) => ({
      ...acc,
      persist: false,
    }));

    // Best-effort migration: if legacy plaintext phrases are present in sessionStorage, re-save encrypted.
    const sessionHasLegacyPlain = sessionRaw.some(
      (acc) => typeof acc?.phrase === "string" && String(acc.phrase).trim().length > 0
    );
    if (sessionHasLegacyPlain) {
      const migrated = await Promise.all(
        sessionRaw.map(async (acc) => {
          const p = acc?.phrase;
          if (typeof p === "string" && p.trim()) {
            return { ...acc, phrase: await encryptPhraseForStorage(p) };
          }
          return acc;
        })
      );
      writeSessionAccounts(migrated);
    }

    if (!hasIndexedDB()) {
      accounts.value = [...sessionAccounts];
      return accounts.value;
    }
    const data = await IDBgettable(DB_NAME, STORE);
    const persistentRaw = Array.isArray(data) ? data : [];
    const persistentAccounts = (await normalizeAccountsFromStorage(persistentRaw)).map((acc) => ({
      ...acc,
      persist: acc?.persist === false ? false : true,
    }));

    // Best-effort migration: if legacy plaintext phrases are present in IndexedDB, re-save encrypted.
    const legacyPlain = persistentRaw.filter(
      (acc) => typeof acc?.phrase === "string" && String(acc.phrase).trim().length > 0
    );
    if (legacyPlain.length > 0) {
      for (const acc of legacyPlain) {
        const encryptedPhrase = await encryptPhraseForStorage(acc.phrase);
        IDBworkflow(DB_NAME, STORE, "readwrite", (store) => {
          store.put({ ...acc, phrase: encryptedPhrase });
        });
      }
      notifyDBChange(DB_NAME, STORE);
    }

    const merged = new Map();
    for (const acc of persistentAccounts) merged.set(acc.address, acc);
    for (const acc of sessionAccounts) merged.set(acc.address, acc);
    accounts.value = [...merged.values()];
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
