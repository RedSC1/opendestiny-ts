/**
 * 农历日期类
 *
 * 对标 sxwnl_spa_dart 的 models/lunar_date.dart。
 * 封装公历↔农历互转，内部根据日期范围自动选择现代天文算法或历史修正表引擎。
 */

import AstroDateTime from '../utils/astro_date_time';
import { RatHourMode } from '../enums/rat-hour-mode';
import { arrangeLunarYear, type LunarYear } from './lunar-year';
import { arrangeHistoricalLunarYear, type HistoricalLunarYear } from '../historical/lunar-year';

// ============ 内部辅助 ============

/** 农历日中文名 */
const _dayNames: readonly string[] = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

/** 月名 → 数字 */
function _cnToInt(cn: string): number {
  const map: Record<string, number> = {
    '正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '冬': 11, '腊': 12, '十二': 12, '拾贰': 12,
    '十三': 13, '后九': 9,
  };
  return map[cn] ?? 0;
}

/** 取整（向负无穷） */
function _int2(v: number): number {
  return Math.floor(v);
}

/** UT → 当地日编号 */
function _toLocalDay(utJd: number, longitude: number): number {
  return _int2(utJd + longitude / 15 / 24 + 0.5);
}

/** UT → 北京时间日编号 */
function _toBjtDay(utJd: number): number {
  return _int2(utJd + 8 / 24 + 0.5);
}

/**
 * 历史修正表的有效范围（取并集：任一表有修正即走历史）。
 *
 * 三个修正表的实际覆盖：
 * - 朔日：~722 BC ~ 1960 AD（FIRST_SUO_JD = -993847，33173 条）
 * - 远古节气（平气）：-221 BC ~ 1645 AD（FIRST_QI_JD = -810895，44781 条）
 * - 近代节气（定气）：1646 ~ 1960 AD（FIRST_QI_JD = -129395，7567 条）
 *
 * auto 模式：-722 <= year < 1960 走历史，其余走现代。
 * 超出某表范围时，对应函数自动 fallback 到低精度搜索。
 */
const HISTORICAL_START_YEAR = -722;
const HISTORICAL_END_YEAR = 1960;

// ============ 类型 ============

/** LunarDate 构造选项 */
export interface LunarDateOptions {
  /**
   * 是否使用历史修正表。
   * - 未指定时：不传 longitude 则按年份自动选择（619-1960），传了 longitude 则强制现代
   * - 显式指定：覆盖上述规则
   */
  useHistorical?: boolean;
  /**
   * 经度（度，东经为正）。
   * - 未传：默认 120°E（北京时间）+ 历史修正
   * - 传了：纯现代天文算法（即使传 120），不走历史修正
   */
  longitude?: number;
}

// ============ LunarDate 类 ============

export class LunarDate {
  /** 农历年份（天文纪年，有公元0年） */
  readonly lunarYear: number;
  /** 月份数字（1=正月, 2=二月, ..., 12=腊月, 13=十三月） */
  readonly month: number;
  /** 日（1-30） */
  readonly day: number;
  /** 是否闰月 */
  readonly isLeap: boolean;
  /** 月名显示字符串（如 "正", "闰四", "十三"） */
  readonly monthName: string;
  /** 该月总天数（29 或 30） */
  readonly monthSize: number;

  /** @internal 记住引擎选择，供 toSolar 回查 */
  private readonly _useHistorical: boolean;
  /** @internal */
  private readonly _longitude: number;
  /** @internal 该月朔日的整日编号（现代引擎为当地时 int，历史引擎为 BJT int） */
  private readonly _newMoonStart: number;

  private constructor(opts: {
    lunarYear: number;
    month: number;
    day: number;
    isLeap: boolean;
    monthName: string;
    monthSize: number;
    useHistorical: boolean;
    longitude: number;
    newMoonStart: number;
  }) {
    this.lunarYear = opts.lunarYear;
    this.month = opts.month;
    this.day = opts.day;
    this.isLeap = opts.isLeap;
    this.monthName = opts.monthName;
    this.monthSize = opts.monthSize;
    this._useHistorical = opts.useHistorical;
    this._longitude = opts.longitude;
    this._newMoonStart = opts.newMoonStart;
  }

  // ============ 工厂方法 ============

