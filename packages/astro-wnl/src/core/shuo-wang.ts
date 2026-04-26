/**
 * 朔望模块 API
 *
 * 底层返回 J2000 相对儒略日（UT，不带时区）。
 * 时区转换由上层（calendar.ts）处理。
 */

import AstroDateTime from '../utils/astro_date_time';
import { searchLunarPhaseSecantWithFallback } from '../ephemeris/adapters/search';
import { Precision } from '../ephemeris/adapters/precision';

// ============ 常量 ============

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;
const SYNODIC_MONTH = 29.5306; // 平均朔望月（天）
const SHUO_OFFSET = 8; // J2000 附近朔约在 jd = -8

// ============ 结果类型 ============

/** 月相计算结果（UT） */
export interface MoonPhaseResult {
  readonly name: string;
  /** J2000 相对儒略日（UT） */
  readonly jd: number;
  /** 对应的历法时间（世界时标尺） */
  readonly dateTime: AstroDateTime;
}

export enum MoonPhase {
  NewMoon = 0,
  FirstQuarter = 1,
  FullMoon = 2,
  LastQuarter = 3,
}

/** 四相名称 */
export const moonPhaseNames4: readonly string[] = ['朔', '上弦', '望', '下弦'];

/** 八相名称（对标 sxwnl_dart，用于展示） */
export const moonPhaseNames8: readonly string[] = [
  '朔', '峨眉月', '上弦', '盈凸月',
  '望', '亏凸月', '下弦', '残月',
];

// ============ 核心月相计算（返回 UT） ============

/**
 * 月相搜索（UT）。
 * w 为目标日月黄经差累计弧度：
 *   0 = 朔, π/2 = 上弦, π = 望, 3π/2 = 下弦, 2π = 下一个朔...
 * 返回 J2000 相对儒略日（UT）。
 */
function _phaseAccurate(w: number, precision: Precision): number {
  const targetPhase = ((w * 180 / Math.PI) % 360 + 360) % 360;
  const n = w / TWO_PI;
  const jdApprox = -SHUO_OFFSET + n * SYNODIC_MONTH;
  return searchLunarPhaseSecantWithFallback(targetPhase, jdApprox, precision);
}

/**
 * 精确月相搜索（UT）。默认 High 精度。
 * w 为日月黄经差累计弧度：0 = 朔, π/2 = 上弦, π = 望, 3π/2 = 下弦, 2π = 下一个朔...
 * 返回 J2000 相对儒略日（UT）。
 */
export function lunarPhase(w: number, precision: Precision = Precision.High): number {
  return _phaseAccurate(w, precision);
}

/**
 * 智能搜索最近朔（UT）。默认 High 精度。
 * 根据给定 jd（UT，J2000 相对），自动寻找最近合朔时刻（UT）。
 */
export function nearestNewMoon(jd: number, precision: Precision = Precision.High): number {
  const n = Math.floor((jd + SHUO_OFFSET) / SYNODIC_MONTH);
  return lunarPhase(n * TWO_PI, precision);
}

/**
 * 智能搜索最近望（UT）。默认 High 精度。
 * 根据给定 jd（UT，J2000 相对），自动寻找最近合望时刻（UT）。
 */
export function nearestFullMoon(jd: number, precision: Precision = Precision.High): number {
  const n = Math.floor((jd + SHUO_OFFSET - SYNODIC_MONTH / 2) / SYNODIC_MONTH);
  return lunarPhase((n + 0.5) * TWO_PI, precision);
}

// ============ 内部 slot 定位引擎 ============
//
// slot 编号：0 = J2000 附近朔, 1 = 上弦, 2 = 望, 3 = 下弦, 4 = 下一个朔...
// 对应 w = slot * (π/2)
// 相邻 slot 间隔约 7.38 天

const _dPhaseSlot = HALF_PI; // π/2 弧度 = 90°

function _phaseAccurateBySlot(slot: number, precision: Precision): number {
  return _phaseAccurate(slot * _dPhaseSlot, precision);
}

function _slotToPhase(slot: number): MoonPhase {
  const mod = ((slot % 4) + 4) % 4;
  return mod as MoonPhase;
}

function _slotToPhaseName(slot: number): string {
  return moonPhaseNames4[_slotToPhase(slot)]!;
}

function _slotToResult(slot: number, precision: Precision): MoonPhaseResult {
  const jd = _phaseAccurateBySlot(slot, precision);
  return {
    name: _slotToPhaseName(slot),
    jd,
    dateTime: AstroDateTime.fromJ2000(jd),
  };
}

/** 获取指定时间的精确当前 phase slot 编号（jd 落在 [slot, slot+1) 区间内） */
function _currentPhaseSlot(jd: number, precision: Precision): number {
  // 1. 粗放估算：每个 slot 约 7.38 天
  let slot = Math.floor((jd + SHUO_OFFSET) / (SYNODIC_MONTH / 4));

  // 2. 闭环校准（误差通常 ±1 个 slot，几乎总是 0-2 次循环）
  const epsilon = 1.0 / 86400; // 1 秒宽容度

  while (true) {
    const current = _phaseAccurateBySlot(slot, precision);
    if (jd < current - epsilon) {
      slot--;
    } else {
      const next = _phaseAccurateBySlot(slot + 1, precision);
      if (jd >= next - epsilon) {
        slot++;
      } else {
        break;
      }
    }
  }

  return slot;
}

/** 向前搜索（含可选过滤） */
function _findPrev(jd: number, precision: Precision, filter?: (phase: MoonPhase) => boolean): MoonPhaseResult {
  let slot = _currentPhaseSlot(jd, precision);
  if (filter) {
    while (!filter(_slotToPhase(slot))) {
      slot--;
    }
  }
  return _slotToResult(slot, precision);
}

