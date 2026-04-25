/**
 * 干支计算模块
 *
 * 对标 sxwnl_spa_dart 的 gan_zhi_calc.dart
 */

import AstroDateTime from '../utils/astro_date_time';

// ============ 基础枚举 ============

/** 十天干 */
export enum TianGan {
  Jia = 0,   // 甲
  Yi = 1,    // 乙
  Bing = 2,  // 丙
  Ding = 3,  // 丁
  Wu = 4,    // 戊
  Ji = 5,    // 己
  Geng = 6,  // 庚
  Xin = 7,   // 辛
  Ren = 8,   // 壬
  Gui = 9,   // 癸
}

/** 十天干名称 */
export const tianGanNames: readonly string[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 十二地支 */
export enum DiZhi {
  Zi = 0,    // 子
  Chou = 1,  // 丑
  Yin = 2,   // 寅
  Mao = 3,   // 卯
  Chen = 4,  // 辰
  Si = 5,    // 巳
  Wu = 6,    // 午
  Wei = 7,   // 未
  Shen = 8,  // 申
  You = 9,   // 酉
  Xu = 10,   // 戌
  Hai = 11,  // 亥
}

/** 十二地支名称 */
export const diZhiNames: readonly string[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 十二生肖名称 */
export const shengXiaoNames: readonly string[] = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// ============ 干支组合 ============

/** 六十甲子序号（0-59）→ 干支名称 */
export const jiaZiNames: readonly string[] = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
  '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
  '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
  '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
  '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
  '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
];

/** 干支对象 */
export interface GanZhi {
  /** 天干 */
  readonly tianGan: TianGan;
  /** 地支 */
  readonly diZhi: DiZhi;
  /** 天干名称 */
  readonly ganName: string;
  /** 地支名称 */
  readonly zhiName: string;
  /** 组合名称（如"甲子"） */
  readonly fullName: string;
  /** 六十甲子序号（0-59） */
  readonly index: number;
}

/** 八字（四柱） */
export interface BaZi {
  /** 年柱 */
  readonly year: GanZhi;
  /** 月柱 */
  readonly month: GanZhi;
  /** 日柱 */
  readonly day: GanZhi;
  /** 时柱 */
  readonly hour: GanZhi;
}

// ============ 基础构造 ============

/** 根据六十甲子序号构造干支 */
export function ganZhiFromIndex(index: number): GanZhi { throw new Error('TODO'); }

/** 根据天干地支构造干支 */
export function ganZhiFromPair(gan: TianGan, zhi: DiZhi): GanZhi { throw new Error('TODO'); }

// ============ 年干支 ============

/**
 * 获取指定公历年份的干支
 * 注意：年干支以立春为界，不是以春节为界。
 */
export function yearGanZhi(year: number): GanZhi { throw new Error('TODO'); }

/** 获取指定公历年份的生肖 */
export function yearShengXiao(year: number): string { throw new Error('TODO'); }

// ============ 月干支 ============

/**
 * 获取指定年天干和月地支索引的月干支
 * @param yearGan 年天干
 * @param monthIndex 月地支索引（0=寅月/正月, 1=卯月, ...）
 */
export function monthGanZhi(yearGan: TianGan, monthIndex: number): GanZhi { throw new Error('TODO'); }

/**
 * 根据公历日期获取月干支
 * 注意：月干支以节气为界（节换月）。
 */
export function monthGanZhiAt(date: AstroDateTime): GanZhi { throw new Error('TODO'); }

// ============ 日干支 ============

/**
 * 获取指定公历日期的日干支
 */
export function dayGanZhi(date: AstroDateTime): GanZhi { throw new Error('TODO'); }

/**
 * 获取指定 J2000 相对儒略日的日干支
 */
export function dayGanZhiFromJd(jd: number): GanZhi { throw new Error('TODO'); }

// ============ 时干支 ============

/**
 * 获取指定日天干和时辰索引的时干支
 * @param dayGan 日天干
 * @param hourIndex 时辰索引（0=子时 23-1, 1=丑时 1-3, ...）
 */
export function hourGanZhi(dayGan: TianGan, hourIndex: number): GanZhi { throw new Error('TODO'); }

/**
 * 根据公历日期时间获取时干支
 * @param date 日期时间
 * @param splitRatHour 是否分早子时/晚子时。true 时 23:00-23:59 算次日；false 时统一算当日。
 */
export function hourGanZhiAt(date: AstroDateTime, splitRatHour?: boolean): GanZhi { throw new Error('TODO'); }

/**
 * 将小时数转换为时辰索引
 * @param hour 小时（0-23）
 * @returns 时辰索引（0=子, 1=丑, ...）
 */
export function hourToZhiIndex(hour: number): number { throw new Error('TODO'); }

// ============ 八字 ============

/**
 * 计算八字（四柱）
 * @param date 公历日期时间
 * @param splitRatHour 是否分早子时/晚子时
 */
export function calcBaZi(date: AstroDateTime, splitRatHour?: boolean): BaZi { throw new Error('TODO'); }

// ============ 便捷查询 ============

/**
 * 获取指定年份范围内的所有年干支信息
 */
export function getYearRangeGanZhi(startYear: number, endYear: number): { year: number; ganZhi: GanZhi; shengXiao: string }[] { throw new Error('TODO'); }

/**
 * 获取指定年天干的全年 12 个月干支
 */
export function getYearMonthGanZhi(yearGan: TianGan): GanZhi[] { throw new Error('TODO'); }

/**
 * 获取指定日天干的全天 12 个时辰干支
 */
export function getDayHourGanZhi(dayGan: TianGan): GanZhi[] { throw new Error('TODO'); }