  /**
   * 公历日期 → 农历日期。
   *
   * @param solarTime 公历日期时间
   * @param options.useHistorical 是否使用历史修正表，默认 year<1960 时启用
   * @param options.longitude 经度（仅现代引擎），默认 120
   */
  static fromSolar(
    solarTime: AstroDateTime,
    options?: LunarDateOptions,
  ): LunarDate {
    const hasExplicitLongitude = options?.longitude !== undefined;
    const longitude = options?.longitude ?? 120;

    // 处理 RatHourMode：noSplit 模式下 23:00 后滚到次日
    let solar = solarTime;
    if (solarTime.hour >= 23) {
      solar = solarTime.add(3600 * 1000);
    }

    const jd = solar.toJ2000();

    // 引擎选择：
    // 1. useHistorical 显式指定 → 照办
    // 2. 传了 longitude（任意值）→ 现代引擎
    // 3. 都没传 → 默认 120°E + 历史修正（619-1960）
    const useHistorical = options?.useHistorical ??
      (!hasExplicitLongitude &&
        solar.year >= HISTORICAL_START_YEAR &&
        solar.year < HISTORICAL_END_YEAR);

    if (useHistorical) {
      return this._fromSolarHistorical(jd);
    }
    return this._fromSolarModern(jd, longitude);
  }

  /** 现代天文算法路径 */
  private static _fromSolarModern(jd: number, longitude: number): LunarDate {
    const ly = arrangeLunarYear(jd, longitude);
    // jd 是 UT，转当地日编号
    const localDay = _toLocalDay(jd, longitude);

    for (let i = 0; i < 14; i++) {
      // newMoons 已在 arrangeLunarYear 中转为当地时，只需取整
      const start = _int2(ly.newMoons[i]! + 0.5);
      const end = _int2(ly.newMoons[i + 1]! + 0.5);

      if (localDay >= start && localDay < end) {
        const lunarYear = _computeLunarYearModern(ly, i);
        const rawName = ly.monthNames[i]!;
        const { month, isLeap, monthName } = _parseMonthName(rawName, i === ly.leapMonthIndex);

        return new LunarDate({
          lunarYear,
          month,
          day: localDay - start + 1,
          isLeap,
          monthName,
          monthSize: ly.monthLengths[i]!,
          useHistorical: false,
          longitude,
          newMoonStart: start,
        });
      }
    }

    throw new Error(`LunarDate.fromSolar: date not found in lunar year (jd=${jd.toFixed(2)})`);
  }

  /** 历史修正表路径 */
  private static _fromSolarHistorical(jd: number): LunarDate {
    const ly = arrangeHistoricalLunarYear(jd);
    const bjtDay = _toBjtDay(jd);

    for (let i = 0; i < 14; i++) {
      const start = ly.newMoons[i]!;   // 已是 int day number
      const end = ly.newMoons[i + 1]!;

      if (bjtDay >= start && bjtDay < end) {
        const lunarYear = _computeLunarYearHistorical(ly, i);
        const rawName = ly.monthNames[i]!;
        const { month, isLeap, monthName } = _parseMonthName(rawName, i === ly.leapMonthIndex);

        return new LunarDate({
          lunarYear,
          month,
          day: bjtDay - start + 1,
          isLeap,
          monthName,
          monthSize: ly.monthLengths[i]!,
          useHistorical: true,
          longitude: 120,
          newMoonStart: start,
        });
      }
    }

    throw new Error(`LunarDate.fromSolar: date not found in historical lunar year (jd=${jd.toFixed(2)})`);
  }

