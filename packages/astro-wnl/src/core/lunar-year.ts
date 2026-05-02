/**
 * 农历年排月引擎
 *
 * 移植自 sxwnl JS 原版 src/lunar.js 的 SSQ.calcY 方法。
 * 核心排月序逻辑完全保留，仅替换底层天文 API 和命名。
 *
 * 关键适配：
 * - sxwnl 的 calc(jd, '气') → searchSolarTermNewtonWithEstimate
 * - sxwnl 的 calc(jd, '朔') → nearestNewMoon
 * - sxwnl 返回北京时间（已 +8/24），本模块用 _toLocal(longitude) 转当地时后
 *   后续逻辑与原版完全一致
 * - 历史历法修正单独处理，本模块为纯现代天文算法
 */

import { searchSolarTermNewtonWithEstimate } from '../ephemeris/adapters/search';
import { nearestNewMoon } from './shuo-wang';
import { Precision } from '../ephemeris/adapters/precision';
import AstroDateTime from '../utils/astro_date_time';

// ============ 常量（与 sxwnl 一致） ============

/** 农历月份名称（0=十一月, 1=十二月, 2=正月...） */
const _monthNames: readonly string[] = [
  '十一', '十二', '正', '二', '三', '四',
  '五', '六', '七', '八', '九', '十',
];

/** 二十四节气黄经（从冬至开始，含首尾两个冬至，共 25 个） */
const _termLongitudes: readonly number[] = [
  270, 285, 300, 315, 330, 345,
  0, 15, 30, 45, 60, 75,
  90, 105, 120, 135, 150, 165,
  180, 195, 210, 225, 240, 255,
  270,
];

/** 回归年长度（天） */
const _TROPICAL_YEAR = 365.2422;

/** 朔望月平均长度（天） */
const _SYNODIC_MONTH = 29.5306;

/** J2000 附近冬至的近似位置（J2000 相对儒略日） */
const _WINTER_SOLSTICE_J2000 = 355;

/** 节气平均间隔（天） */
const _TERM_INTERVAL = 15.2184;

// ============ 类型 ============

/** 农历年排月结果 */
export interface LunarYear {
  /** 25 个节气时刻（当地时，J2000 相对儒略日） */
  readonly solarTerms: readonly number[];

  /** 15 个朔时刻（当地时，J2000 相对儒略日） */
  readonly newMoons: readonly number[];

  /** 各月天数（29 或 30） */
  readonly monthLengths: readonly number[];

  /** 月名（如 "正", "二", "闰四"） */
  readonly monthNames: readonly string[];

  /** 闰月位置（0-based），-1 表示无闰月 */
  readonly leapMonthIndex: number;

  /** 年干支序号（0-59，甲子=0） */
  readonly yearGanZhi: number;

  /** 该年起始冬至（当地时） */
  readonly winterSolstice: number;
}

// ============ 内部辅助（与 sxwnl JS 原版的 int2 等效） ============

/** 取整（向负无穷，与 sxwnl JS 原版的 Math.floor 一致） */
function _int2(v: number): number {
  return Math.floor(v);
}

/** UT 儒略日 → 当地平时 */
function _toLocal(utJd: number, longitude: number): number {
  return utJd + longitude / 15 / 24;
}

/** 当地平时 → 当地日期编号（与 sxwnl JS 原版的 int2(x + 0.5) 等效） */
function _toLocalDay(localJd: number): number {
  return _int2(localJd + 0.5);
}

/** 年干支序号（0-59），以冬至所在公历年估算 */
function _yearGanZhi(winterSolsticeLocal: number): number {
  const dt = AstroDateTime.fromJ2000(winterSolsticeLocal);
  const year = dt.year;
  return ((year - 1984) % 60 + 60) % 60;
}

// ============ 核心函数（移植自 sxwnl calcY） ============

/**
 * 排月序：计算给定日期所在农历年（冬至到冬至）的完整月序。
 *
 * @param jd 目标日期（J2000 相对儒略日，UT）
 * @param longitude 经度（度，东经为正），默认 120（北京时间）
 * @returns LunarYear 包含完整月序信息
 */
