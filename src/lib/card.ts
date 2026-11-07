// 今日運勢圖卡：直接用 Canvas 2D 繪製 1080×1350（4:5），避免 DOM 轉圖在 iOS 上字型跑掉。
import type { DailyFortune } from './fortune';
import type { DayInfo } from './lunar';

const W = 1080;
const H = 1350;
const SERIF = '"Noto Serif TC", "Songti TC", "STSong", "PMingLiU", "MingLiU", serif';
const SANS = '-apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';

const C = {
  paper: '#f6efe2',
  paper2: '#ecdfc6',
  ink: '#2b1d14',
  ink2: '#6b5646',
  red: '#9e2a20',
  gold: '#b8892d',
  line: '#d9c6a3',
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) {
      // 避免標點落在行首
      if (/[，。、；：！？」』）]/.test(ch)) {
        lines.push(cur + ch);
        cur = '';
        continue;
      }
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 盡量放入一行，放不下時以「等」收尾。 */
function fitWords(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string {
  let out = '';
  for (let i = 0; i < words.length; i++) {
    const next = out ? `${out}　${words[i]}` : words[i];
    const rest = i < words.length - 1 ? '　等' : '';
    if (ctx.measureText(next + rest).width > maxWidth) return out ? `${out}　等` : words[i];
    out = next;
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface CardInput {
  nickname: string;
  day: DayInfo;
  fortune: DailyFortune;
  dayMaster: string;
  element: string;
}

export async function renderFortuneCard(input: CardInput): Promise<Blob> {
  const { nickname, day, fortune: f } = input;
  // 網路字型依字元分段載入：先把圖卡會用到的字載好，否則 Canvas 會用後備字型
  try {
    const text = [day.solarText, day.weekday, day.lunarText, day.dayGz, day.jieqi, f.god, f.theme, f.line,
      f.color, f.element, ...day.yi, ...day.ji, f.chong?.title ?? '', '今日一籤農曆年月日宜忌幸運五行色數字凡事宜緩・'].join('');
    await Promise.all([
      document.fonts.load(`700 48px "Noto Serif TC"`, text),
      document.fonts.load(`400 34px "Noto Serif TC"`, text),
    ]);
    await document.fonts.ready;
  } catch {
    /* 字型載入失敗時用後備字型 */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 底紙
  const bg = ctx.createRadialGradient(W / 2, H * 0.35, 100, W / 2, H / 2, H * 0.8);
  bg.addColorStop(0, '#fbf6ec');
  bg.addColorStop(1, C.paper2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 外框：朱紅粗框＋金色細線
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 18;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(62, 62, W - 124, H - 124);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  // 由上往下排版，y 為目前基線
  let y = 130;
  ctx.fillStyle = C.red;
  ctx.font = `700 44px ${SERIF}`;
  ctx.fillText('今　日　一　籤', W / 2, y);

  y += 92;
  ctx.fillStyle = C.ink;
  ctx.font = `700 68px ${SERIF}`;
  ctx.fillText(`${day.solarText.replace(/^\d+年/, '')}　${day.weekday}`, W / 2, y);
  y += 56;
  ctx.fillStyle = C.ink2;
  ctx.font = `400 34px ${SERIF}`;
  ctx.fillText(`農曆${day.lunarYearGz}年${day.lunarText}・${day.dayGz}日${day.jieqi ? `・${day.jieqi}` : ''}`, W / 2, y);

  y += 38;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, y);
  ctx.lineTo(W - 140, y);
  ctx.stroke();

  // 十神印章
  y += 30;
  const seal = 120;
  ctx.fillStyle = C.red;
  roundRect(ctx, W / 2 - seal / 2, y, seal, seal, 14);
  ctx.fill();
  ctx.fillStyle = '#fbeedd';
  ctx.font = `700 48px ${SERIF}`;
  ctx.fillText(f.god[0], W / 2, y + 54);
  ctx.fillText(f.god[1], W / 2, y + 106);
  y += seal;

  // 主題與運勢句
  y += 92;
  ctx.fillStyle = C.ink;
  ctx.font = `700 76px ${SERIF}`;
  ctx.fillText(f.theme, W / 2, y);
  ctx.font = `400 38px ${SERIF}`;
  const lines = wrap(ctx, f.line, W - 280).slice(0, 3);
  y += 20;
  for (const l of lines) {
    y += 56;
    ctx.fillText(l, W / 2, y);
  }

  // 幸運三格
  const top = y + 40;
  const boxW = 250;
  const boxH = 138;
  const gap = 30;
  const x0 = (W - boxW * 3 - gap * 2) / 2;
  const items: [string, string][] = [
    ['幸運五行', f.element],
    ['幸運色', `${f.color}色`],
    ['幸運數字', f.numbers.join('・')],
  ];
  items.forEach(([label, value], i) => {
    const x = x0 + i * (boxW + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, x, top, boxW, boxH, 18);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.ink2;
    ctx.font = `400 28px ${SANS}`;
    ctx.fillText(label, x + boxW / 2, top + 46);
    ctx.fillStyle = C.ink;
    ctx.font = `700 48px ${SERIF}`;
    if (i === 1) {
      ctx.fillStyle = f.colorHex;
      ctx.beginPath();
      ctx.arc(x + 70, top + 96, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillText(value, x + boxW / 2 + 20, top + 112);
    } else ctx.fillText(value, x + boxW / 2, top + 112);
  });
  y = top + boxH;

  // 宜忌：各一行，放不下的以「等」結尾
  y += 70;
  const yiji: [string, string[], string][] = [
    ['宜', day.yi, C.gold],
    ['忌', day.ji, C.red],
  ];
  ctx.font = `400 34px ${SERIF}`;
  for (const [label, words, color] of yiji) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(160, y - 12, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 32px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, 160, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = `400 34px ${SERIF}`;
    ctx.fillText(fitWords(ctx, words, W - 360), 210, y);
    y += 72;
  }

  // 沖生肖提醒
  if (f.chong) {
    ctx.fillStyle = 'rgba(158,42,32,0.09)';
    roundRect(ctx, 130, y - 28, W - 260, 76, 16);
    ctx.fill();
    ctx.fillStyle = C.red;
    ctx.textAlign = 'center';
    ctx.font = `700 32px ${SERIF}`;
    ctx.fillText(`${f.chong.title}・凡事宜緩`, W / 2, y + 20);
  }

  // 頁尾（固定在底部）
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink2;
  ctx.font = `400 28px ${SANS}`;
  ctx.fillText(`${nickname}（日主${input.dayMaster}${input.element}）的今日運勢`, W / 2, H - 126);
  ctx.font = `400 22px ${SANS}`;
  ctx.fillText('本內容僅供娛樂參考', W / 2, H - 90);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('圖卡產生失敗'))), 'image/png'),
  );
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export function canShareFiles(): boolean {
  if (import.meta.env.MODE === 'artifact') return false;
  try {
    const f = new File([new Blob()], 'x.png', { type: 'image/png' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

export async function shareImage(blob: Blob, filename: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '今日一籤' });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
