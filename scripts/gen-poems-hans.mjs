// 由核对定稿的繁体签诗（src/data/qian-poems.json）产生简体版给 App 显示。
// 用法：node scripts/gen-poems-hans.mjs（在 scripts/qian/build.py 之后执行）
import { readFileSync, writeFileSync } from 'node:fs';
import * as OpenCC from 'opencc-js';

const conv = OpenCC.Converter({ from: 'tw', to: 'cn' });
const src = new URL('../src/data/qian-poems.json', import.meta.url);
const out = new URL('../src/data/qian-poems-hans.json', import.meta.url);
const data = JSON.parse(readFileSync(src, 'utf8'));
const walk = (v) =>
  typeof v === 'string' ? conv(v)
  : Array.isArray(v) ? v.map(walk)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [conv(k), walk(x)]))
  : v;
const hans = walk(data);
hans._note = '由 scripts/gen-poems-hans.mjs 自 qian-poems.json（繁体核对定稿）转换产生，请勿手改。';
writeFileSync(out, JSON.stringify(hans, null, 1) + '\n');
console.log('poems:', hans.poems.length);
