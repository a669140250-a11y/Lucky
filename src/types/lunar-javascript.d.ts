// lunar-javascript 没有附型别；这里只宣告本 App 用到的部分。
declare module 'lunar-javascript' {
  export interface JieQi {
    getName(): string;
  }
  export interface EightChar {
    setSect(sect: 1 | 2): void;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearZhi(): string;
    getDayGan(): string;
    getDayWuXing(): string;
  }
  export interface Lunar {
    getYearInGanZhi(): string;
    getYearInGanZhiByLiChun(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getMonth(): number;
    getDay(): number;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getYearShengXiao(): string;
    getDayYi(): string[];
    getDayJi(): string[];
    getDayChong(): string;
    getDayChongShengXiao(): string;
    getDayChongDesc(): string;
    getDaySha(): string;
    getJieQi(): string;
    getEightChar(): EightChar;
  }
  export interface Solar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getWeek(): number;
    getLunar(): Lunar;
  }
  export const Solar: {
    fromYmd(y: number, m: number, d: number): Solar;
    fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): Solar;
    fromDate(date: Date): Solar;
  };
  export const LunarUtil: {
    GAN: string[];
    ZHI: string[];
    WU_XING_GAN: Record<string, string>;
    SHI_SHEN: Record<string, string>;
  };
  export const I18n: {
    getLanguage(): string;
    setLanguage(lang: string): void;
    setMessages(lang: string, messages: Record<string, string>): void;
  };
}
