import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export function Footer() {
  return (
    <footer class="disclaimer">
      本 App 内容仅供娱乐参考，请勿作为重大决定之依据。
    </footer>
  );
}

export function ScreenHeader(props: { title: string; sub?: ComponentChildren; right?: ComponentChildren }) {
  return (
    <header class="screen-header">
      <div>
        <h1>{props.title}</h1>
        {props.sub && <p class="sub">{props.sub}</p>}
      </div>
      {props.right}
    </header>
  );
}

export function Modal(props: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open]);
  if (!props.open) return null;
  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div class="modal-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" aria-label="关闭" onClick={props.onClose}>
            <Icon name="close" />
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function GradeSeal(props: { grade: string; size?: 'sm' | 'lg' }) {
  const tone = props.grade.includes('凶') ? 'bad' : props.grade === '中平' ? 'mid' : 'good';
  return <span class={`grade-seal ${tone} ${props.size ?? 'lg'}`}>{props.grade}</span>;
}

const PATHS: Record<string, string> = {
  today:
    'M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  draw: 'M7 9h10l-1.2 11H8.2L7 9Zm2.5 0 1-6m2.5 6V2.5m2.5 6.5-1-5.5M6 9h12',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Zm0 15A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 2h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  close: 'M6 6l12 12M18 6 6 18',
  share: 'M12 3v12m0-12L8 7m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M5 21h14',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5 3-3 4 4M15.5 9.5h.01',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  alert: 'M12 3 2 21h20L12 3Zm0 7v5m0 3h.01',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17h2',
};

export function Icon(props: { name: keyof typeof PATHS | string; size?: number }) {
  const s = props.size ?? 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={PATHS[props.name] ?? ''} />
    </svg>
  );
}
