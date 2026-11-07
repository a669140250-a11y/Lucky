// 以 crypto 产生均匀乱数（拒绝取样，避免取余数偏差）。
export type Rng = () => number; // 回传 [0, 2^32) 的整数

export const cryptoRng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
};

/** 均匀取 [0, n) 的整数。 */
export function randInt(n: number, rng: Rng = cryptoRng): number {
  const limit = Math.floor(0x100000000 / n) * n;
  let x: number;
  do x = rng(); while (x >= limit);
  return x % n;
}
