/**
 * 日历聚合层
 *
 * 对标 sxwnl_spa_dart 的 calendar.dart
 * 底层星历返回 UT，本层负责：
 * - 时区转换（经度 → 地方时）
 * - 农历/节气/干支/节日聚合
 * - 按公历月/农历月/节气周期组织输出
 */

import AstroDateTime from '../utils/astro_date_time';
import type { GanZhi, BaZi } from './gan-zhi';
import type { JieQiResult } from './jie-qi';
import type { MoonPhaseResult } from './shuo-wang';
import { PolarStatus } from '../enums/polar-status';

// ============ 时区工具 ============

/** 默认经度：东经 120°（北京时间） */
export const DEFAULT_LONGITUDE = 120;

/**
 * 经度 → 时区偏移（小时）。
 * 北京 120°E → 0h；越南 105°E → +1h；日本 135°E → -1h。
 */
export function longitudeToOffsetHours(longitude: number): number { throw new Error('TODO'); }

/**
 * UT JD → 地方时 JD。
 * @param jdUT J2000 相对儒略日（UT）
 * @param longitude 经度（默认 120）
 * @returns 地方时 JD（仍相对于 J2000）
 */
export function utToLocalJd(jdUT: number, longitude?: number): number { throw new Error('TODO'); }

// ============ 节日系统（占位，后续扩展） ============

export enum FestivalLevel {
  statutory = 'statutory',
  traditional = 'traditional',
  popular = 'popular',
  minor = 'minor',
}

export enum FestivalSource {
  solar = 'solar',
  lunar = 'lunar',
  solarTerm = 'solarTerm',
  custom = 'custom',
}

export interface Festival {
  readonly name: string;
  readonly level: FestivalLevel;
  readonly source: FestivalSource;
}

// ============ 单日信息 ============

/** 农历日期 */
export interface LunarDate {
  readonly year: number;
  readonly monthName: string;
  readonly isLeap: boolean;
  readonly day: number;
  readonly monthSize: number;
}

/** 日出日落信息 */
export interface SunriseSunset {
  readonly sunrise: AstroDateTime | null;
  readonly sunset: AstroDateTime | null;
}

/** 单日完整信息（已转换为目标经度的地方时） */
export interface DayInfo {
  readonly solarDate: AstroDateTime;
  readonly lunarDate: LunarDate;
  readonly weekday: number;
  readonly ganZhi: GanZhi;
  readonly baZi?: BaZi;
  readonly solarTerm: string | null;
  readonly solarTermTime: AstroDateTime | null;
  readonly moonPhase: string | null;
  readonly moonPhaseTime: AstroDateTime | null;
  readonly constellation: string | null;
  readonly festivals: readonly Festival[];
  readonly polarStatus: PolarStatus;
  readonly sunriseSunset?: SunriseSunset;
}

// ============ 年份信息 ============

export interface YearInfo {
  readonly year: number;
  readonly ganZhi: GanZhi;
  readonly shengXiao: string;
}

// ============ 日历查询选项 ============

export interface CalendarOptions {
  /** 目标经度（默认 120，即北京时间）。决定节气/朔望显示的地方时。 */
  longitude?: number;
  /** 地理位置（用于日出日落计算） */
  location?: { longitude: number; latitude: number };
  /** 是否使用历史节气修正（古历还原） */
  useHistoricalSolarTerms?: boolean;
  /** 是否计算八字 */
  includeBaZi?: boolean;
  /** 是否分早子时/晚子时 */
  splitRatHour?: boolean;
}

// ============ 核心 API：逐日查询 ============

/**
 * 获取日期范围内每一天的日历详细信息。
 *
 * @param start 起始日期（本地历法时间）
 * @param end 结束日期（本地历法时间，包含）
 * @param options 可选配置
 * @returns DayInfo 数组（已按指定经度转换地方时）
 */
export function getDayRange(
  start: AstroDateTime,
  end: AstroDateTime,
  options?: CalendarOptions,
): DayInfo[] { throw new Error('TODO'); }

// ============ 按月查询 ============

/**
 * 获取指定公历月的每日详细信息。
 */
export function getSolarMonthDays(
  year: number,
  month: number,
  options?: CalendarOptions,
): DayInfo[] { throw new Error('TODO'); }

/**
 * 获取指定农历月的每日详细信息。
 */
export function getLunarMonthDays(
  lunarYear: number,
  monthName: string,
  options?: CalendarOptions,
): DayInfo[] { throw new Error('TODO'); }

/**
 * 获取指定节气周期内的每日详细信息（从目标日期所在"节"到下一个"节"）。
 */
export function getJieQiPeriodDays(
  date: AstroDateTime,
  options?: CalendarOptions,
): DayInfo[] { throw new Error('TODO'); }

// ============ 年份查询 ============

export function getYearInfo(year: number): YearInfo { throw new Error('TODO'); }
export function getYearRangeInfo(startYear: number, endYear: number): YearInfo[] { throw new Error('TODO'); }
