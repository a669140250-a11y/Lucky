// 曆法一律交給 lunar-javascript 計算；這裡只負責包裝、繁體化與型別。
import { I18n, LunarUtil, Solar } from 'lunar-javascript';
import cht from '../data/lunar-cht.json';

let ready = false;
/** 載入繁體語言包（由 scripts/gen-lunar-cht.mjs 從函式庫內建簡體詞庫轉出）。 */
export function initLunar(): void {
  if (ready) return;
  I18n.setMessages('cht', cht as Record<string, string>);
  I18n.setLanguage('cht');
  ready = true;
}
initLunar();

// 函式庫少數寫死在程式碼裡、未經語言包的字
const fix = (s: string) => s.replace(/闰/g, '閏');

export type Element = '木' | '火' | '土' | '金' | '水';
export const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export const SHENGXIAO: Record<string, string> = {
  子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龍', 巳: '蛇',
  午: '馬', 未: '羊', 申: '猴', 酉: '雞', 戌: '狗', 亥: '豬',
};
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/** 天干五行（取自函式庫對照表）。 */
export function ganElement(gan: string): Element {
  const e = LunarUtil.WU_XING_GAN[gan];
  if (!e) throw new Error(`未知天干：${gan}`);
  return e as Element;
}
/** 陽干：甲丙戊庚壬。 */
export function isYangGan(gan: string): boolean {
  return GANS.indexOf(gan as (typeof GANS)[number]) % 2 === 0;
}

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface DayInfo {
  key: string;
  solarText: string; // 2026年11月7日
  weekday: string; // 星期六
  lunarYearGz: string; // 丙午
  lunarYearSx: string; // 馬
  lunarText: string; // 九月廿九
  yearGz: string;
  monthGz: string;
  dayGz: string;
  dayGan: string;
  dayZhi: string;
  yi: string[];
  ji: string[];
  chongZhi: string; // 今日日支所沖的地支
  chongSx: string; // 所沖生肖
  chongDesc: string; // (己卯)兔
  sha: string; // 煞方
  jieqi: string; // 今天若為節氣
}

export function getDayInfo(date: Date): DayInfo {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const l = solar.getLunar();
  return {
    key: dateKey(date),
    solarText: `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`,
    weekday: `星期${WEEK[solar.getWeek()]}`,
    lunarYearGz: l.getYearInGanZhi(),
    lunarYearSx: l.getYearShengXiao(),
    lunarText: fix(`${l.getMonthInChinese()}月${l.getDayInChinese()}`),
    yearGz: l.getYearInGanZhiByLiChun(),
    monthGz: l.getMonthInGanZhi(),
    dayGz: l.getDayInGanZhi(),
    dayGan: l.getDayGan(),
    dayZhi: l.getDayZhi(),
    yi: l.getDayYi().map(fix),
    ji: l.getDayJi().map(fix),
    chongZhi: l.getDayChong(),
    chongSx: l.getDayChongShengXiao(),
    chongDesc: l.getDayChongDesc(),
    sha: l.getDaySha(),
    jieqi: l.getJieQi(),
  };
}

/** 時辰。hour/minute 為換算八字時採用的代表時刻。 */
export const HOURS = [
  { key: 'zi-early', label: '早子時', range: '00:00–00:59', hour: 0, minute: 30 },
  { key: 'chou', label: '丑時', range: '01:00–02:59', hour: 2, minute: 0 },
  { key: 'yin', label: '寅時', range: '03:00–04:59', hour: 4, minute: 0 },
  { key: 'mao', label: '卯時', range: '05:00–06:59', hour: 6, minute: 0 },
  { key: 'chen', label: '辰時', range: '07:00–08:59', hour: 8, minute: 0 },
  { key: 'si', label: '巳時', range: '09:00–10:59', hour: 10, minute: 0 },
  { key: 'wu', label: '午時', range: '11:00–12:59', hour: 12, minute: 0 },
  { key: 'wei', label: '未時', range: '13:00–14:59', hour: 14, minute: 0 },
  { key: 'shen', label: '申時', range: '15:00–16:59', hour: 16, minute: 0 },
  { key: 'you', label: '酉時', range: '17:00–18:59', hour: 18, minute: 0 },
  { key: 'xu', label: '戌時', range: '19:00–20:59', hour: 20, minute: 0 },
  { key: 'hai', label: '亥時', range: '21:00–22:59', hour: 22, minute: 0 },
  { key: 'zi-late', label: '晚子時', range: '23:00–23:59', hour: 23, minute: 30 },
] as const;
export type HourKey = (typeof HOURS)[number]['key'];

export interface Birth {
  y: number;
  m: number;
  d: number;
  hour: HourKey | null;
}

export interface Bazi {
  dayMaster: string; // 日主（日干）
  element: Element;
  yang: boolean;
  yearZhi: string;
  shengxiao: string;
  pillars: { year: string; month: string; day: string; time: string | null };
  lunarBirth: string; // 農曆生日
}

/**
 * 由出生資料算日主與生肖。
 * - 生肖依八字年柱，以立春換年。
 * - 晚子時（23:00 後）日柱算隔天（子初換日，函式庫 sect 1）。
 * - 未填時辰時以中午計算，只影響「立春當天出生」等極少數邊界情形。
 */
export function computeBazi(b: Birth): Bazi {
  const h = b.hour ? HOURS.find((x) => x.key === b.hour)! : null;
  const solar = Solar.fromYmdHms(b.y, b.m, b.d, h ? h.hour : 12, h ? h.minute : 0, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();
  ec.setSect(1);
  const dayMaster = ec.getDayGan();
  const yearZhi = ec.getYearZhi();
  return {
    dayMaster,
    element: ganElement(dayMaster),
    yang: isYangGan(dayMaster),
    yearZhi,
    shengxiao: SHENGXIAO[yearZhi],
    pillars: { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: h ? ec.getTime() : null },
    lunarBirth: fix(`${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`),
  };
}

/** 驗證國曆日期是否存在。 */
export function isValidDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1901 || y > 2099 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}
