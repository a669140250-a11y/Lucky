// 震動回饋：Android 瀏覽器支援 navigator.vibrate；iOS Safari 不支援，會自動略過。
let enabled = true;
export function setVibrateEnabled(on: boolean) {
  enabled = on;
}
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export function vibrate(pattern: number | number[]): void {
  if (!enabled || !canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 忽略 */
  }
}
