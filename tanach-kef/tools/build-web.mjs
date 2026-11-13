// Collects the web app into www/ — Capacitor puts this folder inside the Android app.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'app.js', 'style.css', 'fonts.css', 'fonts', 'content', 'vendor', 'icon.svg'];
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });
console.log(`www/: ${FILES.join(', ')}`);
