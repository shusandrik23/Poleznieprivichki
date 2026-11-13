// Renders the Android launcher icons and splash screens from icon.svg (needs Playwright + Chromium).
//   node tools/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'android/app/src/main/res');
const svg = fs.readFileSync(path.join(ROOT, 'icon.svg'), 'utf8');
const mascot = svg.match(/<g [\s\S]*<\/g>/)[0];
const BG = '#1b8584';
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const legacy = svg;
const round = svg.replace('rx="112"', 'rx="256"');
// adaptive foreground: 108dp canvas, keep the mascot inside the central 66dp safe zone
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(0.6) translate(-256 -256)">${mascot}</g></svg>`;
const splash = (w, h) => {
  const s = Math.min(w, h) * 0.45;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <g transform="translate(${(w - s) / 2} ${(h - s) / 2}) scale(${s / 512})">
    <circle cx="256" cy="256" r="196" fill="#22999a"/>${mascot}</g></svg>`;
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  async function render(svgText, w, h, file) {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svgText.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
    await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(RES, `mipmap-${d}`);
    await render(legacy, 48 * k, 48 * k, path.join(dir, 'ic_launcher.png'));
    await render(round, 48 * k, 48 * k, path.join(dir, 'ic_launcher_round.png'));
    await render(foreground, 108 * k, 108 * k, path.join(dir, 'ic_launcher_foreground.png'));
  }
  for (const dir of fs.readdirSync(RES).filter(n => n.startsWith('drawable'))) {
    const f = path.join(RES, dir, 'splash.png');
    if (!fs.existsSync(f)) continue;
    const buf = fs.readFileSync(f);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    await render(splash(w, h), w, h, f);
  }
  fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  await b.close();
  console.log('icons + splash written');
})();
