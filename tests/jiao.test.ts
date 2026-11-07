import { describe, expect, it } from 'vitest';
import { judge, toss } from '../src/lib/jiao';
import { randInt } from '../src/lib/random';

describe('擲筊', () => {
  it('判定：一平一凸聖筊、兩平笑筊、兩凸陰筊', () => {
    expect(judge('flat', 'round')).toBe('sheng');
    expect(judge('round', 'flat')).toBe('sheng');
    expect(judge('flat', 'flat')).toBe('xiao');
    expect(judge('round', 'round')).toBe('yin');
  });

  it('機率約為 聖 50%、笑 25%、陰 25%', () => {
    const n = 200_000;
    const c = { sheng: 0, xiao: 0, yin: 0 };
    for (let i = 0; i < n; i++) c[toss().result]++;
    expect(c.sheng / n).toBeCloseTo(0.5, 1.6);
    expect(c.xiao / n).toBeCloseTo(0.25, 1.6);
    expect(c.yin / n).toBeCloseTo(0.25, 1.6);
  });

  it('randInt 均勻涵蓋 1–60 籤', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 20_000; i++) seen.add(randInt(60) + 1);
    expect(seen.size).toBe(60);
    expect(Math.min(...seen)).toBe(1);
    expect(Math.max(...seen)).toBe(60);
  });
});
