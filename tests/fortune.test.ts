import { describe, expect, it } from 'vitest';
import { LunarUtil } from 'lunar-javascript';
import rules from '../src/data/fortune-rules.json';
import { dailyFortune, drawReminder, luckyElement, tenGod } from '../src/lib/fortune';
import { GANS, computeBazi, getDayInfo } from '../src/lib/lunar';

describe('十神', () => {
  it('100 種組合都與 lunar-javascript 的十神對照表一致', () => {
    for (const a of GANS) for (const b of GANS) {
      expect(tenGod(a, b), `${a}${b}`).toBe(LunarUtil.SHI_SHEN[a + b]);
    }
  });
});

describe('幸運五行規則', () => {
  // 日主丙火：印＝木、比劫＝火、食傷＝土
  it.each([
    ['壬', '七殺', '木'], ['癸', '正官', '木'], // 官殺 → 印
    ['戊', '食神', '木'], ['己', '傷官', '木'], // 食傷 → 印
    ['庚', '偏財', '火'], ['辛', '正財', '火'], // 財 → 比劫
    ['甲', '偏印', '土'], ['乙', '正印', '土'], // 印 → 食傷
    ['丙', '比肩', '土'], ['丁', '劫財', '土'], // 比劫 → 食傷
  ])('丙日主遇 %s（%s）→ %s', (gan, god, el) => {
    expect(tenGod('丙', gan)).toBe(god);
    expect(luckyElement('丙', gan)).toBe(el);
  });
});

describe('規則表完整性', () => {
  it('十個十神都有主題與至少一句運勢', () => {
    const gods = Object.keys(rules.tenGods);
    expect(gods).toHaveLength(10);
    for (const g of Object.values(rules.tenGods)) {
      expect(g.theme).toBeTruthy();
      expect(g.lines.length).toBeGreaterThan(0);
    }
  });
  it('五行顏色與河圖數', () => {
    const e = rules.elements;
    expect([e.水.numbers, e.火.numbers, e.木.numbers, e.金.numbers, e.土.numbers])
      .toEqual([[1, 6], [2, 7], [3, 8], [4, 9], [5, 10]]);
    expect([e.木.color, e.火.color, e.土.color, e.金.color, e.水.color]).toEqual(['綠', '紅', '黃', '白', '黑']);
  });
});

describe('dailyFortune', () => {
  const day = getDayInfo(new Date(2026, 10, 7)); // 乙酉日，沖卯（兔）
  it('同一天同一人結果固定', () => {
    const bz = computeBazi({ y: 1990, m: 6, d: 15, hour: null });
    expect(dailyFortune(bz, day, 'a').line).toBe(dailyFortune(bz, day, 'a').line);
  });
  it('日支沖生肖時顯示提醒', () => {
    const rabbit = computeBazi({ y: 1999, m: 6, d: 1, hour: null }); // 己卯年
    expect(rabbit.shengxiao).toBe('兔');
    const f = dailyFortune(rabbit, day, 'x');
    expect(f.chong?.title).toBe('今日沖兔');
    expect(drawReminder(f)).toContain('沖兔');
    const horse = computeBazi({ y: 1990, m: 6, d: 1, hour: null });
    expect(dailyFortune(horse, day, 'x').chong).toBeNull();
  });
});
