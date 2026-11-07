// 以內建 Chromium 將 scripts/icon.svg 轉成 PWA 圖示。用法：node scripts/gen-icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
// Playwright 為環境預裝（全域），以 require 載入
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
const out = (p) => new URL(`../public/${p}`, import.meta.url);
mkdirSync(out('icons'), { recursive: true });

// 一般圖示：圓角＋金框；maskable：滿版底色、圖案縮進安全區
const rounded = svg
  .replace('<rect id="plate" width="512" height="512" fill="url(#bg)"/>',
    '<rect id="plate" width="512" height="512" rx="112" fill="url(#bg)"/><rect x="30" y="30" width="452" height="452" rx="90" fill="none" stroke="#d4a94e" stroke-width="10"/>');
const maskable = svg.replace('<g id="art">', '<g id="art" transform="translate(256 256) scale(.78) translate(-256 -256)">');
const apple = svg.replace('<g id="art">', '<g id="art" transform="translate(256 256) scale(.9) translate(-256 -256)">');

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(markup, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  writeFileSync(out(file), await page.screenshot({ omitBackground: true }));
}
await render(rounded, 192, 'icons/icon-192.png');
await render(rounded, 512, 'icons/icon-512.png');
await render(maskable, 512, 'icons/icon-maskable-512.png');
await render(apple, 180, 'apple-touch-icon.png');
await browser.close();
writeFileSync(out('favicon.svg'), rounded);
console.log('icons done');