export function arrangeLunarYear(jd: number, longitude: number = 120): LunarYear {
  const solarTerms: number[] = new Array(25);   // 当地时
  const newMoons: number[] = new Array(15);     // 当地时
  const monthLengths: number[] = new Array(14);
  const monthNames: string[] = new Array(14);
  let leapMonthIndex = -1;

  // ---- 步骤 1：确定年份和冬至 ----
  // 估算冬至位置（UT 估算）
  let w =
    _int2((jd - _WINTER_SOLSTICE_J2000 + 183) / _TROPICAL_YEAR) *
      _TROPICAL_YEAR +
    _WINTER_SOLSTICE_J2000;

  // 精确搜索冬至（UT），然后转当地时
  let winterSolsticeUT = searchSolarTermNewtonWithEstimate(270, w, Precision.High);
  let winterSolstice = _toLocal(winterSolsticeUT, longitude);

  // 如果冬至在当地日期上晚于目标日期，往前推一年
  if (winterSolstice > _toLocal(jd, longitude)) {
    w -= _TROPICAL_YEAR;
    winterSolsticeUT = searchSolarTermNewtonWithEstimate(270, w, Precision.High);
    winterSolstice = _toLocal(winterSolsticeUT, longitude);
  }

  // ---- 步骤 2：计算 25 个节气（从冬至开始） ----
  // 与 sxwnl 一致：w + 15.2184 * i 估算，然后精确搜索（UT），结果转当地时
  const solarTermsUT: number[] = [];
  let jdApprox = w;
  for (let i = 0; i < 25; i++) {
    const termUT = searchSolarTermNewtonWithEstimate(
      _termLongitudes[i]!,
      jdApprox,
      Precision.High,
    );
    solarTermsUT.push(termUT);
    solarTerms[i] = _toLocal(termUT, longitude);
    jdApprox = termUT + 15; // 下一个节气约 15 天后（UT）
  }

  // ---- 步骤 3：计算"首朔" ----
  // 求较靠近冬至的朔日（UT 搜索，转当地时）
  let firstNewMoonUT = nearestNewMoon(solarTermsUT[0]!, Precision.High);
  let firstNewMoon = _toLocal(firstNewMoonUT, longitude);

  if (firstNewMoon > solarTerms[0]!) {
    firstNewMoonUT = nearestNewMoon(solarTermsUT[0]! - 29.53, Precision.High);
    firstNewMoon = _toLocal(firstNewMoonUT, longitude);
  }

  // ---- 步骤 4：计算该年所有朔（15个） ----
  const newMoonsUT: number[] = [];
  for (let i = 0; i < 15; i++) {
    const nmUT = nearestNewMoon(
      firstNewMoonUT + _SYNODIC_MONTH * i,
      Precision.High,
    );
    newMoonsUT.push(nmUT);
    newMoons[i] = _toLocal(nmUT, longitude);
  }

  // ---- 步骤 5：计算月大小 ----
  // sxwnl: dx[i] = (hs[i + 1] - hs[i]).toInt();
  // hs 已经是取整到日期（calc 返回 int2(... + 0.5)），直接差就是天数
  for (let i = 0; i < 14; i++) {
    monthLengths[i] = _toLocalDay(newMoons[i + 1]!) - _toLocalDay(newMoons[i]!);
  }

  // ---- 步骤 6：历史历法（单独处理，跳过） ----

  // ---- 步骤 7：无中气置闰法 ----
  // 临时月序初始化
  const monthIndices = new Array(14).fill(0).map((_, i) => i);

  // 第 13 月的月末没有超过下一个冬至，说明今年有 13 个月
  if (_toLocalDay(newMoons[13]!) <= _toLocalDay(solarTerms[24]!)) {
    let i: number;
    // 找第一个不含中气的月（从第 1 个月开始，第 0 个月必含冬至）
    for (i = 1; i < 13 && _toLocalDay(newMoons[i + 1]!) > _toLocalDay(solarTerms[2 * i]!); i++) {
      // 空循环体，条件即逻辑
    }
    leapMonthIndex = i;
    // 闰月之后的月序减一
    for (; i < 14; i++) {
      monthIndices[i]!--;
    }
  }

  // ---- 步骤 8：月名转换与月建处理 ----
  for (let i = 0; i < 14; i++) {
    const nameIndex = ((monthIndices[i]! % 12) + 12) % 12;
    let name = _monthNames[nameIndex]!;
    if (i === leapMonthIndex) {
      name = `闰${name}`;
    }
    monthNames[i] = name;
  }

  // ---- 步骤 9：年干支 ----
  const yearGanZhi = _yearGanZhi(winterSolstice);

  return {
    solarTerms,
    newMoons,
    monthLengths,
    monthNames,
    leapMonthIndex,
    yearGanZhi,
    winterSolstice,
  };
}

