// Собирает веб-файлы приложения в папку www/ — её Capacitor кладёт внутрь Android-приложения.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'firebase-config.js', 'js', 'icons', 'manifest.webmanifest'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });
// ядро Capacitor для вызова нативных плагинов (подгружается только в Android-приложении)
cpSync('node_modules/@capacitor/core/dist/capacitor.js', `${OUT}/vendor/capacitor.js`);
console.log(`Готово: ${FILES.join(', ')} → ${OUT}/`);
