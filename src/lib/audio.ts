// 所有音效都用 Web Audio 即時合成，不載入任何音檔。
let ctx: AudioContext | null = null;
let enabled = true;
let noise: AudioBuffer | null = null;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** 必須在使用者手勢（點擊）中呼叫一次，iOS 才允許發聲。 */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function ready(): AudioContext | null {
  if (!enabled || !ctx || ctx.state !== 'running') return null;
  return ctx;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(c.sampleRate * 0.5);
  noise = c.createBuffer(1, len, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** 一聲木頭撞擊：帶通濾波的雜訊 + 低頻短音。 */
function knock(c: AudioContext, t: number, opt: { freq: number; q: number; decay: number; gain: number; body?: number }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = opt.freq;
  bp.Q.value = opt.q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opt.gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opt.decay);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t, Math.random() * 0.3);
  src.stop(t + opt.decay + 0.02);

  if (opt.body) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(opt.body, t);
    o.frequency.exponentialRampToValueAtTime(opt.body * 0.6, t + opt.decay);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(opt.gain * 0.8, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + opt.decay * 0.9);
    o.connect(og).connect(c.destination);
    o.start(t);
    o.stop(t + opt.decay + 0.02);
  }
}

/** 筊杯落地：兩片先後著地，再各彈一下。 */
export function playJiaoLand(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  knock(c, t, { freq: 1400, q: 4, decay: 0.12, gain: 0.9, body: 260 });
  knock(c, t + 0.06, { freq: 1250, q: 4, decay: 0.12, gain: 0.8, body: 230 });
  knock(c, t + 0.19, { freq: 1600, q: 5, decay: 0.07, gain: 0.35 });
  knock(c, t + 0.25, { freq: 1500, q: 5, decay: 0.06, gain: 0.25 });
}

/** 筊杯拋起時的輕微風聲。 */
export function playWhoosh(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(500, t);
  bp.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
  bp.frequency.exponentialRampToValueAtTime(600, t + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + 0.55);
}

/** 竹籤互相碰撞的一小串聲音（搖籤筒時重複呼叫）。 */
export function playRattle(intensity = 1): void {
  const c = ready();
  if (!c) return;
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const t = c.currentTime + i * (0.018 + Math.random() * 0.03);
    knock(c, t, {
      freq: 2200 + Math.random() * 1600,
      q: 6,
      decay: 0.03 + Math.random() * 0.02,
      gain: (0.15 + Math.random() * 0.2) * intensity,
    });
  }
}

/** 竹籤掉出落地。 */
export function playStickDrop(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  knock(c, t, { freq: 2600, q: 5, decay: 0.05, gain: 0.5 });
  knock(c, t + 0.09, { freq: 2100, q: 5, decay: 0.08, gain: 0.6, body: 420 });
  knock(c, t + 0.17, { freq: 2400, q: 6, decay: 0.04, gain: 0.25 });
}

/** 寺廟磬聲：數個不諧和泛音、長尾音。 */
export function playBell(base = 392): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  const partials: [number, number, number][] = [
    [1, 0.5, 3.2],
    [2.0, 0.22, 2.2],
    [2.76, 0.18, 1.8],
    [5.4, 0.08, 1.0],
    [8.9, 0.04, 0.6],
  ];
  for (const [ratio, gain, decay] of partials) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = base * ratio;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * 0.6, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

/** 不成功時的低沉木魚聲。 */
export function playLow(): void {
  const c = ready();
  if (!c) return;
  knock(c, c.currentTime + 0.01, { freq: 600, q: 3, decay: 0.2, gain: 0.6, body: 150 });
}
