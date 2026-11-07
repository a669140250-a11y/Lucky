import { type Rng, cryptoRng, randInt } from './random';

/** 单片筊杯朝上的那一面：flat＝平面朝上，round＝凸面朝上。 */
export type Face = 'flat' | 'round';
/** 圣筊＝一平一凸；笑筊＝两平；阴筊＝两凸。 */
export type JiaoResult = 'sheng' | 'xiao' | 'yin';

export interface Toss {
  faces: [Face, Face];
  result: JiaoResult;
}

export const JIAO_LABEL: Record<JiaoResult, string> = { sheng: '圣筊', xiao: '笑筊', yin: '阴筊' };

export function judge(a: Face, b: Face): JiaoResult {
  if (a !== b) return 'sheng';
  return a === 'flat' ? 'xiao' : 'yin';
}

/** 掷一次筊：两片各自独立、正反各 50%，所以圣筊 50%、笑筊 25%、阴筊 25%。 */
export function toss(rng: Rng = cryptoRng): Toss {
  const a: Face = randInt(2, rng) === 0 ? 'flat' : 'round';
  const b: Face = randInt(2, rng) === 0 ? 'flat' : 'round';
  return { faces: [a, b], result: judge(a, b) };
}
