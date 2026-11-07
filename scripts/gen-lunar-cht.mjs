// 由 lunar-javascript 內建的簡體語言包（chs）產生繁體（台灣）語言包。
// 用法：node scripts/gen-lunar-cht.mjs  → 輸出 src/data/lunar-cht.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as OpenCC from 'opencc-js';

const require = createRequire(import.meta.url);
const src = readFileSync(require.resolve('lunar-javascript/lunar.js'), 'utf8');
const start = src.indexOf("'chs': {");
const end = src.indexOf("'en': {", start);
if (start < 0 || end < 0) throw new Error('找不到 chs 語言包');
const block = src.slice(start, end);
const re = /'([^']+)':\s*'([^']*)'/g;
const conv = OpenCC.Converter({ from: 'cn', to: 'tw' });

// OpenCC 單字轉換無法判斷語境的少數詞，於此人工指定（曆法用語）。
const OVERRIDE = {
  'dz.chou': '丑', // 地支丑，不是美醜的醜
  's.badLuck': '凶', // 吉凶
  'xx.dou': '斗', // 二十八宿斗宿
  'ts.zhan': '占', // 胎神占方
  'sn.yinYangJiChong': '陰陽擊沖',
  'sn.yangCuoYinChong': '陽錯陰沖',
  'sn.yangPoYinChong': '陽破陰沖',
  'h.zhengNiao': '征鳥厲疾',
  'h.zheChongXianFu': '蟄蟲咸俯',
};

const out = {};
let m;
while ((m = re.exec(block))) {
  const [, key, val] = m;
  if (key === 'chs') continue;
  out[key] = OVERRIDE[key] ?? conv(val);
}
writeFileSync(new URL('../src/data/lunar-cht.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('messages:', Object.keys(out).length);
