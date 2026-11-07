# 今日一籤

手機優先的網頁 App（PWA），結合**每日運勢**與**擲筊求籤**。不需要後端或帳號，所有資料只存在本機瀏覽器（localStorage）。

> 本 App 內容僅供娛樂參考，請勿作為重大決定之依據。

## 功能

- **首次設定**：暱稱、出生年月日（時辰可選）→ 算出日主（日干）與生肖，之後可在「設定」修改。
  - 生肖以**立春**換年（與八字年柱一致）。
  - **晚子時**（23:00 後）出生，日柱依子初換日算到隔天。
- **今日運勢**：國曆、農曆、日干支、節氣、黃曆宜忌、沖煞；依今日日干與日主的十神關係給出今日主題與運勢句；幸運五行、幸運色、河圖幸運數字；今日日支沖生肖時顯示提醒；可產生 1080×1350 運勢圖卡分享或存圖。
- **擲筊求籤**：問事 → 稟告 → 擲筊請示 → 搖籤（搖手機或按住按鈕）→ 擲筊確認（一個或連續三個聖筊，可設定）→ 解籤。
  - 筊杯每片正反各 50%：聖筊 50%、笑筊 25%、陰筊 25%（`src/lib/jiao.ts`，以 `crypto.getRandomValues` 取亂數）。
- **籤本**：每次求籤自動存檔（日期、問題、籤號、當日干支），可標記應驗與否、加註記；可匯出／匯入 JSON 備份。
- 動畫（籤筒搖晃、竹籤掉出、筊杯 3D 翻轉落地）、Web Audio 合成音效、Android 震動回饋、深色模式。

## 開發

```bash
npm install
npm run dev        # 開發伺服器
npm test           # 單元測試（曆法、十神、幸運五行、筊杯機率、籤詩資料完整性）
npm run build      # 產生 dist/（靜態檔，可放到任何 HTTPS 主機）
npm run preview    # 預覽 build 結果
```

技術：Vite + Preact + TypeScript、`vite-plugin-pwa`、[`lunar-javascript`](https://github.com/6tail/lunar-javascript)（干支、農曆、宜忌、沖煞、八字一律由它計算）。

## 想調整內容？

| 想改的東西 | 檔案 |
|---|---|
| 十神主題、運勢句、幸運五行規則、五行顏色與數字、沖生肖提醒文字 | `src/data/fortune-rules.json` |
| 籤詩的白話解說、六類建議、吉凶等級 | `src/data/qian-readings.json` |
| 籤詩原文 | `src/data/qian-poems.json`（由腳本產生，請勿手改，見下方） |

`fortune-rules.json` 的文字可自由修改，`{dayGz}`、`{shengxiao}` 等大括號會自動代入。改完執行 `npm test` 可檢查格式。

## 籤詩原文的來源與核對

傳統六十甲子籤原文**不是憑記憶產生**，而是從三個來源下載後逐字比對：

1. 高雄三鳳宮（廟方官網）
2. 台灣好廟網・籤卦結緣讚
3. 台東東海龍門天聖宮（廟方官網）

規則：每一欄（干支、屬性、四句詩）兩家以上相同即採用；三家皆異者人工裁定並寫明理由。360 欄中 336 欄三家完全一致，24 欄有差異，逐筆列在 **[docs/籤詩核對報告.md](docs/籤詩核對報告.md)**；差異也會在 App 解籤頁的「版本異文」中顯示。

重新核對：

```bash
bash scripts/qian/fetch.sh                 # 下載三個來源到 .cache/qian-sources
python3 -I scripts/qian/build.py           # 比對並重新產生 qian-poems.json 與核對報告
```

白話解說、分類建議與吉凶等級皆為本 App 原創撰寫；吉凶等級依詩意與傳統籤解綜合評定，各廟版本不一。

## 其他腳本

- `node scripts/gen-lunar-cht.mjs`：把 lunar-javascript 內建的簡體詞庫以 OpenCC 轉成繁體語言包（`src/data/lunar-cht.json`），少數曆法用字（如地支「丑」）在腳本中人工指定。
- `node scripts/gen-icons.mjs`：由 `scripts/icon.svg` 產生 PWA 圖示（需 Playwright）。

## 部署（之後要上線時）

搖動偵測（DeviceMotion）**必須在 HTTPS 下**才能使用，所以請放在 HTTPS 網址：

- `npm run build` 後把 `dist/` 整個資料夾上傳到任何靜態網站主機即可（GitHub Pages、Cloudflare Pages、Netlify 等）。
- `vite.config.ts` 已設定 `base: './'`，放在網域根目錄或子路徑（例如 `https://帳號.github.io/Lucky/`）都能運作。
- 若用 GitHub Pages：免費方案需要把 repo 設為公開；到 Settings → Pages 選擇來源即可。

## 加到手機主畫面

**iPhone（Safari）**
1. 用 Safari 開啟網址（其他瀏覽器在 iOS 上可能沒有此選項）。
2. 點下方工具列的「分享」按鈕（方框加向上箭頭）。
3. 往下滑，點「加入主畫面」。
4. 名稱保留「今日一籤」，點右上角「加入」。
5. 從主畫面圖示開啟，就是全螢幕 App。第一次搖籤時點「啟用搖一搖」並允許「動作與方向」存取。

**Android（Chrome）**
1. 用 Chrome 開啟網址。
2. 點右上角「⋮」選單。
3. 點「安裝應用程式」或「加到主畫面」。
4. 確認「安裝／新增」，主畫面就會出現圖示。

> 資料存在該瀏覽器的本機儲存空間：從主畫面開啟的 App 與在瀏覽器分頁開啟的網站，在 iPhone 上可能是**兩份不同的資料**。建議固定從主畫面圖示開啟，並定期在「設定 → 匯出備份」。
