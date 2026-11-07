import { IS_PREVIEW } from './platform';

// 搖動偵測。iOS 13+ 必須在點擊事件中呼叫 DeviceMotionEvent.requestPermission()。
type PermissionFn = () => Promise<'granted' | 'denied'>;

export type MotionSupport = 'needs-permission' | 'available' | 'unsupported';

export function motionSupport(): MotionSupport {
  if (IS_PREVIEW) return 'unsupported'; // 預覽連結的框架不提供動作感測器
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'unsupported'; // 搖動偵測需要 HTTPS
  const req = (DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
  return typeof req === 'function' ? 'needs-permission' : 'available';
}

/** 需在使用者點擊的處理函式中直接呼叫。 */
export async function requestMotionPermission(): Promise<boolean> {
  const req = (DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
  if (typeof req !== 'function') return true;
  try {
    return (await req()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * 監聽搖動。onActive 在第一次收到有效感測資料時呼叫（用來確認裝置真的有加速度計）；
 * onShake 在每次偵測到明顯晃動時呼叫，參數為 0–1 的強度。
 */
export function listenShake(onShake: (intensity: number) => void, onActive?: () => void): () => void {
  let last: { x: number; y: number; z: number } | null = null;
  let lastShake = 0;
  let active = false;
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity ?? e.acceleration;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    if (!active) {
      active = true;
      onActive?.();
    }
    const cur = { x: a.x, y: a.y, z: a.z };
    if (last) {
      const delta = Math.abs(cur.x - last.x) + Math.abs(cur.y - last.y) + Math.abs(cur.z - last.z);
      const now = performance.now();
      if (delta > 16 && now - lastShake > 110) {
        lastShake = now;
        onShake(Math.min(1, (delta - 16) / 30 + 0.4));
      }
    }
    last = cur;
  };
  window.addEventListener('devicemotion', handler);
  return () => window.removeEventListener('devicemotion', handler);
}
