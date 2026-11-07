import { useEffect, useRef, useState } from 'preact/hooks';
import { playJiaoLand, playWhoosh, unlockAudio } from '../lib/audio';
import { vibrate } from '../lib/haptics';
import { type Face, JIAO_LABEL, type Toss, toss } from '../lib/jiao';

/** 单片筊杯：正面＝平面朝上、背面＝凸面朝上，以 3D 翻转呈现。 */
function Block(props: { mirror?: boolean }) {
  // 半月形：上缘为弧背，下缘为内凹弧
  const path = 'M4 46C4 20 30 3 60 3s56 17 56 43c-2 3-7 4-11 2C93 40 78 36 60 36S27 40 15 48c-4 2-9 1-11-2Z';
  return (
    <div class={`jiao-block ${props.mirror ? 'mirror' : ''}`}>
      {/* 平面朝上：颜色较浅、平整，有木纹 */}
      <svg class="face flat" viewBox="0 0 120 52" aria-hidden="true">
        <path d={path} fill="#e0806a" stroke="#8a2b1d" stroke-width="2.5" />
        <path d="M18 38c12-8 26-12 42-12s30 4 42 12M26 26c10-6 22-9 34-9s24 3 34 9" fill="none" stroke="#b5503d" stroke-opacity=".55" stroke-width="1.6" />
      </svg>
      {/* 凸面朝上：深红、有立体光泽 */}
      <svg class="face round" viewBox="0 0 120 52" aria-hidden="true">
        <defs>
          <radialGradient id="jr" cx=".42" cy=".3" r=".75">
            <stop offset="0" stop-color="#e98468" />
            <stop offset=".4" stop-color="#a62c1d" />
            <stop offset="1" stop-color="#4f110a" />
          </radialGradient>
        </defs>
        <path d={path} fill="url(#jr)" stroke="#3e0d07" stroke-width="2.5" />
        <path d="M24 20c10-7 22-10 34-10" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="4" stroke-linecap="round" />
      </svg>
    </div>
  );
}

const FACES_TEXT = { sheng: '一平一凸', xiao: '两面皆平', yin: '两面皆凸' } as const;

const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateBlock(el: HTMLElement, face: Face, side: -1 | 1, delay: number): Animation {
  const spins = 3 + Math.floor(Math.random() * 2);
  const endX = side * (60 + Math.random() * 34);
  const endY = Math.random() * 24 - 8;
  const endZ = side * (8 + Math.random() * 30);
  const endRX = spins * 360 + (face === 'round' ? 180 : 0);
  const peak = -(120 + Math.random() * 40);
  const t = (x: number, y: number, rx: number, rz: number) =>
    `translate(${x}px, ${y}px) rotateX(${rx}deg) rotateZ(${rz}deg)`;
  const frames: Keyframe[] = [
    { transform: t(side * 60, 0, 0, 0), easing: 'cubic-bezier(.2,.7,.4,1)' },
    { transform: t(side * 44, peak, endRX * 0.55, endZ * 0.5), offset: 0.42, easing: 'cubic-bezier(.5,0,.9,.5)' },
    { transform: t(endX, endY, endRX, endZ), offset: 0.76, easing: 'ease-out' },
    { transform: t(endX + side * 4, endY - 16, endRX + (face === 'round' ? -8 : 8), endZ), offset: 0.86, easing: 'ease-in' },
    { transform: t(endX + side * 6, endY, endRX, endZ) },
  ];
  return el.animate(frames, { duration: reduce() ? 300 : 1150, delay, fill: 'forwards' });
}

export interface JiaoThrowProps {
  /** 每次掷完呼叫；回传 false 表示要停在结果画面不再允许掷。 */
  onResult: (t: Toss) => void;
  label?: string;
  disabled?: boolean;
  hint?: string;
}

export function JiaoThrow(props: JiaoThrowProps) {
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Toss | null>(null);
  const anims = useRef<Animation[]>([]);

  useEffect(() => () => anims.current.forEach((a) => a.cancel()), []);

  const go = () => {
    if (busy || props.disabled) return;
    unlockAudio();
    const result = toss();
    setBusy(true);
    setLast(null);
    anims.current.forEach((a) => a.cancel());
    playWhoosh();
    const a1 = animateBlock(left.current!, result.faces[0], -1, 0);
    const a2 = animateBlock(right.current!, result.faces[1], 1, 60);
    anims.current = [a1, a2];
    const landAt = reduce() ? 250 : 1150 * 0.76 + 30;
    setTimeout(() => {
      playJiaoLand();
      vibrate([25, 50, 25]);
    }, landAt);
    Promise.all([a1.finished, a2.finished])
      .catch(() => undefined)
      .then(() => {
        setBusy(false);
        setLast(result);
        props.onResult(result);
      });
  };

  return (
    <div class="jiao-throw">
      <div class="jiao-stage" aria-live="polite">
        <div class="jiao-floor" />
        <div class="jiao-slot" ref={left}>
          <Block mirror />
        </div>
        <div class="jiao-slot" ref={right}>
          <Block />
        </div>
        {last && (
          <div class={`jiao-result ${last.result}`} key={Math.random()}>
            {JIAO_LABEL[last.result]}
            <small>{FACES_TEXT[last.result]}</small>
          </div>
        )}
      </div>
      {props.hint && <p class="hint center">{props.hint}</p>}
      {!props.disabled && (
        <button class="btn primary big" onClick={go} disabled={busy}>
          {busy ? '筊杯落地中…' : (props.label ?? '掷筊')}
        </button>
      )}
    </div>
  );
}

export function JiaoLegend() {
  return (
    <ul class="jiao-legend">
      <li><b>圣筊</b>一平一凸，表示应允</li>
      <li><b>笑筊</b>两平面朝上，神明笑而不答</li>
      <li><b>阴筊</b>两凸面朝上，表示不允</li>
    </ul>
  );
}
