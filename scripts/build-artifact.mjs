// 产生「预览连结」用的单一 HTML 档（JS／CSS 全部内嵌），供 claude.ai Artifact 发布。
// 用法：npm run build:artifact [-- 输出路径]（默认 dist-artifact/今日一签.html）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artifact';
const out = process.argv[2] || join(dir, '今日一签.html');
const assets = readdirSync(join(dir, 'assets'));
const pick = (ext) => {
  const f = assets.filter((x) => x.endsWith(ext));
  if (f.length !== 1) throw new Error(`预期只有一个 ${ext} 档，实际：${f.join(', ')}`);
  return readFileSync(join(dir, 'assets', f[0]), 'utf8');
};
const css = pick('.css').replace(/<\/style/gi, '<\\/style');
const js = pick('.js').replace(/<\/script/gi, '<\\/script');

// 平台会自动包上 <!doctype>/<head>/<body>，这里只写页面内容
const html = `<title>今日一签</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap">
<style>${css}
/* 预览框架已依安全区留白，不再重复 */
.app{padding-top:0}
</style>
<div id="app"></div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB`);
