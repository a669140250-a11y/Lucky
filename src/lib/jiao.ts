import { type Rng, cryptoRng, randInt } from './random';

/** 單片筊杯朝上的那一面：flat＝平面朝上，round＝凸面朝上。 */
export type Face = 'flat' | 'round';
/** 聖筊＝一平一凸；笑筊＝兩平；陰筊＝兩凸。 */
export type JiaoResult = 'sheng' | 'xiao' | 'yin';

export interface Toss {
  faces: [Face, Face];
  result: JiaoResult;
}

export const JIAO_LABEL: Record<JiaoResult, string> = { sheng: '聖筊', xiao: '笑筊', yin: '陰筊' };

export function judge(a: Face, b: Face): JiaoResult {
  if (a !== b) return 'sheng';
  return a === 'flat' ? 'xiao' : 'yin';
}

/** 擲一次筊：兩片各自獨立、正反各 50%，所以聖筊 50%、笑筊 25%、陰筊 25%。 */
export function toss(rng: Rng = cryptoRng): Toss {
  const a: Face = randInt(2, rng) === 0 ? 'flat' : 'round';
  const b: Face = randInt(2, rng) === 0 ? 'flat' : 'round';
  return { faces: [a, b], result: judge(a, b) };
}
