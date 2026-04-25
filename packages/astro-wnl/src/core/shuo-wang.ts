/**
 * 朔望模块 API
 *
 * 底层返回 J2000 相对儒略日（UT，不带时区）。
 * 时区转换由上层（calendar.ts）处理。
 */

import AstroDateTime from '../utils/astro_date_time';

// ============ 结果类型 ============

/** 朔望计算结果（UT） */
export interface ShuoWangResult {
  readonly name: string;
  /** J2000 相对儒略日（UT） */
  readonly jd: number;
  /** 对应的历法时间（世界时标尺） */
  readonly dateTime: AstroDateTime;
}

export enum MoonPhase {
  Shuo = 0,
  ShangXian = 1,
  Wang = 2,
  XiaXian = 3,
}

export const moonPhaseNames: readonly string[] = ['朔', '上弦', '望', '下弦'];

// ============ 核心定朔/定望计算（返回 UT） ============

/**
 * 高精度定朔（UT）。
 * w 为日月黄经差累计弧度：0=J2000 附近朔, 2π=下一个月朔。
 * 返回 J2000 相对儒略日（UT）。
 */
export function soAccurate(w: number): number { throw new Error('TODO'); }

/**
 * 智能定朔搜索（UT）。
 * 根据给定 jd（UT，J2000 相对），自动寻找最近合朔时刻（UT）。
 */
export function soAccurate2(jd: number): number { throw new Error('TODO'); }

/**
 * 高精度定望（UT）。
 */
export function wangAccurate(w: number): number { throw new Error('TODO'); }

/**
 * 智能定望搜索（UT）。
 */
export function wangAccurate2(jd: number): number { throw new Error('TODO'); }

// ============ 批量查询（返回 UT） ============

export function getYearShuo(year: number): ShuoWangResult[] { throw new Error('TODO'); }
export function getYearWang(year: number): ShuoWangResult[] { throw new Error('TODO'); }
export function getMonthShuoWang(year: number, month: number): ShuoWangResult[] { throw new Error('TODO'); }

// ============ 单点查询 API（输入/输出均为 UT） ============

export function getPrevShuo(target: AstroDateTime): ShuoWangResult | null { throw new Error('TODO'); }
export function getPrevShuoFromJd(jd: number): ShuoWangResult | null { throw new Error('TODO'); }
export function getNextShuo(target: AstroDateTime): ShuoWangResult | null { throw new Error('TODO'); }
export function getNextShuoFromJd(jd: number): ShuoWangResult | null { throw new Error('TODO'); }

export function getPrevWang(target: AstroDateTime): ShuoWangResult | null { throw new Error('TODO'); }
export function getPrevWangFromJd(jd: number): ShuoWangResult | null { throw new Error('TODO'); }
export function getNextWang(target: AstroDateTime): ShuoWangResult | null { throw new Error('TODO'); }
export function getNextWangFromJd(jd: number): ShuoWangResult | null { throw new Error('TODO'); }

export function getPrevPhase(target: AstroDateTime, phase: MoonPhase): ShuoWangResult | null { throw new Error('TODO'); }
export function getNextPhase(target: AstroDateTime, phase: MoonPhase): ShuoWangResult | null { throw new Error('TODO'); }