/** 向后搜索（含可选过滤） */
function _findNext(jd: number, precision: Precision, filter?: (phase: MoonPhase) => boolean): MoonPhaseResult {
  let slot = _currentPhaseSlot(jd, precision) + 1;
  if (filter) {
    while (!filter(_slotToPhase(slot))) {
      slot++;
    }
  }
  return _slotToResult(slot, precision);
}

// ============ 批量查询（返回 UT，默认 Med 精度） ============

/**
 * 获取指定公历年的所有朔（UT）。默认 Med 精度。
 */
export function yearNewMoons(year: number, precision: Precision = Precision.Medium): MoonPhaseResult[] {
  const startJd = new AstroDateTime(year, 1, 1).toJ2000();
  const endJd = new AstroDateTime(year + 1, 1, 1).toJ2000();

  const results: MoonPhaseResult[] = [];
  // 估算第一个朔的 phase slot，对齐到朔（slot % 4 === 0）
  let slot = Math.floor((startJd + SHUO_OFFSET) / (SYNODIC_MONTH / 4)) - 2;
  while (_slotToPhase(slot) !== MoonPhase.NewMoon) slot++;

  while (true) {
    const jd = _phaseAccurateBySlot(slot, precision);
    if (jd >= endJd) break;
    if (jd >= startJd) {
      results.push(_slotToResult(slot, precision));
    }
    slot += 4; // 直接跳到下一个朔 slot
  }

  return results;
}

/**
 * 获取指定公历年的所有望（UT）。默认 Med 精度。
 */
export function yearFullMoons(year: number, precision: Precision = Precision.Medium): MoonPhaseResult[] {
  const startJd = new AstroDateTime(year, 1, 1).toJ2000();
  const endJd = new AstroDateTime(year + 1, 1, 1).toJ2000();

  const results: MoonPhaseResult[] = [];
  // 估算第一个望的 phase slot，对齐到望（slot % 4 === 2）
  let slot = Math.floor((startJd + SHUO_OFFSET) / (SYNODIC_MONTH / 4)) - 2;
  while (_slotToPhase(slot) !== MoonPhase.FullMoon) slot++;

  while (true) {
    const jd = _phaseAccurateBySlot(slot, precision);
    if (jd >= endJd) break;
    if (jd >= startJd) {
      results.push(_slotToResult(slot, precision));
    }
    slot += 4; // 直接跳到下一个望 slot
  }

  return results;
}

/**
 * 获取指定公历月的所有朔望（UT）。默认 Med 精度。
 */
export function monthPhases(year: number, month: number, precision: Precision = Precision.Medium): MoonPhaseResult[] {
  const startJd = new AstroDateTime(year, month, 1).toJ2000();

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endJd = new AstroDateTime(nextYear, nextMonth, 1).toJ2000();

  const results: MoonPhaseResult[] = [];
  // 往前多查 2 个 slot，防止平均周期估算误差导致遗漏月界附近的相位
  let slot = Math.floor((startJd + SHUO_OFFSET) / (SYNODIC_MONTH / 4)) - 2;

  while (true) {
    const jd = _phaseAccurateBySlot(slot, precision);
    if (jd >= endJd) break;
    if (jd >= startJd) {
      results.push(_slotToResult(slot, precision));
    }
    slot++;
  }

  return results;
}

// ============ 单点查询 API（输入/输出均为 UT，默认 Med 精度） ============

export function prevNewMoon(target: AstroDateTime, precision: Precision = Precision.Medium): MoonPhaseResult {
  return prevNewMoonFromJd(target.toJ2000(), precision);
}
export function prevNewMoonFromJd(jd: number, precision: Precision = Precision.Medium): MoonPhaseResult {
  return _findPrev(jd, precision, (p) => p === MoonPhase.NewMoon);
}
export function nextNewMoon(target: AstroDateTime, precision: Precision = Precision.Medium): MoonPhaseResult {
  return nextNewMoonFromJd(target.toJ2000(), precision);
}
export function nextNewMoonFromJd(jd: number, precision: Precision = Precision.Medium): MoonPhaseResult {
  return _findNext(jd, precision, (p) => p === MoonPhase.NewMoon);
}

export function prevFullMoon(target: AstroDateTime, precision: Precision = Precision.Medium): MoonPhaseResult {
  return prevFullMoonFromJd(target.toJ2000(), precision);
}
export function prevFullMoonFromJd(jd: number, precision: Precision = Precision.Medium): MoonPhaseResult {
  return _findPrev(jd, precision, (p) => p === MoonPhase.FullMoon);
}
export function nextFullMoon(target: AstroDateTime, precision: Precision = Precision.Medium): MoonPhaseResult {
  return nextFullMoonFromJd(target.toJ2000(), precision);
}
export function nextFullMoonFromJd(jd: number, precision: Precision = Precision.Medium): MoonPhaseResult {
  return _findNext(jd, precision, (p) => p === MoonPhase.FullMoon);
}

export function prevPhase(target: AstroDateTime, phase: MoonPhase, precision: Precision = Precision.Medium): MoonPhaseResult {
  return prevPhaseFromJd(target.toJ2000(), phase, precision);
}
export function prevPhaseFromJd(jd: number, phase: MoonPhase, precision: Precision = Precision.Medium): MoonPhaseResult {
  return _findPrev(jd, precision, (p) => p === phase);
}
export function nextPhase(target: AstroDateTime, phase: MoonPhase, precision: Precision = Precision.Medium): MoonPhaseResult {
  return nextPhaseFromJd(target.toJ2000(), phase, precision);
}
export function nextPhaseFromJd(jd: number, phase: MoonPhase, precision: Precision = Precision.Medium): MoonPhaseResult {
  return _findNext(jd, precision, (p) => p === phase);
}
