/**
 * TTF → WOFF + WOFF2 для src/assets/fonts/NotoSans-*.ttf
 * Запуск: npm run fonts:convert
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ttf2woff from "ttf2woff";
import ttf2woff2 from "ttf2woff2";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const fontsDir = join(root, "src/assets/fonts");
const bases = ["NotoSans-Regular", "NotoSans-Bold", "NotoSans-Black"];

for (const base of bases) {
  const ttfPath = join(fontsDir, `${base}.ttf`);
  const buf = readFileSync(ttfPath);
  writeFileSync(join(fontsDir, `${base}.woff`), Buffer.from(ttf2woff(buf)));
  writeFileSync(join(fontsDir, `${base}.woff2`), ttf2woff2(buf));
  console.log("ok:", base);
}
