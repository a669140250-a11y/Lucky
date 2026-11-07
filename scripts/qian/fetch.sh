#!/usr/bin/env bash
# 下載三個來源的六十甲子籤頁面，供 build.py 逐字比對。
# 用法：bash scripts/qian/fetch.sh [輸出目錄]（預設 .cache/qian-sources）
set -euo pipefail
OUT="${1:-.cache/qian-sources}"
mkdir -p "$OUT/sunfong" "$OUT/temple01" "$OUT/donghai"

for i in $(seq 1 60); do
  n=$(printf "%02d" "$i")
  # 高雄三鳳宮（廟方官網）：ml_id 20220919003 ~ 20220919062 依序為第 1 ~ 60 籤
  id=$(printf "202209190%02d" $((i + 2)))
  curl -sSf --max-time 30 -o "$OUT/sunfong/$i.html" "https://sunfong.org.tw/?act=menuinfo&ml_id=$id"
  # 台灣好廟網・籤卦結緣讚
  curl -sSf --max-time 30 -o "$OUT/temple01/$i.html" "https://qiangua.temple01.com/qianshi.php?t=fs60&s=$i"
  # 台東東海龍門天聖宮（廟方官網）；第 5 籤網址特殊
  slug="fs$n"; [ "$i" = 5 ] && slug="fs05-2"
  curl -sSf --max-time 30 -o "$OUT/donghai/$i.html" "https://donghaimazu.com/post/fortune-sticks/$slug/"
  sleep 0.4
done
echo "done: $OUT"
