import { describe, expect, it } from 'vitest';
import { LunarUtil } from 'lunar-javascript';
import rules from '../src/data/fortune-rules.json';
import { dailyFortune, drawReminder, luckyElement, tenGod } from '../src/lib/fortune';
import { GANS, computeBazi, getDayInfo } from '../src/lib/lunar';

describe('十神', () => {
  it('100 种组合都与 lunar-javascript 的十神对照表一致', () => {
    for (const a of GANS) for (const b of GANS) {
      expect(tenGod(a, b), `${a}${b}`).toBe(LunarUtil.SHI_SHEN[a + b]);
    }
  });
});

describe('幸运五行规则', () => {
  // 日主丙火：印＝木、比劫＝火、食伤＝土
  it.each([
    ['壬', '七杀', '木'], ['癸', '正官', '木'], // 官杀 → 印
    ['戊', '食神', '木'], ['己', '伤官', '木'], // 食伤 → 印
    ['庚', '偏财', '火'], ['辛', '正财', '火'], // 财 → 比劫
    ['甲', '偏印', '土'], ['乙', '正印', '土'], // 印 → 食伤
    ['丙', '比肩', '土'], ['丁', '劫财', '土'], // 比劫 → 食伤
  ])('丙日主遇 %s（%s）→ %s', (gan, god, el) => {
    expect(tenGod('丙', gan)).toBe(god);
    expect(luckyElement('丙', gan)).toBe(el);
  });
});

describe('规则表完整性', () => {
  it('十个十神都有主题与至少一句运势', () => {
    const gods = Object.keys(rules.tenGods);
    expect(gods).toHaveLength(10);
    for (const g of Object.values(rules.tenGods)) {
      expect(g.theme).toBeTruthy();
      expect(g.lines.length).toBeGreaterThan(0);
    }
  });
  it('五行颜色与河图数', () => {
    const e = rules.elements;
    expect([e.水.numbers, e.火.numbers, e.木.numbers, e.金.numbers, e.土.numbers])
      .toEqual([[1, 6], [2, 7], [3, 8], [4, 9], [5, 10]]);
    expect([e.木.color, e.火.color, e.土.color, e.金.color, e.水.color]).toEqual(['绿', '红', '黄', '白', '黑']);
  });
});

describe('dailyFortune', () => {
  const day = getDayInfo(new Date(2026, 10, 7)); // 乙酉日，冲卯（兔）
  it('同一天同一人结果固定', () => {
    const bz = computeBazi({ y: 1990, m: 6, d: 15, hour: null });
    expect(dailyFortune(bz, day, 'a').line).toBe(dailyFortune(bz, day, 'a').line);
  });
  it('日支冲生肖时显示提醒', () => {
    const rabbit = computeBazi({ y: 1999, m: 6, d: 1, hour: null }); // 己卯年
    expect(rabbit.shengxiao).toBe('兔');
    const f = dailyFortune(rabbit, day, 'x');
    expect(f.chong?.title).toBe('今日冲兔');
    expect(drawReminder(f)).toContain('冲兔');
    const horse = computeBazi({ y: 1990, m: 6, d: 1, hour: null });
    expect(dailyFortune(horse, day, 'x').chong).toBeNull();
  });
});
