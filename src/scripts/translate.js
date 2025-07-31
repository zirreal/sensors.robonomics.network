import fs from "fs";
import path from "path";
import fg from "fast-glob";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, "../");
const TRANSLATION_FILES_DIR = path.resolve(SRC_DIR, "translate");
const LANGUAGES = ["en", "ru"];
const CACHE_FILE = path.resolve(__dirname, ".cache.json");
const KEY_MAP_FILE = path.resolve(__dirname, ".keymap.json");
const SKIP_KEYS = [];


const SHORT_SENTENCE_WHITELIST = new Set([
  "yes",
  "no",
  "ok",
  "cancel",
  "or",
  "if",
  "download",
  "noise",
  "climate",
  "dust & particles",
  "pressure",
  "rainfall",
  "temperature",
  "humidity",
  "wind",
]);

const isSentenceKey = (str) =>
  typeof str === "string" &&
  str.length > 15 &&
  /[.?!]/.test(str) &&
  !SHORT_SENTENCE_WHITELIST.has(str);

const generateShortKey = (text) =>
  "auto_" +
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 40)
    .replace(/^_+|_+$/g, "") +
  "_" + Math.random().toString(36).substring(2, 6);

const flatten = (obj, prefix = "", res = {}) => {
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object") flatten(val, fullKey, res);
    else res[fullKey] = val;
  }
  return res;
};

const unflatten = (flat) => {
  const result = {};
  for (const key in flat) {
    const parts = key.split(".");
    let curr = result;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) curr[part] = flat[key];
      else curr = curr[part] = curr[part] || {};
    });
  }
  return result;
};

const getDeep = (obj, key) => key.split(".").reduce((o, i) => (o ? o[i] : undefined), obj);
const setDeep = (obj, key, value) => {
  const parts = key.split(".");
  let curr = obj;
  parts.forEach((part, i) => {
    if (i === parts.length - 1) curr[part] = value;
    else curr = curr[part] = curr[part] || {};
  });
};

const extractTranslationKeysAndReplace = async () => {
  const entries = await fg(["**/*.vue", "**/*.js"], {
    cwd: SRC_DIR,
    ignore: ["node_modules/**"],
    absolute: true,
  });

  const regex = /(?:\$t|t)\((['"])(.*?)\1\)/g;
  const keyMap = fs.existsSync(KEY_MAP_FILE) ? JSON.parse(fs.readFileSync(KEY_MAP_FILE, "utf8")) : {};
  const usedKeys = new Set();

  for (const file of entries) {
    let content = fs.readFileSync(file, "utf-8");
    let updated = false;

    content = content.replace(regex, (match, quote, originalKey) => {
      if (SKIP_KEYS.includes(originalKey)) {
        usedKeys.add(originalKey);
        return match;
      }

      if (!isSentenceKey(originalKey)) {
        usedKeys.add(originalKey);
        return match;
      }

      if (!keyMap[originalKey]) {
        keyMap[originalKey] = generateShortKey(originalKey);
      }

      usedKeys.add(keyMap[originalKey]);
      updated = true;
      return `$t(${quote}${keyMap[originalKey]}${quote})`;
    });

    if (updated) fs.writeFileSync(file, content, "utf-8");
  }

  fs.writeFileSync(KEY_MAP_FILE, JSON.stringify(keyMap, null, 2), "utf-8");
  return { usedKeys: [...usedKeys], keyMap };
};

const loadLocaleFile = async (lang) => {
  const filePath = path.join(TRANSLATION_FILES_DIR, `${lang}.js`);
  if (!fs.existsSync(filePath)) return {};
  const module = await import(`${filePath}?update=${Date.now()}`);
  return module.default || {};
};

const saveLocaleFile = (lang, data) => {
  const filePath = path.join(TRANSLATION_FILES_DIR, `${lang}.js`);
  const content = `export default ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(filePath, content, "utf-8");
};

const loadCache = () => (fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {});
const saveCache = (cache) => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");

const translateWithOpenAI = async (text, targetLang, cache) => {
  const cacheKey = `${targetLang}:${text}`;
  if (cache[cacheKey]) return cache[cacheKey];
  console.log(`🌍 Translating → [${targetLang}]: ${text}`);
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: `Translate into ${targetLang}.` },
      { role: "user", content: text },
    ],
  });
  const translated = response.choices[0].message.content.trim();
  cache[cacheKey] = translated;
  saveCache(cache);
  return translated;
};

const cleanupUnusedKeys = async (lang, usedKeys) => {
  const translations = await loadLocaleFile(lang);
  const flat = flatten(translations);
  const cleaned = {};
  for (const key of Object.keys(flat)) {
    if (usedKeys.includes(key)) cleaned[key] = flat[key];
    else console.log(`🗑️  [${lang}] removed unused: ${key}`);
  }
  const nested = unflatten(cleaned);
  saveLocaleFile(lang, nested);
};

const run = async () => {
  const { usedKeys, keyMap } = await extractTranslationKeysAndReplace();
  const cache = loadCache();

  for (const lang of LANGUAGES) {
    console.log(`\n🌐 Processing: ${lang}`);
    const translations = await loadLocaleFile(lang);

    for (const original in keyMap) {
      const shortKey = keyMap[original];
      if (getDeep(translations, shortKey)) continue;
      if (lang === "en") {
        setDeep(translations, shortKey, original);
        console.log(`📝 [en] ${shortKey} => "${original}"`);
      } else {
        const translated = await translateWithOpenAI(original, lang, cache);
        setDeep(translations, shortKey, translated);
        console.log(`✅ [${lang}] ${shortKey} => "${translated}"`);
      }
    }

    saveLocaleFile(lang, translations);
    await cleanupUnusedKeys(lang, usedKeys);
  }

  console.log("\n✅ All done.");
};

run();
