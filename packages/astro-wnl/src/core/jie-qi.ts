/**
 * 节气模块 API
 *
 * 底层返回 J2000 相对儒略日（UT，不带时区）。
 * 时区转换由上层（calendar.ts）处理。
 */

import AstroDateTime from '../utils/astro_date_time';
import { searchSolarTerm, searchSolarTermNewtonWithEstimate } from '../ephemeris/adapters/search';
import { Precision } from '../ephemeris/adapters/precision';
import { sunEclipticLongitude } from '../ephemeris/adapters/sun';

// ============ 常量 ============

/** 二十四节气名称列表（按阳历年顺序排列） */
export const jieQiNames: readonly string[] = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

/** 判断节气索引是否为"节"（偶数索引） */
export function isJie(index: number): boolean {
  return index % 2 === 0;
}

/** 判断节气索引是否为"气"/中气（奇数索引） */
export function isQi(index: number): boolean {
  return index % 2 === 1;
}

// ============ 结果类型 ============

/** 单个节气的计算结果
 *  jd 为 UT（世界时）J2000 相对儒略日，不含时区偏移。
 */
export interface JieQiResult {
  /** 在当年节气列表中的索引（0-23） */
  readonly index: number;
  /** 节气名称（如"立春"） */
  readonly name: string;
  /** J2000 相对儒略日（UT，世界时） */
  readonly jd: number;
  /** 对应的历法时间（由 jd 解析，仍为世界时标尺） */
  readonly dateTime: AstroDateTime;
}

/** 节气区段距离模型 */
export interface SolarTermSpan {
  readonly prev: JieQiResult;
  readonly next: JieQiResult;
  readonly daysSincePrev: number;
  readonly daysUntilNext: number;
  readonly totalDays: number;
  readonly progress: number;
}

export interface JieDistance extends SolarTermSpan {
  readonly prevJie: JieQiResult;
  readonly nextJie: JieQiResult;
  readonly daysSincePrevJie: number;
  readonly daysUntilNextJie: number;
  readonly totalJieDays: number;
  readonly jieProgress: number;
}

export interface QiDistance extends SolarTermSpan {
  readonly prevQi: JieQiResult;
  readonly nextQi: JieQiResult;
  readonly daysSincePrevQi: number;
  readonly daysUntilNextQi: number;
  readonly totalQiDays: number;
  readonly qiProgress: number;
}

export interface JieQiInfo {
  readonly prevJieQi: JieQiResult;
  readonly nextJieQi: JieQiResult;
  readonly prevJie: JieQiResult;
  readonly nextJie: JieQiResult;
  readonly prevQi: JieQiResult;
  readonly nextQi: JieQiResult;
  readonly daysSincePrevJieQi: number;
  readonly daysUntilNextJieQi: number;
  readonly daysSincePrevJie: number;
  readonly daysUntilNextJie: number;
  readonly daysSincePrevQi: number;
  readonly daysUntilNextQi: number;
}

// ============ 核心定气计算（返回 UT） ============

const PI = Math.PI;
const TWO_PI = 2 * PI;
const DEG_PER_RAD = 180 / PI;

/**
 * 高精度定气（国家标准 GB/T 33661-2017）。
 * 已知太阳视黄经累计弧度 w，反推精确的交节时刻（UT）。
 * w 是累计值：0=1999年春分, 2π=2000年春分, 依此类推。
 * 采用历元真黄道视黄经（含岁差+章动+光行差）。
 * 返回 J2000 相对儒略日（UT）。
 */
export function qiAccurate(w: number): number {
  const targetLon = ((w * DEG_PER_RAD) % 360 + 360) % 360;

  // 从 w 估算大致 jd：w=0 对应约 -286 天（1999年春分）
  const yearCount = w / TWO_PI;
  const jdApprox = -286.0 + yearCount * 365.2422;

  return searchSolarTermNewtonWithEstimate(targetLon, jdApprox);
}

/**
 * 智能定气搜索（国家标准 GB/T 33661-2017）。
 * 根据给定的儒略日 jd（UT，J2000 相对），自动寻找并计算最近的一个精确节气时刻（UT）。
 * 采用历元真黄道视黄经。
 */
export function qiAccurate2(jd: number): number {
  // 用 Low 精度快速估算当前太阳黄经
  const sunLon = sunEclipticLongitude(jd, Precision.Low);

  // 对齐到最近的 15° 整数倍（节气档位）
  const targetLon = ((Math.round(sunLon / 15) * 15) % 360 + 360) % 360;

  return searchSolarTermNewtonWithEstimate(targetLon, jd);
}

/**
 * 获取指定年份的特定节气时刻（单点查询）。
 * @param year 公历年份
 * @param n 节气序号（0~23），以春分为 0 起点：
 *   0=春分, 1=清明 ... 18=冬至(当年)
 *   19=小寒, 20=大寒, 21=立春, 22=雨水, 23=惊蛰(次年1~3月)
 * @returns J2000 相对儒略日（UT）
 */
