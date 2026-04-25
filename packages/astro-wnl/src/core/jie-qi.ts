/**
 * 节气模块 API
 *
 * 底层返回 J2000 相对儒略日（UT，不带时区）。
 * 时区转换由上层（calendar.ts）处理。
 */

import AstroDateTime from '../utils/astro_date_time';

// ============ 常量 ============

/** 二十四节气名称列表（按阳历年顺序排列） */
export const jieQiNames: readonly string[] = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

/** 判断节气索引是否为"节"（偶数索引） */
export function isJie(index: number): boolean { throw new Error('TODO'); }

/** 判断节气索引是否为"气"/中气（奇数索引） */
export function isQi(index: number): boolean { throw new Error('TODO'); }

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

/**
 * 高精度定气。
 * 已知太阳视黄经累计弧度 w，反推精确的交节时刻（UT）。
 * w 是累计值：0=1999年春分, 2π=2000年春分, 依此类推。
 * 返回 J2000 相对儒略日（UT）。
 */
export function qiAccurate(w: number): number { throw new Error('TODO'); }

/**
 * 智能定气搜索。
 * 根据给定的儒略日 jd（UT，J2000 相对），自动寻找并计算最近的一个精确节气时刻（UT）。
 */
export function qiAccurate2(jd: number): number { throw new Error('TODO'); }

/**
 * 获取指定年份的特定节气时刻（单点查询）。
 * @param year 公历年份
 * @param n 节气序号（0~23），以春分为 0 起点：
 *   0=春分, 1=清明 ... 18=冬至(当年)
 *   19=小寒, 20=大寒, 21=立春, 22=雨水, 23=惊蛰(次年1~3月)
 * @returns J2000 相对儒略日（UT）
 */
export function getSpecificJieQi(year: number, n: number): number { throw new Error('TODO'); }

// ============ 批量查询（返回 UT） ============

/** 获取指定阳历年的所有节气（共25个，从冬至到冬至），返回 UT */
export function getYearJieQi(year: number): JieQiResult[] { throw new Error('TODO'); }

/** 获取指定阳历年的所有节气的 Julian Day 数组（UT） */
export function getYearJieQiJd(year: number): number[] { throw new Error('TODO'); }

// ============ 单点查询 API（输入/输出均为 UT） ============

export function getPrevJieQi(target: AstroDateTime): JieQiResult | null { throw new Error('TODO'); }
export function getPrevJieQiFromJd(jd: number): JieQiResult | null { throw new Error('TODO'); }
export function getNextJieQi(target: AstroDateTime): JieQiResult | null { throw new Error('TODO'); }
export function getNextJieQiFromJd(jd: number): JieQiResult | null { throw new Error('TODO'); }

export function getPrevJie(target: AstroDateTime): JieQiResult | null { throw new Error('TODO'); }
export function getPrevJieFromJd(jd: number): JieQiResult | null { throw new Error('TODO'); }
export function getNextJie(target: AstroDateTime): JieQiResult | null { throw new Error('TODO'); }
export function getNextJieFromJd(jd: number): JieQiResult | null { throw new Error('TODO'); }

export function getPrevQi(target: AstroDateTime): JieQiResult | null { throw new Error('TODO'); }
export function getPrevQiFromJd(jd: number): JieQiResult | null { throw new Error('TODO'); }
export function getNextQi(target: AstroDateTime): JieQiResult | null { throw new Error('TODO'); }
export function getNextQiFromJd(jd: number): JieQiResult | null { throw new Error('TODO'); }

// ============ 距离查询 API ============

export function getJieQiDistance(target: AstroDateTime): JieDistance | null { throw new Error('TODO'); }
export function getJieQiDistanceFromJd(jd: number): JieDistance | null { throw new Error('TODO'); }
export function getJieDistance(target: AstroDateTime): JieDistance | null { throw new Error('TODO'); }
export function getJieDistanceFromJd(jd: number): JieDistance | null { throw new Error('TODO'); }
export function getQiDistance(target: AstroDateTime): QiDistance | null { throw new Error('TODO'); }
export function getQiDistanceFromJd(jd: number): QiDistance | null { throw new Error('TODO'); }
export function getJieQiInfo(target: AstroDateTime): JieQiInfo | null { throw new Error('TODO'); }

// ============ Julian Day 便捷接口（UT） ============

export function getPrevJieQiJd(target: AstroDateTime): number | null { throw new Error('TODO'); }
export function getNextJieQiJd(target: AstroDateTime): number | null { throw new Error('TODO'); }
export function getPrevJieJd(target: AstroDateTime): number | null { throw new Error('TODO'); }
export function getNextJieJd(target: AstroDateTime): number | null { throw new Error('TODO'); }
export function getPrevQiJd(target: AstroDateTime): number | null { throw new Error('TODO'); }
export function getNextQiJd(target: AstroDateTime): number | null { throw new Error('TODO'); }
