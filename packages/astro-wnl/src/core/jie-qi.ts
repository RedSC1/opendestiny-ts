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
export const solarTermNames: readonly string[] = [
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

/** 单个节气的计算结果（UT） */
export interface SolarTermResult {
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
  readonly prev: SolarTermResult;
  readonly next: SolarTermResult;
  readonly daysSincePrev: number;
  readonly daysUntilNext: number;
  readonly totalDays: number;
  readonly progress: number;
}

export interface JieSpan extends SolarTermSpan {
  readonly prevJie: SolarTermResult;
  readonly nextJie: SolarTermResult;
  readonly daysSincePrevJie: number;
  readonly daysUntilNextJie: number;
  readonly totalJieDays: number;
  readonly jieProgress: number;
}

export interface QiSpan extends SolarTermSpan {
  readonly prevQi: SolarTermResult;
  readonly nextQi: SolarTermResult;
  readonly daysSincePrevQi: number;
  readonly daysUntilNextQi: number;
  readonly totalQiDays: number;
  readonly qiProgress: number;
}

export interface SolarTermInfo {
  readonly prevSolarTerm: SolarTermResult;
  readonly nextSolarTerm: SolarTermResult;
  readonly prevJie: SolarTermResult;
  readonly nextJie: SolarTermResult;
  readonly prevQi: SolarTermResult;
  readonly nextQi: SolarTermResult;
  readonly daysSincePrevSolarTerm: number;
  readonly daysUntilNextSolarTerm: number;
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
 * 精确节气搜索（UT）。默认 High 精度。
 * 已知太阳视黄经累计弧度 w，反推精确的交节时刻（UT）。
 * w 是累计值：0=1999年春分, 2π=2000年春分, 依此类推。
 * 采用历元真黄道视黄经（含岁差+章动+光行差）。
 * 返回 J2000 相对儒略日（UT）。
 */
export function solarTerm(w: number, precision: Precision = Precision.High): number {
  const targetLon = ((w * DEG_PER_RAD) % 360 + 360) % 360;

  // 从 w 估算大致 jd：w=0 对应约 -286 天（1999年春分）
  const yearCount = w / TWO_PI;
  const jdApprox = -286.0 + yearCount * 365.2422;

  return searchSolarTermNewtonWithEstimate(targetLon, jdApprox, precision);
}

/**
 * 智能节气搜索（UT）。默认 High 精度。
 * 根据给定的儒略日 jd（UT，J2000 相对），自动寻找并计算最近的一个精确节气时刻（UT）。
 */
export function nearestSolarTerm(jd: number, precision: Precision = Precision.High): number {
  // 用 Low 精度快速估算当前太阳黄经
  const sunLon = sunEclipticLongitude(jd, Precision.Low);

  // 对齐到最近的 15° 整数倍（节气档位）
  const targetLon = ((Math.round(sunLon / 15) * 15) % 360 + 360) % 360;

  return searchSolarTermNewtonWithEstimate(targetLon, jd, precision);
}

/**
 * 获取指定年份的特定节气时刻（单点查询）。默认 High 精度。
 * @param year 公历年份
 * @param n 节气序号（0~23），以春分为 0 起点：
 *   0=春分, 1=清明 ... 18=冬至(当年)
 *   19=小寒, 20=大寒, 21=立春, 22=雨水, 23=惊蛰(次年1~3月)
 * @returns J2000 相对儒略日（UT）
 */
export function specificSolarTerm(year: number, n: number, precision: Precision = Precision.High): number {
  // n 以春分为 0，n >= 19 的节气在次年 1~3 月，天文上属于"上一个天文年"
  const astroYear = n >= 19 ? year - 1 : year;
  const w = (astroYear - 1999) * TWO_PI + n * (Math.PI / 12);
  return solarTerm(w, precision);
}

// ============ 批量查询（返回 UT，默认 Med 精度） ============

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
 * 默认 Med 精度。
 */
export function yearSolarTerms(year: number, precision: Precision = Precision.Medium): SolarTermResult[] {
  const results: SolarTermResult[] = [];

  // 从上年冬至附近开始，用牛顿迭代顺序推进
  let jdApprox = new AstroDateTime(year - 1, 12, 21).toJ2000();

  for (let i = 0; i < 25; i++) {
    const targetLon = _yearTermLons[i]!;
    const result = searchSolarTermNewtonWithEstimate(targetLon, jdApprox, precision);

    const nameIndex = i === 0 ? 23 : i - 1;

    results.push({
      index: nameIndex,
      name: solarTermNames[nameIndex]!,
      jd: result,
      dateTime: AstroDateTime.fromJ2000(result),
    });

    jdApprox = result + 15; // 下一个节气约 15 天后
  }

  return results;
}

/** 获取指定阳历年的所有节气的 Julian Day 数组（UT）。默认 Med 精度。 */
export function yearSolarTermJds(year: number, precision: Precision = Precision.Medium): number[] {
  return yearSolarTerms(year, precision).map((r) => r.jd);
}

// ============ 内部 slot 定位引擎 ============
//
// slot 0 = 1999 年春分, slot 1 = 1999 年清明, ..., slot 24 = 2000 年春分
// 对应黄经弧度 w = slot * (π/12)

const _dSlot = Math.PI / 12;

/** 获取指定时间的精确当前 slot 编号（jd 落在 [slot, slot+1) 区间内） */
function _currentSlot(jd: number, precision: Precision): number {
  // 1. 粗放估算：1999 年春分约在 jd=-286.1
  let slot = Math.floor(((jd + 286.1) / 365.2422) * 24);

  // 2. 闭环校准（误差最多 1-2 个 slot，几乎总是 0-2 次循环）
  const epsilon = 1.0 / 86400; // 1 秒宽容度

  while (true) {
    const currentQi = solarTerm(slot * _dSlot, precision);
    if (jd < currentQi - epsilon) {
      slot--;
    } else {
      const nextQi = solarTerm((slot + 1) * _dSlot, precision);
      if (jd >= nextQi - epsilon) {
        slot++;
      } else {
        break;
      }
    }
  }

  return slot;
}

/** slot → solarTermNames 索引 */
function _slotToIndex(slot: number): number {
  return ((slot % 24) + 5 + 24) % 24;
}

/** slot → SolarTermResult */
function _slotToResult(slot: number, precision: Precision): SolarTermResult {
  const jd = solarTerm(slot * _dSlot, precision);
  const idx = _slotToIndex(slot);
  return {
    index: idx,
    name: solarTermNames[idx]!,
    jd,
    dateTime: AstroDateTime.fromJ2000(jd),
  };
}

/** 向前搜索（含可选过滤） */
function _findPrev(jd: number, precision: Precision, filter?: (index: number) => boolean): SolarTermResult {
  let slot = _currentSlot(jd, precision);
  if (filter) {
    while (!filter(_slotToIndex(slot))) {
      slot--;
    }
  }
  return _slotToResult(slot, precision);
}

/** 向后搜索（含可选过滤） */
function _findNext(jd: number, precision: Precision, filter?: (index: number) => boolean): SolarTermResult {
  let slot = _currentSlot(jd, precision) + 1;
  if (filter) {
    while (!filter(_slotToIndex(slot))) {
      slot++;
    }
  }
  return _slotToResult(slot, precision);
}

// ============ 单点查询 API（输入/输出均为 UT，默认 Med 精度） ============

export function prevSolarTerm(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermResult {
  return prevSolarTermFromJd(target.toJ2000(), precision);
}
export function prevSolarTermFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermResult {
  return _findPrev(jd, precision);
}
export function nextSolarTerm(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermResult {
  return nextSolarTermFromJd(target.toJ2000(), precision);
}
export function nextSolarTermFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermResult {
  return _findNext(jd, precision);
}

export function prevJie(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermResult {
  return prevJieFromJd(target.toJ2000(), precision);
}
export function prevJieFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermResult {
  return _findPrev(jd, precision, isJie);
}
export function nextJie(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermResult {
  return nextJieFromJd(target.toJ2000(), precision);
}
export function nextJieFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermResult {
  return _findNext(jd, precision, isJie);
}

export function prevQi(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermResult {
  return prevQiFromJd(target.toJ2000(), precision);
}
export function prevQiFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermResult {
  return _findPrev(jd, precision, isQi);
}
export function nextQi(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermResult {
  return nextQiFromJd(target.toJ2000(), precision);
}
export function nextQiFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermResult {
  return _findNext(jd, precision, isQi);
}

// ============ 距离查询 API ============

function _getSpan(
  targetJd: number,
  prevGetter: (jd: number) => SolarTermResult,
  nextGetter: (jd: number) => SolarTermResult,
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

export function solarTermSpan(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermSpan {
  return solarTermSpanFromJd(target.toJ2000(), precision);
}
export function solarTermSpanFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermSpan {
  return _getSpan(jd, (j) => prevSolarTermFromJd(j, precision), (j) => nextSolarTermFromJd(j, precision));
}

export function jieSpan(target: AstroDateTime, precision: Precision = Precision.Medium): JieSpan {
  return jieSpanFromJd(target.toJ2000(), precision);
}
export function jieSpanFromJd(jd: number, precision: Precision = Precision.Medium): JieSpan {
  const s = _getSpan(jd, (j) => prevJieFromJd(j, precision), (j) => nextJieFromJd(j, precision));
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

export function qiSpan(target: AstroDateTime, precision: Precision = Precision.Medium): QiSpan {
  return qiSpanFromJd(target.toJ2000(), precision);
}
export function qiSpanFromJd(jd: number, precision: Precision = Precision.Medium): QiSpan {
  const s = _getSpan(jd, (j) => prevQiFromJd(j, precision), (j) => nextQiFromJd(j, precision));
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

export function solarTermInfo(target: AstroDateTime, precision: Precision = Precision.Medium): SolarTermInfo {
  return solarTermInfoFromJd(target.toJ2000(), precision);
}

export function solarTermInfoFromJd(jd: number, precision: Precision = Precision.Medium): SolarTermInfo {
  const prevSolarTerm = prevSolarTermFromJd(jd, precision);
  const nextSolarTerm = nextSolarTermFromJd(jd, precision);
  const prevJie = prevJieFromJd(jd, precision);
  const nextJie = nextJieFromJd(jd, precision);
  const prevQi = prevQiFromJd(jd, precision);
  const nextQi = nextQiFromJd(jd, precision);

  return {
    prevSolarTerm,
    nextSolarTerm,
    prevJie,
    nextJie,
    prevQi,
    nextQi,
    daysSincePrevSolarTerm: jd - prevSolarTerm.jd,
    daysUntilNextSolarTerm: nextSolarTerm.jd - jd,
    daysSincePrevJie: jd - prevJie.jd,
    daysUntilNextJie: nextJie.jd - jd,
    daysSincePrevQi: jd - prevQi.jd,
    daysUntilNextQi: nextQi.jd - jd,
  };
}

// ============ Julian Day 便捷接口（UT） ============

export function prevSolarTermJd(target: AstroDateTime, precision: Precision = Precision.Medium): number {
  return prevSolarTermFromJd(target.toJ2000(), precision).jd;
}
export function nextSolarTermJd(target: AstroDateTime, precision: Precision = Precision.Medium): number {
  return nextSolarTermFromJd(target.toJ2000(), precision).jd;
}
export function prevJieJd(target: AstroDateTime, precision: Precision = Precision.Medium): number {
  return prevJieFromJd(target.toJ2000(), precision).jd;
}
export function nextJieJd(target: AstroDateTime, precision: Precision = Precision.Medium): number {
  return nextJieFromJd(target.toJ2000(), precision).jd;
}
export function prevQiJd(target: AstroDateTime, precision: Precision = Precision.Medium): number {
  return prevQiFromJd(target.toJ2000(), precision).jd;
}
export function nextQiJd(target: AstroDateTime, precision: Precision = Precision.Medium): number {
  return nextQiFromJd(target.toJ2000(), precision).jd;
}
