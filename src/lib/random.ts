// 以 crypto 產生均勻亂數（拒絕取樣，避免取餘數偏差）。
export type Rng = () => number; // 回傳 [0, 2^32) 的整數

export const cryptoRng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
};

/** 均勻取 [0, n) 的整數。 */
export function randInt(n: number, rng: Rng = cryptoRng): number {
  const limit = Math.floor(0x100000000 / n) * n;
  let x: number;
  do x = rng(); while (x >= limit);
  return x % n;
}
