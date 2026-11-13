// Собирает веб-файлы приложения в папку www/ — её Capacitor кладёт внутрь Android-приложения.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'privacy.html', 'firebase-config.js', 'js', 'icons', 'manifest.webmanifest'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });
// Вкладка «Дети» использует расчёты и каталог детского приложения.
mkdirSync(`${OUT}/kids/js`, { recursive: true });
for (const f of ['kids/js/logic.js', 'kids/js/catalog.js', 'kids/js/friends.js']) cpSync(f, `${OUT}/${f}`);
console.log(`Готово: ${FILES.join(', ')} → ${OUT}/`);