// ============ 便捷查询（基于 arrangeLunarYear） ============

/**
 * 获取指定公历日期所在的农历月信息。
 *
 * @param jd 公历日期（J2000 相对儒略日，UT）
 * @param longitude 经度（度），默认 120
 */
export function getLunarMonthAt(
  jd: number,
  longitude: number = 120,
): {
  monthName: string;
  isLeap: boolean;
  monthLength: number;
  monthStart: number;
  monthEnd: number;
} {
  const year = arrangeLunarYear(jd, longitude);
  const localDay = _toLocalDay(_toLocal(jd, longitude));

  for (let i = 0; i < 14; i++) {
    const start = _toLocalDay(year.newMoons[i]!);
    const end = _toLocalDay(year.newMoons[i + 1]!);

    if (localDay >= start && localDay < end) {
      return {
        monthName: year.monthNames[i]!,
        isLeap: i === year.leapMonthIndex,
        monthLength: year.monthLengths[i]!,
        monthStart: start,
        monthEnd: end,
      };
    }
  }

  throw new Error(`Date ${jd} not found in lunar year`);
}

/**
 * 获取指定公历日期所在的农历日信息。
 *
 * @param jd 公历日期（J2000 相对儒略日，UT）
 * @param longitude 经度（度），默认 120
 */
export function getLunarDayAt(
  jd: number,
  longitude: number = 120,
): {
  lunarYear: number;
  monthName: string;
  isLeap: boolean;
  day: number;
  monthLength: number;
} {
  const year = arrangeLunarYear(jd, longitude);
  const localDay = _toLocalDay(_toLocal(jd, longitude));

  for (let i = 0; i < 14; i++) {
    const start = _toLocalDay(year.newMoons[i]!);
    const end = _toLocalDay(year.newMoons[i + 1]!);

    if (localDay >= start && localDay < end) {
      return {
        lunarYear: year.yearGanZhi,
        monthName: year.monthNames[i]!,
        isLeap: i === year.leapMonthIndex,
        day: localDay - start + 1,
        monthLength: year.monthLengths[i]!,
      };
    }
  }

  throw new Error(`Date ${jd} not found in lunar year`);
}

/**
 * 获取指定农历年的闰月。
 *
 * @param lunarYear 农历年干支序号（0-59）
 * @param longitude 经度（度），默认 120
 * @returns 闰月名称（如 "闰四"），无闰月返回 null
 */
export function getLeapMonth(
  lunarYear: number,
  longitude: number = 120,
): string | null {
  const approxYear = lunarYear + 1984;
  const jd = new AstroDateTime(approxYear, 6, 1).toJ2000();
  const year = arrangeLunarYear(jd, longitude);

  if (year.yearGanZhi !== lunarYear) {
    const jd2 = new AstroDateTime(approxYear + 1, 6, 1).toJ2000();
    const year2 = arrangeLunarYear(jd2, longitude);
    if (year2.yearGanZhi === lunarYear && year2.leapMonthIndex >= 0) {
      return year2.monthNames[year2.leapMonthIndex]!;
    }
    const jd3 = new AstroDateTime(approxYear - 1, 6, 1).toJ2000();
    const year3 = arrangeLunarYear(jd3, longitude);
    if (year3.yearGanZhi === lunarYear && year3.leapMonthIndex >= 0) {
      return year3.monthNames[year3.leapMonthIndex]!;
    }
    return null;
  }

  return year.leapMonthIndex >= 0 ? year.monthNames[year.leapMonthIndex]! : null;
}
