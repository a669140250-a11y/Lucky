// 历法一律交给 lunar-javascript 计算；这里只负责包装与类型。
import { I18n, LunarUtil, Solar } from 'lunar-javascript';

let ready = false;
/** 使用函数库内建的简体语言包；只修正个别用字。 */
export function initLunar(): void {
  if (ready) return;
  I18n.setMessages('chs', { 'yj.yuShi': '余事勿取' }); // 函数库作“馀事勿取”
  I18n.setLanguage('chs');
  ready = true;
}
initLunar();

export type Element = '木' | '火' | '土' | '金' | '水';
export const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export const SHENGXIAO: Record<string, string> = {
  子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇',
  午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪',
};
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/** 天干五行（取自函式库对照表）。 */
export function ganElement(gan: string): Element {
  const e = LunarUtil.WU_XING_GAN[gan];
  if (!e) throw new Error(`未知天干：${gan}`);
  return e as Element;
}
/** 阳干：甲丙戊庚壬。 */
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
  lunarYearSx: string; // 马
  lunarText: string; // 九月廿九
  yearGz: string;
  monthGz: string;
  dayGz: string;
  dayGan: string;
  dayZhi: string;
  yi: string[];
  ji: string[];
  chongZhi: string; // 今日日支所冲的地支
  chongSx: string; // 所冲生肖
  chongDesc: string; // (己卯)兔
  sha: string; // 煞方
  jieqi: string; // 今天若为节气
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
    lunarText: `${l.getMonthInChinese()}月${l.getDayInChinese()}`,
    yearGz: l.getYearInGanZhiByLiChun(),
    monthGz: l.getMonthInGanZhi(),
    dayGz: l.getDayInGanZhi(),
    dayGan: l.getDayGan(),
    dayZhi: l.getDayZhi(),
    yi: l.getDayYi(),
    ji: l.getDayJi(),
    chongZhi: l.getDayChong(),
    chongSx: l.getDayChongShengXiao(),
    chongDesc: l.getDayChongDesc(),
    sha: l.getDaySha(),
    jieqi: l.getJieQi(),
  };
}

/** 时辰。hour/minute 为换算八字时采用的代表时刻。 */
export const HOURS = [
  { key: 'zi-early', label: '早子时', range: '00:00–00:59', hour: 0, minute: 30 },
  { key: 'chou', label: '丑时', range: '01:00–02:59', hour: 2, minute: 0 },
  { key: 'yin', label: '寅时', range: '03:00–04:59', hour: 4, minute: 0 },
  { key: 'mao', label: '卯时', range: '05:00–06:59', hour: 6, minute: 0 },
  { key: 'chen', label: '辰时', range: '07:00–08:59', hour: 8, minute: 0 },
  { key: 'si', label: '巳时', range: '09:00–10:59', hour: 10, minute: 0 },
  { key: 'wu', label: '午时', range: '11:00–12:59', hour: 12, minute: 0 },
  { key: 'wei', label: '未时', range: '13:00–14:59', hour: 14, minute: 0 },
  { key: 'shen', label: '申时', range: '15:00–16:59', hour: 16, minute: 0 },
  { key: 'you', label: '酉时', range: '17:00–18:59', hour: 18, minute: 0 },
  { key: 'xu', label: '戌时', range: '19:00–20:59', hour: 20, minute: 0 },
  { key: 'hai', label: '亥时', range: '21:00–22:59', hour: 22, minute: 0 },
  { key: 'zi-late', label: '晚子时', range: '23:00–23:59', hour: 23, minute: 30 },
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
  lunarBirth: string; // 农历生日
}

/**
 * 由出生资料算日主与生肖。
 * - 生肖依八字年柱，以立春换年。
 * - 晚子时（23:00 后）日柱算隔天（子初换日，函式库 sect 1）。
 * - 未填时辰时以中午计算，只影响“立春当天出生”等极少数边界情形。
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
    lunarBirth: `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
  };
}

/** 验证公历日期是否存在。 */
export function isValidDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1901 || y > 2099 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}
