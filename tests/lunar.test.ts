import { describe, expect, it } from 'vitest';
import { computeBazi, getDayInfo, isValidDate } from '../src/lib/lunar';

describe('getDayInfo（今日资讯，皆由 lunar-javascript 计算）', () => {
  it('2026-11-07：农历九月廿九、乙酉日、冲兔、立冬', () => {
    const d = getDayInfo(new Date(2026, 10, 7));
    expect(d.key).toBe('2026-11-07');
    expect(d.weekday).toBe('星期六');
    expect(d.lunarYearGz).toBe('丙午');
    expect(d.lunarText).toBe('九月廿九');
    expect(d.dayGz).toBe('乙酉');
    expect(d.chongZhi).toBe('卯');
    expect(d.chongSx).toBe('兔');
    expect(d.jieqi).toBe('立冬');
    expect(d.yi).toContain('余事勿取'); // 已转为繁体
  });

  it('闰月与腊月显示为繁体', () => {
    expect(getDayInfo(new Date(2025, 6, 25)).lunarText).toBe('闰六月初一');
    expect(getDayInfo(new Date(2026, 0, 20)).lunarText.startsWith('腊月')).toBe(true);
  });

  it('地支丑不会被转成「丑」', () => {
    // 2026-11-11 为己丑日
    const d = getDayInfo(new Date(2026, 10, 11));
    expect(d.dayGz).toBe('己丑');
  });
});

describe('computeBazi（日主与生肖）', () => {
  it('生肖以立春换年：1990-02-03 属蛇、1990-02-05 属马', () => {
    expect(computeBazi({ y: 1990, m: 2, d: 3, hour: null }).shengxiao).toBe('蛇');
    expect(computeBazi({ y: 1990, m: 2, d: 5, hour: null }).shengxiao).toBe('马');
  });

  it('晚子时日柱算隔天，早子时算当天', () => {
    const base = computeBazi({ y: 1990, m: 2, d: 3, hour: null });
    const early = computeBazi({ y: 1990, m: 2, d: 3, hour: 'zi-early' });
    const late = computeBazi({ y: 1990, m: 2, d: 3, hour: 'zi-late' });
    const next = computeBazi({ y: 1990, m: 2, d: 4, hour: null });
    expect(base.pillars.day).toBe('己亥');
    expect(early.pillars.day).toBe(base.pillars.day);
    expect(late.pillars.day).toBe(next.pillars.day);
    expect(late.dayMaster).toBe('庚');
  });

  it('未选时辰时不显示时柱', () => {
    expect(computeBazi({ y: 2000, m: 1, d: 1, hour: null }).pillars.time).toBeNull();
    expect(computeBazi({ y: 2000, m: 1, d: 1, hour: 'wu' }).pillars.time).toMatch(/^.午$/);
  });

  it('日期验证', () => {
    expect(isValidDate(2024, 2, 29)).toBe(true);
    expect(isValidDate(2023, 2, 29)).toBe(false);
    expect(isValidDate(1800, 1, 1)).toBe(false);
  });
});