  /**
   * 农历日期字符串 → LunarDate。
   *
   * @param year 农历年（天文纪年）
   * @param monthName 月名，如 "正"、"二"、"闰四"、"十三"、"后九"
   * @param day 日（1-30）
   * @param options.isLeap 是否闰月（可缺省，从 monthName 自动解析）
   */
  static fromString(
    year: number,
    monthName: string,
    day: number,
    options?: LunarDateOptions & { isLeap?: boolean },
  ): LunarDate {
    const { month: logicalMonth, isLeap } = _parseMonthName(
      monthName,
      options?.isLeap ?? monthName.startsWith('闰'),
    );
    const hasExplicitLongitude = options?.longitude !== undefined;
    const longitude = options?.longitude ?? 120;
    const useHistorical = options?.useHistorical ??
      (!hasExplicitLongitude &&
        year >= HISTORICAL_START_YEAR &&
        year < HISTORICAL_END_YEAR);

    // 跨正月边界：月份可能在 year 或 year+1 的冬至年窗口里
    for (let offset = 0; offset <= 1; offset++) {
      const searchYear = year + offset;
      const searchJd = new AstroDateTime(searchYear, 6, 1).toJ2000();

      let ly: LunarYear | HistoricalLunarYear;
      if (useHistorical) {
        ly = arrangeHistoricalLunarYear(searchJd);
      } else {
        ly = arrangeLunarYear(searchJd, longitude);
      }

      for (let i = 0; i < 14; i++) {
        const rawName = ly.monthNames[i]!;
        const parsed = _parseMonthName(rawName, i === ly.leapMonthIndex);

        if (parsed.month === logicalMonth && parsed.isLeap === isLeap) {
          // 验证农历年是否匹配
          const zhengYueIdx = ly.monthNames.indexOf('正');
          let expectedYear: number;
          if (useHistorical) {
            expectedYear = _computeLunarYearHistorical(
              ly as HistoricalLunarYear,
              i,
              zhengYueIdx,
            );
          } else {
            expectedYear = _computeLunarYearModern(
              ly as LunarYear,
              i,
              zhengYueIdx,
            );
          }

          if (expectedYear !== year) continue;

          const monthSize = ly.monthLengths[i]!;
          if (day < 1 || day > monthSize) {
            throw new RangeError(
              `农历 ${year} 年 ${parsed.monthName} 只有 ${monthSize} 天`,
            );
          }

          const rawStart = ly.newMoons[i]!;
          const newMoonStart = useHistorical
            ? rawStart                           // 历史：已是 int
            : _int2(rawStart + 0.5);             // 现代：float → local int

          return new LunarDate({
            lunarYear: year,
            month: logicalMonth,
            day,
            isLeap: parsed.isLeap,
            monthName: parsed.monthName,
            monthSize,
            useHistorical,
            longitude,
            newMoonStart,
          });
        }
      }
    }

    throw new Error(`农历 ${year} 年不存在 '${monthName}'`);
  }

  // ============ 回转换 ============

  /** 农历日期 → 公历日期（使用构造时记录的朔日编号，避免搜索歧义） */
  get toSolar(): AstroDateTime {
    return AstroDateTime.fromJ2000(this._newMoonStart + this.day - 1);
  }

  // ============ 便捷属性 ============

  /** 农历日中文名（初一、初二...三十） */
  get dayName(): string {
    if (this.day < 1 || this.day > 30) return `${this.day}日`;
    return _dayNames[this.day - 1]!;
  }

  /** 是否本月最后一天（除夕判断用） */
  get isLastDay(): boolean {
    return this.day === this.monthSize;
  }

  /** 是否公元前（天文纪年 <= 0） */
  get isBCE(): boolean {
    return this.lunarYear <= 0;
  }

  /** 公元前年份（公元前1年→1，公元前2年→2），公元后返回 null */
  get bceYear(): number | null {
    return this.isBCE ? 1 - this.lunarYear : null;
  }

  /** 历史纪年年份（无公元0年）。公元前返回正整数的 BCE 年号，公元后直接返回原值。 */
  get historicalYear(): number {
    return this.isBCE ? 1 - this.lunarYear : this.lunarYear;
  }

  toString(): string {
    const yearDisplay = this.isBCE ? `公元前${this.historicalYear}` : `${this.historicalYear}`;
    return `${yearDisplay}年${this.monthName}月${this.dayName}`;
  }
}

// ============ 内部：月名解析 ============

function _parseMonthName(
  rawName: string,
  isLeapByIndex: boolean,
): { month: number; isLeap: boolean; monthName: string } {
  // 特殊月名（不做闰月前缀处理）
  if (rawName === '十三') return { month: 13, isLeap: true, monthName: '十三' };
  if (rawName === '后九') return { month: 9, isLeap: true, monthName: '后九' };
  if (rawName === '拾贰') return { month: 12, isLeap: false, monthName: '拾贰' };

  // 去掉 "闰" 前缀
  const isLeap = isLeapByIndex;
  const cleanName = rawName.replace(/^闰/, '');
  const month = _cnToInt(cleanName);
  const monthName = isLeap ? `闰${cleanName}` : cleanName;

  return { month, isLeap, monthName };
}

