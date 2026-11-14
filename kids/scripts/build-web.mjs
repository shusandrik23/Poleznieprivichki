// Собирает веб-файлы детского приложения в папку www/ — её Capacitor кладёт внутрь Android-приложения.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'privacy.html', 'firebase-config.js', 'js', 'icons', 'manifest.webmanifest'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });
console.log(`Готово: ${FILES.join(', ')} → ${OUT}/`);
