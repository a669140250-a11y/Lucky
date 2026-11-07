import { describe, expect, it } from 'vitest';
import { judge, toss } from '../src/lib/jiao';
import { randInt } from '../src/lib/random';

describe('掷筊', () => {
  it('判定：一平一凸圣筊、两平笑筊、两凸阴筊', () => {
    expect(judge('flat', 'round')).toBe('sheng');
    expect(judge('round', 'flat')).toBe('sheng');
    expect(judge('flat', 'flat')).toBe('xiao');
    expect(judge('round', 'round')).toBe('yin');
  });

  it('机率约为 圣 50%、笑 25%、阴 25%', () => {
    const n = 200_000;
    const c = { sheng: 0, xiao: 0, yin: 0 };
    for (let i = 0; i < n; i++) c[toss().result]++;
    expect(c.sheng / n).toBeCloseTo(0.5, 1.6);
    expect(c.xiao / n).toBeCloseTo(0.25, 1.6);
    expect(c.yin / n).toBeCloseTo(0.25, 1.6);
  });

  it('randInt 均匀涵盖 1–60 签', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 20_000; i++) seen.add(randInt(60) + 1);
    expect(seen.size).toBe(60);
    expect(Math.min(...seen)).toBe(1);
    expect(Math.max(...seen)).toBe(60);
  });
});
