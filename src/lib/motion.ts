import { IS_PREVIEW } from './platform';

// 摇动侦测。iOS 13+ 必须在点击事件中呼叫 DeviceMotionEvent.requestPermission()。
type PermissionFn = () => Promise<'granted' | 'denied'>;

export type MotionSupport = 'needs-permission' | 'available' | 'unsupported';

export function motionSupport(): MotionSupport {
  if (IS_PREVIEW) return 'unsupported'; // 预览连结的框架不提供动作感测器
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'unsupported'; // 摇动侦测需要 HTTPS
  const req = (DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
  return typeof req === 'function' ? 'needs-permission' : 'available';
}

/** 需在使用者点击的处理函式中直接呼叫。 */
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
 * 监听摇动。onActive 在第一次收到有效感测资料时呼叫（用来确认装置真的有加速度计）；
 * onShake 在每次侦测到明显晃动时呼叫，参数为 0–1 的强度。
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
