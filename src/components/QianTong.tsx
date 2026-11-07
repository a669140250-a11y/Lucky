import { useEffect, useRef } from 'preact/hooks';

const STICKS = [-26, -18, -10, -3, 4, 11, 18, 25];

/**
 * 签筒。shaking 时左右晃动；dropKey 在挂载之后改变时，让一支竹签从筒口跳出、掉落地面。
 * 挂载当下的 dropKey 只当作起始值，不会播放掉签（避免重新挂载时自己掉签）。
 */
export function QianTong(props: { shaking: boolean; dropKey: number; onDropDone?: () => void }) {
  const stick = useRef<HTMLDivElement>(null);
  const lastKey = useRef(props.dropKey);
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (props.dropKey === lastKey.current || !stick.current) return;
    lastKey.current = props.dropKey;
    const el = stick.current;
    const side = Math.random() < 0.5 ? -1 : 1;
    const a = el.animate(
      [
        { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
        { transform: `translate(${side * 6}px, -120px) rotate(${side * -6}deg)`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(.3,.8,.5,1)' },
        { transform: `translate(${side * 40}px, -150px) rotate(${side * 30}deg)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(.6,0,1,.6)' },
        { transform: `translate(${side * 92}px, 118px) rotate(${side * 84}deg)`, opacity: 1, offset: 0.82, easing: 'ease-out' },
        { transform: `translate(${side * 96}px, 106px) rotate(${side * 80}deg)`, opacity: 1, offset: 0.9 },
        { transform: `translate(${side * 98}px, 118px) rotate(${side * 86}deg)`, opacity: 1 },
      ],
      { duration: reduce ? 200 : 1100, fill: 'forwards' },
    );
    a.finished.then(() => props.onDropDone?.()).catch(() => undefined);
    return () => a.cancel();
  }, [props.dropKey]);

  return (
    <div class="qiantong-wrap" aria-hidden="true">
      <div class={`qiantong ${props.shaking ? 'shaking' : ''}`}>
        <svg viewBox="0 0 160 260" class="qiantong-svg">
          <defs>
            <linearGradient id="tube" x1="0" x2="1">
              <stop offset="0" stop-color="#5a2a16" />
              <stop offset=".35" stop-color="#9a4a26" />
              <stop offset=".6" stop-color="#b3582d" />
              <stop offset="1" stop-color="#4a2010" />
            </linearGradient>
            <linearGradient id="stickg" x1="0" x2="1">
              <stop offset="0" stop-color="#d8b77a" />
              <stop offset=".5" stop-color="#f1dcaa" />
              <stop offset="1" stop-color="#c9a466" />
            </linearGradient>
            <pattern id="grain" width="12" height="40" patternUnits="userSpaceOnUse">
              <path d="M3 0c2 10-2 20 0 40M9 0c-2 12 2 24 0 40" stroke="#000" stroke-opacity=".08" fill="none" />
            </pattern>
          </defs>
          {STICKS.map((x, i) => (
            <rect key={i} x={80 + x * 1.6 - 4} y={18 + (i % 3) * 8} width="8" height="120" rx="3" fill="url(#stickg)" stroke="#9c7a3e" stroke-width=".8" transform={`rotate(${x / 3} ${80 + x * 1.6} 140)`} />
          ))}
          <path d="M28 92h104l-8 156a8 8 0 0 1-8 7H44a8 8 0 0 1-8-7L28 92Z" fill="url(#tube)" />
          <path d="M28 92h104l-8 156a8 8 0 0 1-8 7H44a8 8 0 0 1-8-7L28 92Z" fill="url(#grain)" />
          <ellipse cx="80" cy="92" rx="52" ry="9" fill="#3a170a" />
          <ellipse cx="80" cy="92" rx="52" ry="9" fill="none" stroke="#d4a94e" stroke-width="3" />
          <rect x="31" y="118" width="98" height="8" fill="#d4a94e" />
          <rect x="35" y="222" width="90" height="8" fill="#d4a94e" />
          <rect x="58" y="142" width="44" height="64" rx="4" fill="#9e2a20" stroke="#d4a94e" stroke-width="2" />
          <text x="80" y="186" text-anchor="middle" font-size="34" font-weight="700" fill="#f3d58a" font-family="serif">签</text>
        </svg>
        <div class="drop-stick" ref={stick} />
      </div>
      <div class="qiantong-shadow" />
    </div>
  );
}
