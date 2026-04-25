/**
 * 实朔实气计算器（SSQ）
 *
 * 农历排月序核心引擎。
 * 所有内部计算使用 UT（J2000 相对儒略日），不涉及时区。
 * 时区转换由上层（calendar.ts）处理。
 */

// ============ 常量 ============

/** 农历月份名称（0=十一月, 1=十二月, 2=正月...） */
export const lunarMonthNames: readonly string[] = [
  '十一', '十二', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十',
];

// ============ 结果类型 ============

/** SSQ 排月序结果（所有时间为 UT） */
export interface SSQResult {
  /** 中气表（J2000 相对儒略日，UT），包含 25 个中气，从冬至开始 */
  readonly zq: readonly number[];

  /** 合朔表（J2000 相对儒略日，UT），包含 15 个合朔时刻 */
  readonly hs: readonly number[];

  /** 各月天数（29 或 30） */
  readonly dx: readonly number[];

  /** 各月名称（如 "正", "二", "闰四"） */
  readonly ym: readonly string[];

  /** 闰月位置（0 = 无闰月）。leap = i 表示第 i 个月（0-based）是闰月 */
  readonly leap: number;

  /** 农历年干支序号（0-59，用于纪年） */
  readonly yearGanZhiIndex: number;

  /** 该年起始冬至的 J2000 相对儒略日（UT） */
  readonly winterSolstice: number;
}

// ============ 核心计算 ============

/**
 * 农历排月序（生成完整农历年信息）。
 *
 * 有效范围：两个冬至之间（冬至一 <= d < 冬至二）。
 *
 * 核心逻辑：
 * 1. 计算 25 个节气（从冬至开始，UT）
 * 2. 计算 15 个合朔（UT）
 * 3. 判断月大小（相邻朔日之差）
 * 4. 无中气置闰法确定闰月位置
 * 5. 确定月名（建寅为正）
 *
 * @param jd 目标日期附近的 J2000 相对儒略日（UT）
 * @param enableHistoricalRules 是否启用历史特殊规则（还原古历）。默认 false（纯现代天文算法）。
 * @returns SSQResult 包含完整月序信息
 */
export function calcY(jd: number, enableHistoricalRules?: boolean): SSQResult { throw new Error('TODO'); }

/**
 * 获取指定农历年的排月序结果。
 * @param lunarYear 农历年份（以春节为界）
 */
export function calcLunarYear(lunarYear: number): SSQResult { throw new Error('TODO'); }

// ============ 查询接口 ============

/**
 * 根据公历日期查询所在农历月信息。
 * @param jd J2000 相对儒略日（UT）
 */
export function getLunarMonthInfo(jd: number): {
  monthName: string;
  isLeap: boolean;
  monthSize: number;
  monthStart: number;
  monthEnd: number;
} { throw new Error('TODO'); }

/**
 * 根据公历日期查询所在农历日信息。
 * @param jd J2000 相对儒略日（UT）
 */
export function getLunarDayInfo(jd: number): {
  lunarYear: number;
  monthName: string;
  isLeap: boolean;
  day: number;
  monthSize: number;
} { throw new Error('TODO'); }

export function getMonthSize(lunarYear: number, monthName: string): number | null { throw new Error('TODO'); }
export function getLeapMonth(lunarYear: number): string | null { throw new Error('TODO'); }
