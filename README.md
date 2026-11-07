# 今日一签

手机优先的网页 App（PWA），结合**每日运势**与**掷筊求签**。不需要后端或账号，所有数据只保存在本机浏览器（localStorage）。

> 本 App 内容仅供娱乐参考，请勿作为重大决定之依据。

## 功能

- **首次设置**：昵称、出生年月日（时辰可选）→ 算出日主（日干）与生肖，之后可在“设置”修改。
  - 生肖以**立春**换年（与八字年柱一致）。
  - **晚子时**（23:00 后）出生，日柱依子初换日算到隔天。
- **今日运势**：公历、农历、日干支、节气、黄历宜忌、冲煞；依今日日干与日主的十神关系给出今日主题与运势句；幸运五行、幸运色、河图幸运数字；今日日支冲生肖时显示提醒；可产生 1080×1350 运势卡片分享或保存图片。
- **掷筊求签**：问事 → 禀告 → 掷筊请示 → 摇签（摇手机或按住按钮）→ 掷筊确认（一个或连续三个圣筊，可设置）→ 解签。
  - 筊杯每片正反各 50%：圣筊 50%、笑筊 25%、阴筊 25%（`src/lib/jiao.ts`，以 `crypto.getRandomValues` 取乱数）。
- **签本**：每次求签自动存档（日期、问题、签号、当日干支），可标记应验与否、加备注；可导出／导入 JSON 备份。
- 动画（签筒摇晃、竹签掉出、筊杯 3D 翻转落地）、Web Audio 合成音效、Android 震动反馈、深色模式。

## 开发

```bash
npm install
npm run dev        # 开发伺服器
npm test           # 单元测试（历法、十神、幸运五行、筊杯机率、签诗资料完整性）
npm run build      # 产生 dist/（静态档，可放到任何 HTTPS 主机）
npm run preview    # 预览 build 结果
npm run build:artifact -- 输出.html   # 产生单一 HTML 预览版（JS／CSS 内嵌，无 Service Worker、无摇动侦测）
```

技术：Vite + Preact + TypeScript、`vite-plugin-pwa`、[`lunar-javascript`](https://github.com/6tail/lunar-javascript)（干支、农历、宜忌、冲煞、八字一律由它计算）。

## 想调整内容？

| 想改的东西 | 文件 |
|---|---|
| 十神主题、运势句、幸运五行规则、五行颜色与数字、冲生肖提醒文字 | `src/data/fortune-rules.json` |
| 签诗的白话解说、六类建议、吉凶等级 | `src/data/qian-readings.json` |
| 签诗原文 | `src/data/qian-poems.json`（繁体核对定稿）与 `qian-poems-hans.json`（App 显示用的简体版），皆由脚本产生，请勿手改，见下方 |

`fortune-rules.json` 的文字可自由修改，`{dayGz}`、`{shengxiao}` 等大括号会自动代入。改完执行 `npm test` 可检查格式。

## 签诗原文的来源与核对

传统六十甲子签原文**不是凭记忆产生**，而是从三个来源下载后逐字比对：

1. 高雄三凤宫（庙方官网）
2. 台湾好庙网・签卦结缘赞
3. 台东东海龙门天圣宫（庙方官网）

规则：每一栏（干支、属性、四句诗）两家以上相同即采用；三家皆异者人工裁定并写明理由。360 栏中 336 栏三家完全一致，24 栏有差异，逐笔列在 **[docs/签诗核对报告.md](docs/签诗核对报告.md)**；差异也会在 App 解签页的“版本异文”中显示。

重新核对：

```bash
bash scripts/qian/fetch.sh                 # 下载三个来源到 .cache/qian-sources
python3 -I scripts/qian/build.py           # 比对并重新产生 qian-poems.json 与核对报告
node scripts/gen-poems-hans.mjs            # 由繁体定稿转出简体版 qian-poems-hans.json
```

白话解说、分类建议与吉凶等级皆为本 App 原创撰写；吉凶等级依诗意与传统签解综合评定，各庙版本不一。

## 其他脚本

- `node scripts/gen-poems-hans.mjs`：以 OpenCC 把繁体核对定稿的签诗转成简体（核对时以三个台湾来源的繁体原文逐字比对，因此定稿保留繁体）。
- `node scripts/gen-icons.mjs`：由 `scripts/icon.svg` 产生 PWA 图示（需 Playwright）。

## 部署（GitHub Pages）

`.github/workflows/deploy.yml` 会在合并到 `main` 时自动测试、建置并部署，网址为：

**https://a669140250-a11y.github.io/Lucky/**

第一次部署前要在 GitHub 上设置两件事：

1. **仓库改为公开**（免费方案的 GitHub Pages 只支持公开仓库；GitHub Pro 可跳过）：Settings → General → 最下方 Danger Zone → Change visibility → Public。
2. **启用 Pages**：Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。

之后合并到 `main` 就会自动部署；也可以在 Actions 页选“部署到 GitHub Pages” → Run workflow 手动执行。

摇动侦测（DeviceMotion）必须在 HTTPS 下使用，GitHub Pages 本身就是 HTTPS。`vite.config.ts` 设置了 `base: './'`，放在子路径 `/Lucky/` 也能正常运作；`dist/` 也可以上传到任何其他静态网站主机。

## 加到手机主屏幕

**iPhone（Safari）**
1. 用 Safari 开启网址（其他浏览器在 iOS 上可能没有此选项）。
2. 点下方工具列的“分享”按钮（方框加向上箭头）。
3. 往下滑，点“添加到主屏幕”。
4. 名称保留“今日一签”，点右上角“加入”。
5. 从主屏幕图标打开，就是全屏 App。第一次摇签时点“启用摇一摇”，并允许访问“运动与方向”。

**Android（Chrome）**
1. 用 Chrome 开启网址。
2. 点右上角“⋮”选单。
3. 点“安装应用”或“添加到主屏幕”。
4. 确认“安装／新增”，主屏幕就会出现图标。

> 数据保存在该浏览器的本地存储里：从主屏幕开启的 App 与在浏览器分页开启的网站，在 iPhone 上可能是**两份不同的数据**。建议固定从主屏幕图标打开，并定期在“设置 → 导出备份”。