// ============ 内部：农历年份推算 ============

// ============ 内部：农历年份推算（对标 Dart _astronomicalLunarYearForIndex） ============

/**
 * 是否处于春秋/战国/秦汉历史历法区间（-721 ~ -104 BC）。
 * 该区间不以正月为年界，而是按历史月建序列的第一个月名为年首。
 */
function _usesAncientBoundary(ly: HistoricalLunarYear): boolean {
  const yy = _int2((ly.solarTerms[0]! + 10 + 180) / 365.2422) + 2000;
  return yy >= -721 && yy <= -104;
}

/** 查找首月名在数组中第二次出现的索引，作为历史年界。 */
function _ancientYearStartIndex(ly: HistoricalLunarYear): number {
  const first = ly.monthNames[0]!;
  for (let i = 1; i < ly.monthNames.length; i++) {
    if (ly.monthNames[i] === first) return i;
  }
  return ly.monthNames.length;
}

/** 古代历史历法的基准年：取首月到次年同月的中间点对应的公历年。 */
function _ancientBaseYear(ly: HistoricalLunarYear, nextYearStartIndex: number): number {
  const startJd = ly.newMoons[0]!;
  const endIdx = nextYearStartIndex < ly.newMoons.length ? nextYearStartIndex : ly.newMoons.length - 1;
  const endJd = ly.newMoons[endIdx]!;
  return AstroDateTime.fromJ2000((startJd + endJd) / 2).year;
}

/** 查找下一个"正"月索引（用于计算常规年界的中点），找不到返回 null。 */
function _findNextZhengYue(ly: LunarYear | HistoricalLunarYear, zhengYueIdx: number): number | null {
  for (let i = zhengYueIdx + 1; i < ly.monthNames.length; i++) {
    if (ly.monthNames[i] === '正') return i;
  }
  return null;
}

/**
 * 统一入口：计算给定月索引所属的农历年。
 *
 * 对标 Dart LunarDate._astronomicalLunarYearForIndex：
 * - 春秋/战国/秦汉（-721 ~ -104 BC）：以历史月建序列的首月重复位置为年界
 * - 其余历史区间：以相邻两个"正"月的中间点为年界
 */
function _astronomicalLunarYear(
  ly: HistoricalLunarYear,
  monthIndex: number,
  zhengYueIdx?: number,
): number {
  if (_usesAncientBoundary(ly)) {
    const nextIdx = _ancientYearStartIndex(ly);
    const baseYear = _ancientBaseYear(ly, nextIdx);
    return monthIndex < nextIdx ? baseYear : baseYear + 1;
  }

  const zyIdx = zhengYueIdx ?? ly.monthNames.indexOf('正');
  if (zyIdx < 0) return ly.year;

  const startJd = ly.newMoons[zyIdx]!;
  const nextIdx = _findNextZhengYue(ly, zyIdx);
  const endJd = nextIdx != null ? ly.newMoons[nextIdx]! : startJd + 180;
  const mid = (startJd + endJd) / 2;
  const currentYear = AstroDateTime.fromJ2000(mid).year;

  return monthIndex < zyIdx ? currentYear - 1 : currentYear;
}

/**
 * 现代引擎：通过相邻两个正月初一的中间点推算农历年。
 *
 * 对标 Dart _regularLunarYearFromMidpoint。
 */
function _computeLunarYearModern(
  ly: LunarYear,
  monthIndex: number,
  zhengYueIdx?: number,
): number {
  const zyIdx = zhengYueIdx ?? ly.monthNames.indexOf('正');
  if (zyIdx < 0) return ly.year;

  const startJd = ly.newMoons[zyIdx]!;
  const nextIdx = _findNextZhengYue(ly, zyIdx);
  const endJd = nextIdx != null ? ly.newMoons[nextIdx]! : startJd + 180;
  const mid = (startJd + endJd) / 2;
  const currentYear = AstroDateTime.fromJ2000(mid).year;

  return monthIndex < zyIdx ? currentYear - 1 : currentYear;
}

/**
 * 历史引擎：委托给 _astronomicalLunarYear（含古代年界逻辑）。
 */
function _computeLunarYearHistorical(
  ly: HistoricalLunarYear,
  monthIndex: number,
  zhengYueIdx?: number,
): number {
  return _astronomicalLunarYear(ly, monthIndex, zhengYueIdx);
}
