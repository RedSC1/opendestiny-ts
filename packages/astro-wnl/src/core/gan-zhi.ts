/**
 * 干支计算模块（强类型版）
 *
 * 对标 sxwnl_spa_dart 的 models/gan_zhi.dart + sxwnl/gan_zhi_calc.dart
 * 全部用 enum + class，拒绝字符串裸奔。
 */

import AstroDateTime from '../utils/astro_date_time';
import { TimePack } from '../models/time-pack';
import { RatHourMode } from '../enums/rat-hour-mode';
import { sunEclipticLongitude } from '../ephemeris/adapters/sun';
import { Precision } from '../ephemeris/adapters/precision';
import { deltaTDays } from '../ephemeris/delta-t';

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

/** 根据名称/中文/拼音查找天干（大小写不敏感） */
export function tianGanFromName(name: string): TianGan {
  const idx = tianGanLabels.indexOf(name);
  if (idx >= 0) return idx as TianGan;
  const lower = name.toLowerCase();
  const e = Object.entries(TianGan).find(
    ([k, v]) => typeof v === 'number' && (k.toLowerCase() === lower || v.toString() === name),
  );
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

/** 根据名称/中文/拼音查找地支（大小写不敏感） */
export function diZhiFromName(name: string): DiZhi {
  const idx = diZhiLabels.indexOf(name);
  if (idx >= 0) return idx as DiZhi;
  const lower = name.toLowerCase();
  const e = Object.entries(DiZhi).find(
    ([k, v]) => typeof v === 'number' && (k.toLowerCase() === lower || v.toString() === name),
  );
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

/** 处理环形索引（内部辅助） */
function _cycleIndex(current: number, step: number, mod: number): number {
  return ((current + step) % mod + mod) % mod;
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
    return new GanZhi(i % 10 as TianGan, i % 12 as DiZhi);
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
    const newStemIndex = _cycleIndex(this.gan, step, 10);
    const newBranchIndex = _cycleIndex(this.zhi, step, 12);
    return new GanZhi(newStemIndex as TianGan, newBranchIndex as DiZhi);
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
      return k1 % 2 === 0
        ? [k1 as DiZhi, k2 as DiZhi]
        : [k2 as DiZhi, k1 as DiZhi];
    }
    return k1 % 2 !== 0
      ? [k1 as DiZhi, k2 as DiZhi]
      : [k2 as DiZhi, k1 as DiZhi];
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
  readonly time: GanZhi;

  constructor(year: GanZhi, month: GanZhi, day: GanZhi, time: GanZhi) {
    this.year = year;
    this.month = month;
    this.day = day;
    this.time = time;
  }

  toString(): string {
    return `${this.year} ${this.month} ${this.day} ${this.time}`;
  }
}

// ============ 内部辅助 ============

/** 公历日期 → 正午 J2000 儒略日（取整），作为"日序号" */
function dayId(year: number, month: number, day: number): number {
  return Math.floor(new AstroDateTime(year, month, day, 12, 0, 0).toJ2000());
}

/** 日序号 → 干支 */
function ganZhiFromDayId(D: number): GanZhi {
  const offset = D - 6;
  return new GanZhi(
    (((offset % 10) + 10) % 10) as TianGan,
    (((offset % 12) + 12) % 12) as DiZhi,
  );
}

/**
 * 判断公历日期是否在立春之前（即八字年柱取上一年）
 *
 * @param month 月份（1-12）
 * @param lonDeg 太阳视黄经（度）
 */
function isBeforeLiChun(month: number, lonDeg: number): boolean {
  // 立春发生在太阳黄经 315°，约公历 2 月 3-5 日
  // 正月一定在立春前；二月若黄经 < 315° 则尚未交节
  return month === 1 || (month === 2 && lonDeg < 315);
}

// ============ 年干支 ============

/**
 * 获取指定公历年份的干支
 *
 * 注意：此函数返回的是"大致"年干支（按公历年份），
 * 精确的年干支以立春为界，需通过 calcBaZi 获取。
 */
export function yearGanZhi(year: number): GanZhi {
  return GanZhi.fromIndex(((year - 4) % 60 + 60) % 60);
}

/** 获取指定公历年份的生肖 */
export function yearShengXiao(year: number): string {
  return diZhiToShengXiao(yearGanZhi(year).zhi);
}

// ============ 月干支 ============

/**
 * 获取指定年天干和月地支索引的月干支
 * @param yearGan 年天干
 * @param monthIndex 月地支索引（0=寅月/正月, 1=卯月, ...）
 */
export function monthGanZhi(yearGan: TianGan, monthIndex: number): GanZhi {
  const startGanIdx = ((yearGan % 5) * 2 + 2) % 10;
  return new GanZhi(
    ((startGanIdx + monthIndex) % 10) as TianGan,
    ((monthIndex + 2) % 12) as DiZhi,
  );
}

/**
 * 根据公历日期获取月干支（基于太阳黄经的节气月）
 *
 * 将日期转换为 UT J2000，根据太阳视黄经确定所属的节气月，
 * 再以该日期的年柱推定月干。
 */
export function monthGanZhiAt(date: AstroDateTime): GanZhi {
  const jd = date.toJ2000();
  const ttJd = jd + deltaTDays(jd);
  const lonDeg = sunEclipticLongitude(ttJd, Precision.Low);
  const monthIdx = monthIndexFromLongitude(lonDeg);

  // 年柱：用于推定月干
  const baZiYear = isBeforeLiChun(date.month, lonDeg)
    ? date.year - 1
    : date.year;
  return monthGanZhi(yearGanZhi(baZiYear).gan, monthIdx);
}

// ============ 日干支 ============

/**
 * 获取指定公历日期的日干支（按历法日期，不处理 23:00 换日）。
 * 若需八字规则（23:00 换日），请使用 calcBaZi。
 */
export function dayGanZhi(date: AstroDateTime): GanZhi {
  return ganZhiFromDayId(dayId(date.year, date.month, date.day));
}

/** 获取指定 J2000 相对儒略日的日干支 */
export function dayGanZhiFromJd(jd: number): GanZhi {
  // +0.5 使得正午位于整数，floor 得到日序号
  const D = Math.floor(jd + 0.5);
  return ganZhiFromDayId(D);
}

// ============ 时干支 ============

/**
 * 获取指定日天干和时辰索引的时干支
 * @param dayGan 日天干
 * @param hourIndex 时辰索引（0=子时 23-1, 1=丑时 1-3, ...）
 */
export function hourGanZhi(dayGan: TianGan, hourIndex: number): GanZhi {
  const startGanIdx = (dayGan % 5) * 2;
  return new GanZhi(
    ((startGanIdx + hourIndex) % 10) as TianGan,
    (hourIndex % 12) as DiZhi,
  );
}

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
 *
 * @param date 日期时间（真太阳时）
 * @param ratHourMode 早晚子时处理模式（默认 noSplit）
 *   - noSplit: 23:00 起日柱算次日
 *   - todayGan: 始终用当日日干
 *   - tomorrowGan: 始终用次日日干
 */
export function hourGanZhiAt(date: AstroDateTime, ratHourMode?: RatHourMode): GanZhi {
  const mode = ratHourMode ?? RatHourMode.noSplit;

  // 确定日柱的天干
  let dayGz: GanZhi;
  if (mode === RatHourMode.noSplit && date.hour >= 23) {
    const nextDay = date.add(24 * 3600 * 1000);
    dayGz = dayGanZhi(nextDay);
  } else if (mode === RatHourMode.tomorrowGan) {
    const nextDay = date.add(24 * 3600 * 1000);
    dayGz = dayGanZhi(nextDay);
  } else {
    dayGz = dayGanZhi(date);
  }

  const zhiIdx = hourToZhiIndex(date.hour, date.minute, date.second);
  return hourGanZhi(dayGz.gan, zhiIdx);
}

// ============ 八字 ============

/**
 * 计算八字（四柱）—— TimePack 精确版
 *
 * 年柱/月柱由 TimePack.utcTime 对应的节气决定（基于太阳视黄经）。
 * 日柱/时柱由 TimePack.virtualTime 决定，并遵循 TimePack.ratHourMode 的早晚子时规则。
 *
 * @param timePack 时间封装包（含 UTC、真太阳时、早晚子时配置）
 */
/**
 * 根据太阳视黄经计算节气月索引（0=寅月, 1=卯月, ..., 11=丑月）
 *
 * 八字月份以节（jie）为界，12 个节把黄道均分为 30° 一段，
 * 起点为立春 315°。
 */
function monthIndexFromLongitude(lonDeg: number): number {
  return Math.floor(((lonDeg - 315 + 360) % 360) / 30);
}

export function calcBaZi(timePack: TimePack): BaZi {
  // ---- 年柱 + 月柱：基于 UTC 时间的太阳视黄经 ----
  const utJd = timePack.utcTime.toJ2000();
  const ttJd = utJd + deltaTDays(utJd);
  const lonDeg = sunEclipticLongitude(ttJd, Precision.Low);

  // 年柱：公历年份 ± 立春修正
  // 八字年柱以立春（太阳黄经 315°）为界，与公历 1 月 1 日不同步
  const utYear = timePack.utcTime.year;
  const baZiYear = isBeforeLiChun(timePack.utcTime.month, lonDeg)
    ? utYear - 1
    : utYear;
  const yearPillar = yearGanZhi(baZiYear);

  // 月柱：由太阳黄经确定节气月，再以年干推定月干
  const monthIdx = monthIndexFromLongitude(lonDeg);
  const monthPillar = monthGanZhi(yearPillar.gan, monthIdx);

  // ---- 日柱 + 时柱：基于 virtualTime（整数运算，避免浮点边界） ----
  const vt = timePack.virtualTime;
  const mode = timePack.ratHourMode;

  // 确定日柱用哪个日期（处理 23:00 换日）
  let adjYear = vt.year;
  let adjMonth = vt.month;
  let adjDay = vt.day;

  if (vt.hour >= 23 && mode !== RatHourMode.todayGan) {
    // noSplit / tomorrowGan: 23:00 起日柱算次日
    const nextDay = vt.add(24 * 3600 * 1000);
    adjYear = nextDay.year;
    adjMonth = nextDay.month;
    adjDay = nextDay.day;
  } else if (vt.hour < 23 && mode === RatHourMode.tomorrowGan) {
    const nextDay = vt.add(24 * 3600 * 1000);
    adjYear = nextDay.year;
    adjMonth = nextDay.month;
    adjDay = nextDay.day;
  }

  // 日柱：从调整后日期的正午 JD 计算
  const D = dayId(adjYear, adjMonth, adjDay);
  const dayPillar = ganZhiFromDayId(D);

  // 时柱
  const sc = hourToZhiIndex(vt.hour, vt.minute, vt.second);
  const timePillar = hourGanZhi(dayPillar.gan, sc);

  return new BaZi(yearPillar, monthPillar, dayPillar, timePillar);
}

// ============ 便捷查询 ============

/**
 * 获取指定年份范围内的所有年干支信息
 */
export function getYearRangeGanZhi(
  startYear: number,
  endYear: number,
): { year: number; ganZhi: GanZhi; shengXiao: string }[] {
  const count = endYear - startYear + 1;
  if (count <= 0) return [];
  const result: { year: number; ganZhi: GanZhi; shengXiao: string }[] = [];
  for (let i = 0; i < count; i++) {
    const year = startYear + i;
    const gz = yearGanZhi(year);
    result.push({ year, ganZhi: gz, shengXiao: diZhiToShengXiao(gz.zhi) });
  }
  return result;
}

/**
 * 获取指定年天干的全年 12 个月干支（寅月～丑月）
 */
export function getYearMonthGanZhi(yearGan: TianGan): GanZhi[] {
  return Array.from({ length: 12 }, (_, i) => monthGanZhi(yearGan, i));
}

/**
 * 获取指定日天干的全天 12 个时辰干支（子时～亥时）
 */
export function getDayHourGanZhi(dayGan: TianGan): GanZhi[] {
  return Array.from({ length: 12 }, (_, i) => hourGanZhi(dayGan, i));
}
