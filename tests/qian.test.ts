import { describe, expect, it } from 'vitest';
import poems from '../src/data/qian-poems-hans.json';
import poemsHant from '../src/data/qian-poems.json';
import readings from '../src/data/qian-readings.json';
import { cnNumber, getQian } from '../src/lib/qian';
import { CATEGORIES } from '../src/lib/storage';
import { GANS, ZHIS } from '../src/lib/lunar';

describe('六十甲子签资料', () => {
  it('60 首、每首四句七言', () => {
    expect(poems.poems).toHaveLength(60);
    for (const p of poems.poems) {
      expect(p.lines).toHaveLength(4);
      for (const l of p.lines) expect([...l]).toHaveLength(7);
    }
  });

  it('签头依天干分组排列：甲子、甲寅、甲辰…癸亥', () => {
    const expected: string[] = [];
    for (let g = 0; g < 10; g++) {
      // 阳干配阳支、阴干配阴支，各取 6 个
      const start = g % 2;
      for (let z = start; z < 12; z += 2) expected.push(GANS[g] + ZHIS[z]);
    }
    expect(poems.poems.map((p) => p.ganzhi)).toEqual(expected);
  });

  it('每首都有吉凶、白话与六类建议', () => {
    for (let i = 1; i <= 60; i++) {
      const q = getQian(i);
      expect(readings.grades).toContain(q.grade);
      expect(q.plain.length).toBeGreaterThan(30);
      for (const c of CATEGORIES) expect(q.advice[c.id], `${i} ${c.id}`).toBeTruthy();
    }
  });

  it('简体版与繁体核对定稿逐首对应', () => {
    expect(poems.poems).toHaveLength(poemsHant.poems.length);
    poems.poems.forEach((p, i) => {
      const t = poemsHant.poems[i];
      expect(p.no).toBe(t.no);
      expect(p.ganzhi).toBe(t.ganzhi); // 干支字简繁相同
      p.lines.forEach((l, j) => expect([...l]).toHaveLength([...t.lines[j]].length));
    });
  });

  it('中文数字', () => {
    expect([1, 10, 11, 20, 45, 60].map(cnNumber)).toEqual(['一', '十', '十一', '二十', '四十五', '六十']);
  });
});
