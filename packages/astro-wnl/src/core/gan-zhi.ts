/**
 * 干支计算模块（强类型版）
 *
 * 对标 sxwnl_spa_dart 的 models/gan_zhi.dart + sxwnl/gan_zhi_calc.dart
 * 全部用 enum + class，拒绝字符串裸奔。
 */

import AstroDateTime from '../utils/astro_date_time';
import { TimePack } from '../models/time-pack';
import { RatHourMode } from '../enums/rat-hour-mode';

// ============ 天干 ============

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

/** 天干中文名 */
export const tianGanLabels: readonly string[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 获取天干中文名 */
export function getTianGanLabel(gan: TianGan): string {
  return tianGanLabels[gan]!;
}

/** 天干是否为阳 */
export function isTianGanYang(gan: TianGan): boolean {
  return gan % 2 === 0;
}

/** 天干是否为阴 */
export function isTianGanYin(gan: TianGan): boolean {
  return gan % 2 === 1;
}

/** 根据名称/中文查找天干 */
export function tianGanFromName(name: string): TianGan {
  const idx = tianGanLabels.indexOf(name);
  if (idx >= 0) return idx as TianGan;
  const e = Object.entries(TianGan).find(([, v]) => typeof v === 'number' && v.toString() === name);
  if (e) return e[1] as TianGan;
  throw new Error(`Invalid TianGan: ${name}`);
}

// ============ 地支 ============

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

/** 地支中文名 */
export const diZhiLabels: readonly string[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 获取地支中文名 */
export function getDiZhiLabel(zhi: DiZhi): string {
  return diZhiLabels[zhi]!;
}

/** 根据名称/中文查找地支 */
export function diZhiFromName(name: string): DiZhi {
  const idx = diZhiLabels.indexOf(name);
  if (idx >= 0) return idx as DiZhi;
  const e = Object.entries(DiZhi).find(([, v]) => typeof v === 'number' && v.toString() === name);
  if (e) return e[1] as DiZhi;
  throw new Error(`Invalid DiZhi: ${name}`);
}

// ============ 生肖 ============

/** 十二生肖名（按地支顺序） */
export const shengXiaoLabels: readonly string[] = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/** 根据地支配生肖 */
export function diZhiToShengXiao(zhi: DiZhi): string {
  return shengXiaoLabels[zhi]!;
}

// ============ 六十甲子 ============

/** 六十甲子名称表 */
export const jiaZiLabels: readonly string[] = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
  '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
  '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
  '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
  '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
  '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
];

/** 纳音表（按六十甲子顺序） */
const naYinTable: readonly string[] = [
  '海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木', '路旁土', '路旁土', '剑锋金', '剑锋金',
  '山头火', '山头火', '涧下水', '涧下水', '城头土', '城头土', '白蜡金', '白蜡金', '杨柳木', '杨柳木',
  '泉中水', '泉中水', '屋上土', '屋上土', '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
  '沙中金', '沙中金', '山下火', '山下火', '平地木', '平地木', '壁上土', '壁上土', '金箔金', '金箔金',
  '覆灯火', '覆灯火', '天河水', '天河水', '大驿土', '大驿土', '钗钏金', '钗钏金', '桑柘木', '桑柘木',
  '大溪水', '大溪水', '沙中土', '沙中土', '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水',
];

// ============ 干支 Class ============

/** 干支对象（强类型） */
export class GanZhi {
  /** 天干 */
  readonly gan: TianGan;
  /** 地支 */
  readonly zhi: DiZhi;
  /** 六十甲子序号（0-59） */
  readonly index: number;

  constructor(gan: TianGan, zhi: DiZhi) {
    this.gan = gan;
    this.zhi = zhi;
    this.index = ((6 * gan - 5 * zhi) % 60 + 60) % 60;
  }

  /** 根据六十甲子序号构造 */
  static fromIndex(index: number): GanZhi {
    const i = ((index % 60) + 60) % 60;
    return new GanZhi(i % 10, i % 12);
  }

  /** 天干中文名 */
  get ganLabel(): string {
    return tianGanLabels[this.gan]!;
  }

  /** 地支中文名 */
  get zhiLabel(): string {
    return diZhiLabels[this.zhi]!;
  }

  /** 组合名称（如"甲子"） */
  get fullName(): string {
    return `${this.ganLabel}${this.zhiLabel}`;
  }

  /** 纳音（如"海中金"） */
  get naYin(): string {
    return naYinTable[this.index]!;
  }

  /** 纳音五行（如"金"） */
  get naYinWuXing(): string {
    return this.naYin.substring(2);
  }

  /** 天干是否属阳 */
  get isYang(): boolean {
    return this.gan % 2 === 0;
  }

  /** 天干是否属阴 */
  get isYin(): boolean {
    return this.gan % 2 === 1;
  }

  /** 前进/后退 step 个干支（可负数） */
  offset(step: number): GanZhi {
    return GanZhi.fromIndex(this.index + step);
  }

  /** 前进 step 个干支 */
  add(step: number): GanZhi {
    return this.offset(step);
  }

  /** 后退 step 个干支 */
  sub(step: number): GanZhi {
    return this.offset(-step);
  }

  /** 空亡（旬空）地支 */
  getKongWang(): DiZhi[] {
    let k1 = (10 - Math.floor(this.index / 10) * 2) % 12;
    if (k1 < 0) k1 += 12;
    const k2 = (k1 + 1) % 12;
    if (this.isYang) {
      return k1 % 2 === 0 ? [k1, k2] : [k2, k1];
    }
    return k1 % 2 !== 0 ? [k1, k2] : [k2, k1];
  }

  toString(): string {
    return this.fullName;
  }
}

// ============ 八字 Class ============

/** 八字（四柱） */
export class BaZi {
  /** 年柱 */
  readonly year: GanZhi;
  /** 月柱 */
  readonly month: GanZhi;
  /** 日柱 */
  readonly day: GanZhi;
  /** 时柱 */
  readonly hour: GanZhi;

  constructor(year: GanZhi, month: GanZhi, day: GanZhi, hour: GanZhi) {
    this.year = year;
    this.month = month;
    this.day = day;
    this.hour = hour;
  }

  toString(): string {
    return `${this.year} ${this.month} ${this.day} ${this.hour}`;
  }
}

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
 * 获取指定公历日期的日干支（按历法日期，不处理 23:00 换日）。
 * 若需八字规则（23:00 换日），请使用 calcBaZi。
 */
export function dayGanZhi(date: AstroDateTime): GanZhi { throw new Error('TODO'); }

/** 获取指定 J2000 相对儒略日的日干支 */
export function dayGanZhiFromJd(jd: number): GanZhi { throw new Error('TODO'); }

// ============ 时干支 ============

/**
 * 获取指定日天干和时辰索引的时干支
 * @param dayGan 日天干
 * @param hourIndex 时辰索引（0=子时 23-1, 1=丑时 1-3, ...）
 */
export function hourGanZhi(dayGan: TianGan, hourIndex: number): GanZhi { throw new Error('TODO'); }

/**
 * 将时分秒转换为时辰索引（整数运算，避免浮点边界误差）
 *
 * 子时跨两天：23:00:00~23:59:59 和 00:00:00~00:59:59 都归子时。
 * 其余每 2 小时一个时辰。
 *
 * @param hour 小时（0-23）
 * @param minute 分钟（0-59，默认 0）
 * @param second 秒（0-59，默认 0）
 * @returns 时辰索引（0=子, 1=丑, ..., 11=亥）
 */
export function hourToZhiIndex(hour: number, minute: number = 0, second: number = 0): number {
  const totalSeconds = hour * 3600 + minute * 60 + second;

  // 子时：23:00:00 ~ 次日 1:00:00（不含 1:00:00）
  if (totalSeconds >= 23 * 3600 || totalSeconds < 1 * 3600) {
    return 0; // 子
  }

  // 丑(1) ~ 亥(11)：每 2 小时一个时辰
  return Math.floor((totalSeconds - 1 * 3600) / (2 * 3600)) + 1;
}

/**
 * 根据公历日期时间获取时干支（AstroDateTime 精确版）
 * @param date 日期时间（真太阳时）
 * @param ratHourMode 早晚子时处理模式（默认 noSplit）
 */
export function hourGanZhiAt(date: AstroDateTime, ratHourMode?: RatHourMode): GanZhi { throw new Error('TODO'); }

// ============ 八字 ============

/**
 * 计算八字（四柱）—— TimePack 精确版
 *
 * 年柱/月柱由 TimePack.utcTime 对应的节气决定。
 * 日柱/时柱由 TimePack.virtualTime 决定，并遵循 TimePack.ratHourMode 的早晚子时规则。
 *
 * @param timePack 时间封装包（含 UTC、真太阳时、早晚子时配置）
 */
export function calcBaZi(timePack: TimePack): BaZi { throw new Error('TODO'); }

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
