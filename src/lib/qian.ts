import poems from '../data/qian-poems.json';
import readings from '../data/qian-readings.json';
import type { CategoryId } from './storage';

export type Grade = '大吉' | '吉' | '中平' | '小凶' | '凶';
export const QIAN_COUNT = 60;
export const GRADE_NOTE: string = readings.gradeNote;

export interface Qian {
  no: number;
  ganzhi: string;
  attr: string;
  lines: string[];
  variants: { line: number; others: Record<string, string> }[];
  grade: Grade;
  plain: string;
  advice: Record<CategoryId, string>;
}

type Reading = { grade: Grade; plain: string; advice: Record<CategoryId, string> };

export function getQian(no: number): Qian {
  const p = poems.poems[no - 1];
  const r = (readings.readings as Record<string, Reading>)[String(no)];
  if (!p || p.no !== no || !r) throw new Error(`沒有第 ${no} 籤`);
  return {
    no,
    ganzhi: p.ganzhi,
    attr: p.attr,
    lines: p.lines,
    variants: (p as { variants?: Qian['variants'] }).variants ?? [],
    grade: r.grade,
    plain: r.plain,
    advice: r.advice,
  };
}

const NUM = '〇一二三四五六七八九';
/** 1 → 一、15 → 十五、60 → 六十 */
export function cnNumber(n: number): string {
  if (n < 10) return NUM[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return (t === 1 ? '' : NUM[t]) + '十' + (u ? NUM[u] : '');
}

export const gradeTone = (g: Grade): 'good' | 'mid' | 'bad' =>
  g === '大吉' || g === '吉' ? 'good' : g === '中平' ? 'mid' : 'bad';

export const SOURCES = poems.sources;
