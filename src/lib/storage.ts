import type { Birth } from './lunar';

export type CategoryId = 'career' | 'love' | 'wealth' | 'health' | 'study' | 'other';
export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'career', label: '事业' },
  { id: 'love', label: '感情' },
  { id: 'wealth', label: '财运' },
  { id: 'health', label: '健康' },
  { id: 'study', label: '学业' },
  { id: 'other', label: '其他' },
];
export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? '其他';

export interface Profile {
  nickname: string;
  birth: Birth;
}

export type ThemePref = 'system' | 'light' | 'dark';
export interface Settings {
  confirmMode: 1 | 3; // 掷筊确认：一个圣筊或连续三个圣筊
  theme: ThemePref;
  sound: boolean;
  vibrate: boolean;
}
export const DEFAULT_SETTINGS: Settings = { confirmMode: 1, theme: 'system', sound: true, vibrate: true };

export type Outcome = 'pending' | 'yes' | 'no';
export interface JournalEntry {
  id: string;
  ts: number;
  dateKey: string;
  solarText: string;
  lunarText: string;
  dayGz: string;
  category: CategoryId;
  question: string;
  qianNo: number;
  qianGz: string;
  grade: string;
  outcome: Outcome;
  note: string;
}

const K = {
  profile: 'jryq.profile.v1',
  settings: 'jryq.settings.v1',
  journal: 'jryq.journal.v1',
};

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadProfile = () => read<Profile | null>(K.profile, null);
export const saveProfile = (p: Profile) => write(K.profile, p);
export const loadSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) });
export const saveSettings = (s: Settings) => write(K.settings, s);
export const loadJournal = () => read<JournalEntry[]>(K.journal, []);
export const saveJournal = (j: JournalEntry[]) => write(K.journal, j);

export function newId(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return Date.now().toString(36) + a[0].toString(36) + a[1].toString(36);
}

export interface Backup {
  app: 'jinri-yiqian';
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  settings: Settings;
  journal: JournalEntry[];
}

export function makeBackup(): Backup {
  return {
    app: 'jinri-yiqian',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: loadProfile(),
    settings: loadSettings(),
    journal: loadJournal(),
  };
}

/** 验证并回传备份内容；格式不符时丢出错误。 */
export function parseBackup(text: string): Backup {
  const b = JSON.parse(text) as Backup;
  if (b?.app !== 'jinri-yiqian' || !Array.isArray(b.journal)) throw new Error('不是今日一签的备份文件');
  return b;
}

export function clearAll(): void {
  try {
    Object.values(K).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 忽略 */
  }
}
