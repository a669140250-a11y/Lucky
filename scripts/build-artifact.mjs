// 產生「預覽連結」用的單一 HTML 檔（JS／CSS 全部內嵌），供 claude.ai Artifact 發布。
// 用法：npm run build:artifact [-- 輸出路徑]（預設 dist-artifact/今日一籤.html）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artifact';
const out = process.argv[2] || join(dir, '今日一籤.html');
const assets = readdirSync(join(dir, 'assets'));
const pick = (ext) => {
  const f = assets.filter((x) => x.endsWith(ext));
  if (f.length !== 1) throw new Error(`預期只有一個 ${ext} 檔，實際：${f.join(', ')}`);
  return readFileSync(join(dir, 'assets', f[0]), 'utf8');
};
const css = pick('.css').replace(/<\/style/gi, '<\\/style');
const js = pick('.js').replace(/<\/script/gi, '<\\/script');

// 平台會自動包上 <!doctype>/<head>/<body>，這裡只寫頁面內容
const html = `<title>今日一籤</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap">
<style>${css}
/* 預覽框架已依安全區留白，不再重複 */
.app{padding-top:0}
</style>
<div id="app"></div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB`);