export function getSpecificJieQi(year: number, n: number): number {
  // n 以春分为 0，n >= 19 的节气在次年 1~3 月，天文上属于"上一个天文年"
  const astroYear = n >= 19 ? year - 1 : year;
  const w = (astroYear - 1999) * TWO_PI + n * (Math.PI / 12);
  return qiAccurate(w);
}

// ============ 批量查询（返回 UT） ============

/** 25 个节气的目标黄经（从上年冬至到当年冬至）：冬至=270°, 小寒=285°, ... */
const _yearTermLons: readonly number[] = [
  270, 285, 300, 315, 330, 345,
  0, 15, 30, 45, 60, 75,
  90, 105, 120, 135, 150, 165,
  180, 195, 210, 225, 240, 255,
  270,
];

/**
 * 获取指定阳历年的所有节气（共25个，从上年冬至到当年冬至），返回 UT。
 */
export function getYearJieQi(year: number): JieQiResult[] {
  const results: JieQiResult[] = [];

  // 从上年冬至附近开始，用牛顿迭代顺序推进
  let jdApprox = new AstroDateTime(year - 1, 12, 21).toJ2000();

  for (let i = 0; i < 25; i++) {
    const targetLon = _yearTermLons[i]!;
    const result = searchSolarTermNewtonWithEstimate(targetLon, jdApprox);

    const nameIndex = i === 0 ? 23 : i - 1;

    results.push({
      index: nameIndex,
      name: jieQiNames[nameIndex]!,
      jd: result,
      dateTime: AstroDateTime.fromJ2000(result),
    });

    jdApprox = result + 15; // 下一个节气约 15 天后
  }

  return results;
}

/** 获取指定阳历年的所有节气的 Julian Day 数组（UT） */
export function getYearJieQiJd(year: number): number[] {
  return getYearJieQi(year).map((r) => r.jd);
}

// ============ 内部 slot 定位引擎 ============
//
// slot 0 = 1999 年春分, slot 1 = 1999 年清明, ..., slot 24 = 2000 年春分
// 对应黄经弧度 w = slot * (π/12)

const _dSlot = Math.PI / 12;

/** 获取指定时间的精确当前 slot 编号（jd 落在 [slot, slot+1) 区间内） */
function _currentSlot(jd: number): number {
  // 1. 粗放估算：1999 年春分约在 jd=-286.1
  let slot = Math.floor(((jd + 286.1) / 365.2422) * 24);

  // 2. 闭环校准（误差最多 1-2 个 slot，几乎总是 0-2 次循环）
  const epsilon = 1.0 / 86400; // 1 秒宽容度

  while (true) {
    const currentQi = qiAccurate(slot * _dSlot);
    if (jd < currentQi - epsilon) {
      slot--;
    } else {
      const nextQi = qiAccurate((slot + 1) * _dSlot);
      if (jd >= nextQi - epsilon) {
        slot++;
      } else {
        break;
      }
    }
  }

  return slot;
}

/** slot → jieQiNames 索引 */
function _slotToIndex(slot: number): number {
  return ((slot % 24) + 5 + 24) % 24;
}

/** slot → JieQiResult */
function _slotToResult(slot: number): JieQiResult {
  const jd = qiAccurate(slot * _dSlot);
  const idx = _slotToIndex(slot);
  return {
    index: idx,
    name: jieQiNames[idx]!,
    jd,
    dateTime: AstroDateTime.fromJ2000(jd),
  };
}

/** 向前搜索（含可选过滤） */
function _findPrev(jd: number, filter?: (index: number) => boolean): JieQiResult {
  let slot = _currentSlot(jd);
  if (filter) {
    while (!filter(_slotToIndex(slot))) {
      slot--;
    }
  }
  return _slotToResult(slot);
}

/** 向后搜索（含可选过滤） */
function _findNext(jd: number, filter?: (index: number) => boolean): JieQiResult {
  let slot = _currentSlot(jd) + 1;
  if (filter) {
    while (!filter(_slotToIndex(slot))) {
      slot++;
    }
  }
  return _slotToResult(slot);
}

// ============ 单点查询 API（输入/输出均为 UT） ============

export function getPrevJieQi(target: AstroDateTime): JieQiResult {
  return getPrevJieQiFromJd(target.toJ2000());
}
export function getPrevJieQiFromJd(jd: number): JieQiResult {
  return _findPrev(jd);
}
export function getNextJieQi(target: AstroDateTime): JieQiResult {
  return getNextJieQiFromJd(target.toJ2000());
}
export function getNextJieQiFromJd(jd: number): JieQiResult {
  return _findNext(jd);
}

