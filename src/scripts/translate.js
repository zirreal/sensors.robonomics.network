import fs from "fs";
import path from "path";
import fg from "fast-glob";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_KEY });

// CONFIG 
const LANGUAGES = ["en", "ru"];  // Add/remove languages here
const SKIP_KEYS = []; // Add keys to skip here
const PRESERVE_KEYS = [
  "Climate",
  "Daily Recap", 
  "Realtime",
  "RADIATION",
  "Pressure",
  "Good",
  "Moderate",
  "Unhealthy for Sensitive Groups",
  "Unhealthy",
  "Very Unhealthy",
  "Hazardous"
];
const TRANSLATION_FILES_DIR = "src/translate";
const CACHE_FILE = "src/scripts/openai-cache.json";
const PROJECT_FILES_GLOB = ["src/**/*.vue", "src/**/*.js"];

// Flatten nested object to flat keys with dots
const flatten = (obj, prefix = "") => {
  let res = {};
  for (const key in obj) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "object" && val !== null) {
      Object.assign(res, flatten(val, newKey));
    } else {
      res[newKey] = val;
    }
  }
  return res;
};

// Load/save cache 
const loadCache = () => {
  if (fs.existsSync(CACHE_FILE))
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  return {};
};

const saveCache = (cache) => {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
};

// Extract translation keys 
const extractTranslationKeys = async () => {
  const files = await fg(PROJECT_FILES_GLOB);
  // Match both $t(...) and t(...)
  const regex = /(?:\$)?t\(\s*["'`]([^"'`\s][^"'`]*?)["'`]\s*\)/g;
  const keys = new Set();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = regex.exec(content))) {
      keys.add(match[1]);
    }
  }

  return [...keys];
};

// Translate using OpenAI with caching 
const translateWithOpenAI = async (text, targetLang, cache) => {
  const cacheKey = `${text}|${targetLang}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the following phrase to ${targetLang}. Return only the translation, no quotes.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  const translated = response.choices[0].message.content.trim();
  cache[cacheKey] = translated;
  saveCache(cache);
  return translated;
};

// Load and save locale files 
const loadLocaleFile = async (lang) => {
  const filePath = path.resolve(TRANSLATION_FILES_DIR, `${lang}.js`);
  if (!fs.existsSync(filePath)) return {};
  const fileUrl = `file://${filePath}`;
  const module = await import(fileUrl);
  return module.default || {};
};

const saveLocaleFile = (lang, data) => {
  const filePath = path.join(TRANSLATION_FILES_DIR, `${lang}.js`);
  const content = "export default " + JSON.stringify(data, null, 2) + ";";
  fs.writeFileSync(filePath, content);
};

// Main function 
const run = async () => {
  const keys = await extractTranslationKeys();
  const cache = loadCache();

  const isSimpleNestedKey = (key) => /^[\w\d_.-]+$/.test(key);
  const looksLikeCodeIdentifier = (key) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
  const looksLikeUserText = (key) => /[ \.,!?:\-—]/.test(key);

  for (const lang of LANGUAGES) {
    console.log(`🌐 Processing language: ${lang}`);

    // Load and flatten existing translations
    const translationsRaw = await loadLocaleFile(lang);
    const translations = flatten(translationsRaw);

    // Remove unused keys
    const cleanTranslations = {};
    for (const tKey in translations) {
      if (keys.includes(tKey) || PRESERVE_KEYS.includes(tKey)) {
        cleanTranslations[tKey] = translations[tKey];
      } else {
        console.log(`🗑️ Removing unused key [${lang}]: ${tKey}`);
      }
    }


    // keys to translate
    const SHORT_LIST = ['Yes', 'No', 'Model', 'New', 'Housing', 'Climate', 'Type', 'Price', 'Photo', 'Limited', 'Map'];

    // Translate missing keys
    for (const key of keys) {
      if (SKIP_KEYS.includes(key)) {
        console.log(`⏭️ Skipping key (in skip list): ${key}`);
        continue;
      }

      if (!key.trim()) {
        console.log(`⏭️ Skipping key (empty or whitespace): ${key}`);
        continue;
      }

      if (/^[,.:;#\s]+$/.test(key)) {
        console.log(`⏭️ Skipping key (only punctuation): ${key}`);
        continue;
      }

      if (key.startsWith("#")) {
        console.log(`⏭️ Skipping key (starts with #): ${key}`);
        continue;
      }

     
      const hasTemplateVariable = /\$\{[^}]+\}/;
      const looksLikePath = /^\/|\/.*\//;
      if (hasTemplateVariable.test(key) || looksLikePath.test(key)) {
        console.log(`⏭️ Skipping key (looks like path/template variable): ${key}`);
        continue;
      }

      if (looksLikeCodeIdentifier(key) && !looksLikeUserText(key) && !SHORT_LIST.includes(key)) {
        console.log(`⏭️ Skipping key (looks like code identifier): ${key}`);
        continue;
      }

      // Skip if already translated
      if (cleanTranslations[key]) continue;

      let translated;
      if (lang === "en") {
        translated = key; // copy verbatim for English
      } else {
        const baseText = isSimpleNestedKey(key)
          ? key.split(".").pop().replace(/_/g, " ")
          : key;
        translated = await translateWithOpenAI(baseText, lang, cache);
      }

      cleanTranslations[key] = translated;

      console.log(`${lang === "en" ? "📝" : "✅"} [${lang}] ${key} → ${translated}`);
    }

    // Save flat translations
    saveLocaleFile(lang, cleanTranslations);
  }

  console.log("🎉 Done!");
};

run();
