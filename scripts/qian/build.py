"""六十甲子籤原文：三來源逐字比對、多數決定稿。

用法（先跑 fetch.sh 下載頁面）：
    python3 -I scripts/qian/build.py .cache/qian-sources

輸出：
    src/data/qian-poems.json   定稿原文（請勿手改，改動請改來源或下方 MANUAL）
    docs/籤詩核對報告.md        每一處差異與採用理由
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / '.cache/qian-sources')

SOURCES = [
    {'id': 'sunfong', 'name': '高雄三鳳宮（廟方官網）',
     'url': 'https://sunfong.org.tw/?act=menuinfo&ml_id=20220721001'},
    {'id': 'temple01', 'name': '台灣好廟網・籤卦結緣讚',
     'url': 'https://qiangua.temple01.com/qianshi.php?t=fs60&s=1'},
    {'id': 'donghai', 'name': '台東東海龍門天聖宮（廟方官網）',
     'url': 'https://donghaimazu.com/fortune-stick/'},
]
SHORT = {'sunfong': '三鳳宮', 'temple01': '好廟網', 'donghai': '天聖宮'}

# 三家皆不同時的人工裁定：(籤號, 句序 1-4) -> (採用文字, 理由)
MANUAL = {
    (29, 2): ('如今反在暗中藏',
              '三家各作「還／反／返」。「反」為「返」之古字，好廟網、天聖宮兩家意同，'
              '採好廟網字形「反」。'),
}

NUM = '一二三四五六七八九'


def cn(n: int) -> str:
    if n < 10:
        return NUM[n - 1]
    t, u = divmod(n, 10)
    return ('' if t == 1 else NUM[t - 1]) + '十' + (NUM[u - 1] if u else '')


def text_lines(path: Path) -> list[str]:
    s = path.read_text(encoding='utf-8', errors='replace')
    s = re.sub(r'<script.*?</script>|<style.*?</style>|<!--.*?-->', '', s, flags=re.S)
    s = html.unescape(re.sub(r'<[^>]+>', '\n', s))
    return [x.strip() for x in s.split('\n') if x.strip()]


def clean(s: str) -> str:
    return re.sub(r'[，、。,.\s　]', '', s)


def parse_sunfong(i):
    L = text_lines(SRC / 'sunfong' / f'{i}.html')
    k = next(k for k, x in enumerate(L) if re.match(r'^第.+籤\s', x))
    parts = L[k].split()
    return {'ganzhi': parts[1], 'attr': clean(''.join(parts[2:])),
            'lines': [clean(x) for x in L[k + 1:k + 5]]}


def parse_temple01(i):
    L = text_lines(SRC / 'temple01' / f'{i}.html')
    k = next(k for k, x in enumerate(L) if x == f'第{cn(i)}籤')
    return {'ganzhi': L[k + 1], 'attr': clean(L[k + 3]),
            'lines': [clean(x) for x in L[k + 4:k + 8]]}


def parse_donghai(i):
    L = text_lines(SRC / 'donghai' / f'{i}.html')
    k = next(k for k in range(50, len(L)) if re.match(r'^第.+籤【', L[k]))
    gz = re.match(r'^第.+?籤【(.+?)】', L[k]).group(1)
    return {'ganzhi': gz, 'attr': clean(L[k + 1]),
            'lines': [clean(x) for x in L[k + 2:k + 6]]}


PARSERS = {'sunfong': parse_sunfong, 'temple01': parse_temple01, 'donghai': parse_donghai}


def vote(values: dict[str, str]):
    """回傳 (採用值, 是否一致)；需至少兩家相同，否則回傳 None。"""
    counts: dict[str, list[str]] = {}
    for src, v in values.items():
        counts.setdefault(v, []).append(src)
    best = max(counts.items(), key=lambda kv: len(kv[1]))
    if len(best[1]) >= 2:
        return best[0], len(counts) == 1
    return None, False


def fmt_attr(a: str) -> str:
    # 屬金利秋宜其西方 -> 屬金利秋　宜其西方
    m = re.match(r'^(屬.利.)(.+)$', a)
    return f'{m.group(1)}　{m.group(2)}' if m else a


def main():
    poems, report = [], []
    for i in range(1, 61):
        got = {sid: PARSERS[sid](i) for sid in PARSERS}
        entry = {'no': i}
        variants = []
        for field in ('ganzhi', 'attr'):
            vals = {s: got[s][field] for s in got}
            v, same = vote(vals)
            if v is None:
                raise SystemExit(f'#{i} {field} 三家皆異：{vals}')
            entry[field] = fmt_attr(v) if field == 'attr' else v
            if not same:
                report.append((i, '籤頭' if field == 'ganzhi' else '屬性', vals, v, '多數決（2:1）'))
        lines = []
        for j in range(4):
            vals = {s: got[s]['lines'][j] for s in got}
            for s, x in vals.items():
                if len(x) != 7:
                    raise SystemExit(f'#{i} 第{j + 1}句 {s} 非七字：{x}')
            v, same = vote(vals)
            reason = '多數決（2:1）'
            if v is None:
                v, reason = MANUAL[(i, j + 1)]
            lines.append(v)
            if not same:
                report.append((i, f'第{j + 1}句', vals, v, reason))
                variants.append({'line': j + 1, 'others': {
                    SHORT[s]: x for s, x in vals.items() if x != v}})
        entry['lines'] = lines
        if variants:
            entry['variants'] = variants
        poems.append(entry)

    assert len({p['ganzhi'] for p in poems}) == 60
    data = {
        '_note': '由 scripts/qian/build.py 產生，請勿手改。',
        'method': '三來源逐字比對，兩家以上相同即採用；三家皆異者人工裁定並記錄理由。',
        'sources': SOURCES,
        'poems': poems,
    }
    out = ROOT / 'src/data/qian-poems.json'
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    md = ['# 六十甲子籤原文核對報告', '',
          '## 方法', '',
          '1. 從三個來源各下載第 1～60 籤頁面（`scripts/qian/fetch.sh`）。'
          '其中兩個是廟方官網，另一個是收錄量大的籤詩網站。',
          '2. 擷取籤頭干支、屬性（如「屬金利秋　宜其西方」）與四句籤詩，去除標點後逐字比對（`scripts/qian/build.py`）。',
          '3. 每一欄位只要兩家以上相同就採用；三家各不相同時由人工裁定，並在下表寫明理由。',
          '4. 所有差異都記錄在 `src/data/qian-poems.json` 的 `variants` 欄位，App 解籤頁會以「異文」顯示。', '',
          '## 來源', '']
    for s in SOURCES:
        md.append(f'- {s["name"]}：<{s["url"]}>')
    total = 60 * 6
    md += ['', f'## 結果', '',
           f'共比對 60 籤 × 6 欄（干支、屬性、四句）＝ {total} 欄，'
           f'其中 {total - len(report)} 欄三家完全一致，{len(report)} 欄有差異：', '',
           '| 籤 | 欄位 | 三鳳宮 | 好廟網 | 天聖宮 | 採用 | 理由 |',
           '|---|---|---|---|---|---|---|']
    for i, f, vals, v, why in report:
        md.append(f'| {i} | {f} | {vals["sunfong"]} | {vals["temple01"]} | {vals["donghai"]} | **{v}** | {why} |')
    md.append('')
    (ROOT / 'docs/籤詩核對報告.md').write_text('\n'.join(md), encoding='utf-8')
    print(f'poems: {len(poems)}, diffs: {len(report)}')


if __name__ == '__main__':
    main()