export function getPrevJie(target: AstroDateTime): JieQiResult {
  return getPrevJieFromJd(target.toJ2000());
}
export function getPrevJieFromJd(jd: number): JieQiResult {
  return _findPrev(jd, isJie);
}
export function getNextJie(target: AstroDateTime): JieQiResult {
  return getNextJieFromJd(target.toJ2000());
}
export function getNextJieFromJd(jd: number): JieQiResult {
  return _findNext(jd, isJie);
}

export function getPrevQi(target: AstroDateTime): JieQiResult {
  return getPrevQiFromJd(target.toJ2000());
}
export function getPrevQiFromJd(jd: number): JieQiResult {
  return _findPrev(jd, isQi);
}
export function getNextQi(target: AstroDateTime): JieQiResult {
  return getNextQiFromJd(target.toJ2000());
}
export function getNextQiFromJd(jd: number): JieQiResult {
  return _findNext(jd, isQi);
}

// ============ 距离查询 API ============

function _getSpan(
  targetJd: number,
  prevGetter: (jd: number) => JieQiResult,
  nextGetter: (jd: number) => JieQiResult,
): SolarTermSpan {
  const prev = prevGetter(targetJd);
  const next = nextGetter(targetJd);
  const daysSincePrev = targetJd - prev.jd;
  const daysUntilNext = next.jd - targetJd;
  const totalDays = next.jd - prev.jd;
  return {
    prev,
    next,
    daysSincePrev,
    daysUntilNext,
    totalDays,
    get progress() { return daysSincePrev / totalDays; },
  };
}

export function getJieQiDistance(target: AstroDateTime): SolarTermSpan {
  return getJieQiDistanceFromJd(target.toJ2000());
}
export function getJieQiDistanceFromJd(jd: number): SolarTermSpan {
  return _getSpan(jd, getPrevJieQiFromJd, getNextJieQiFromJd);
}

export function getJieDistance(target: AstroDateTime): JieDistance {
  return getJieDistanceFromJd(target.toJ2000());
}
export function getJieDistanceFromJd(jd: number): JieDistance {
  const s = _getSpan(jd, getPrevJieFromJd, getNextJieFromJd);
  return {
    ...s,
    prevJie: s.prev,
    nextJie: s.next,
    daysSincePrevJie: s.daysSincePrev,
    daysUntilNextJie: s.daysUntilNext,
    totalJieDays: s.totalDays,
    get jieProgress() { return s.daysSincePrev / s.totalDays; },
  };
}

export function getQiDistance(target: AstroDateTime): QiDistance {
  return getQiDistanceFromJd(target.toJ2000());
}
export function getQiDistanceFromJd(jd: number): QiDistance {
  const s = _getSpan(jd, getPrevQiFromJd, getNextQiFromJd);
  return {
    ...s,
    prevQi: s.prev,
    nextQi: s.next,
    daysSincePrevQi: s.daysSincePrev,
    daysUntilNextQi: s.daysUntilNext,
    totalQiDays: s.totalDays,
    get qiProgress() { return s.daysSincePrev / s.totalDays; },
  };
}

export function getJieQiInfo(target: AstroDateTime): JieQiInfo {
  return getJieQiInfoFromJd(target.toJ2000());
}

export function getJieQiInfoFromJd(jd: number): JieQiInfo {
  const prevJieQi = getPrevJieQiFromJd(jd);
  const nextJieQi = getNextJieQiFromJd(jd);
  const prevJie = getPrevJieFromJd(jd);
  const nextJie = getNextJieFromJd(jd);
  const prevQi = getPrevQiFromJd(jd);
  const nextQi = getNextQiFromJd(jd);

  return {
    prevJieQi,
    nextJieQi,
    prevJie,
    nextJie,
    prevQi,
    nextQi,
    daysSincePrevJieQi: jd - prevJieQi.jd,
    daysUntilNextJieQi: nextJieQi.jd - jd,
    daysSincePrevJie: jd - prevJie.jd,
    daysUntilNextJie: nextJie.jd - jd,
    daysSincePrevQi: jd - prevQi.jd,
    daysUntilNextQi: nextQi.jd - jd,
  };
}

// ============ Julian Day 便捷接口（UT） ============

export function getPrevJieQiJd(target: AstroDateTime): number {
  return getPrevJieQiFromJd(target.toJ2000()).jd;
}
export function getNextJieQiJd(target: AstroDateTime): number {
  return getNextJieQiFromJd(target.toJ2000()).jd;
}
export function getPrevJieJd(target: AstroDateTime): number {
  return getPrevJieFromJd(target.toJ2000()).jd;
}
export function getNextJieJd(target: AstroDateTime): number {
  return getNextJieFromJd(target.toJ2000()).jd;
}
export function getPrevQiJd(target: AstroDateTime): number {
  return getPrevQiFromJd(target.toJ2000()).jd;
}
export function getNextQiJd(target: AstroDateTime): number {
  return getNextQiFromJd(target.toJ2000()).jd;
}
