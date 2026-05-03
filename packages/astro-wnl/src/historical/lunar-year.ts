/**
 * 历史农历年排月引擎
 *
 * 基于历史修正表（getChineseHistoricalSolarTerm / getChineseHistoricalMonth）
 * 还原古代真实历法，完整对标 Dart SSQ.calcY()。
 *
 * 算法步骤（与 sxwnl 一致）：
 * 1. 确定冬至年
 * 2. 计算 25 个节气（历史修正表）
 * 3. 计算首朔
 * 4. 计算 15 个朔日（历史修正表）
 * 5. 计算月大小
 * 6. 古代历法建正（-721 ~ -104 BC）：春秋建丑/战国建丑/秦汉建亥
 * 7. 无中气置闰
 * 8. 月名转换 + 改历窗口修正（新莽/魏明帝/武则天/武则天周历）
 *
 * 有效范围：
 * - 朔日修正：~722 BC ~ 1960 AD（FIRST_SUO_JD = -993847，33173 条）
 * - 远古节气（平气）：-221 BC ~ 1645 AD（FIRST_QI_JD = -810895，44781 条）
 * - 近代节气（定气）：1646 ~ 1960 AD（FIRST_QI_JD = -129395，7567 条）
 * - 超出范围时对应函数自动 fallback 到低精度搜索
 *
 * 时区说明：
 * 历史修正表数据从 sxwnl 导出，sxwnl 内部使用北京时间（东经 120°）。
 * 因此本模块内部统一使用北京时间运算，返回的 HistoricalLunarYear 时间字段也为北京时间日期编号（已取整）。
 * 参数 jd 为 UT，内部会先 +8/24 转为北京时间。
 */

import { getChineseHistoricalSolarTerm, getChineseHistoricalMonth } from './chinese-historical';
import AstroDateTime from '../utils/astro_date_time';

// ============ 常量（与 core/lunar-year.ts 一致） ============

/** J2000.0 对应的绝对儒略日 */
const J2000 = 2451545;

const _monthNames: readonly string[] = [
  '十一', '十二', '正', '二', '三', '四',
  '五', '六', '七', '八', '九', '十',
];

const _termLongitudes: readonly number[] = [
  270, 285, 300, 315, 330, 345,
  0, 15, 30, 45, 60, 75,
  90, 105, 120, 135, 150, 165,
  180, 195, 210, 225, 240, 255,
  270,
];

const _TROPICAL_YEAR = 365.2422;
const _SYNODIC_MONTH = 29.5306;

/** J2000 附近冬至的近似位置（北京时间） */
const _WINTER_SOLSTICE_BJT = 355.33;

// ============ 类型 ============

/** 历史农历年排月结果（时间字段均为北京时间日期编号） */
export interface HistoricalLunarYear {
  /** 该年对应的公历年份 */
  readonly year: number;

  /** 25 个节气日期编号（北京时间，已取整） */
  readonly solarTerms: readonly number[];

  /** 15 个朔日日期编号（北京时间，已取整） */
  readonly newMoons: readonly number[];

  /** 各月天数（29 或 30） */
  readonly monthLengths: readonly number[];

  /** 月名（如 "正", "二", "闰四"） */
  readonly monthNames: readonly string[];

  /** 闰月位置（0-based），-1 表示无闰月 */
  readonly leapMonthIndex: number;

  /** 该年起始冬至日期编号（北京时间，已取整） */
  readonly winterSolstice: number;
}

// ============ 内部辅助 ============

/** 取整（向负无穷） */
function _int2(v: number): number {
  return Math.floor(v);
}

/** UT → 北京时间 */
function _toBjt(utJd: number): number {
  return utJd + 8 / 24;
}

// ============ 核心函数 ============

/**
 * 历史排月序：基于历史修正表计算给定日期所在农历年（冬至到冬至）的完整月序。
 *
 * @param jd 目标日期（J2000 相对儒略日，UT）
 * @returns HistoricalLunarYear，时间字段为北京时间日期编号（已取整）
 */
export function arrangeHistoricalLunarYear(jd: number): HistoricalLunarYear {
  const bjt = _toBjt(jd);

  const solarTerms: number[] = new Array(25);
  const newMoons: number[] = new Array(15);
  const monthLengths: number[] = new Array(14);
  const monthNames: string[] = new Array(14);
  let leapMonthIndex = -1;

  // ---- 步骤 1：确定年份和冬至（北京时间） ----
  let w =
    _int2((bjt - _WINTER_SOLSTICE_BJT + 183) / _TROPICAL_YEAR) *
      _TROPICAL_YEAR +
    _WINTER_SOLSTICE_BJT;

  let winterSolstice = _int2(getChineseHistoricalSolarTerm(270, w) + 0.5);
  if (winterSolstice > bjt) {
    w -= _TROPICAL_YEAR;
    winterSolstice = _int2(getChineseHistoricalSolarTerm(270, w) + 0.5);
  }

  // 该年对应的公历年份（节气年大部分落在哪个公历年）
  const ws = AstroDateTime.fromJ2000(winterSolstice);
  const year = ws.month <= 6 ? ws.year : ws.year + 1;

  // ---- 步骤 2：计算 25 个节气（从冬至开始，北京时间，取整） ----
  let jdApprox = w;
  for (let i = 0; i < 25; i++) {
    const term = getChineseHistoricalSolarTerm(_termLongitudes[i]!, jdApprox);
    solarTerms[i] = _int2(term + 0.5);
    jdApprox = term + 15;
  }

  // ---- 步骤 3：计算"首朔"（北京时间，取整） ----
  let firstNewMoon = getChineseHistoricalMonth(solarTerms[0]!);
  if (_int2(firstNewMoon + 0.5) > solarTerms[0]!) {
    firstNewMoon = getChineseHistoricalMonth(solarTerms[0]! - 20);
  }

  // ---- 步骤 4：计算该年所有朔（15个，北京时间，取整） ----
  for (let i = 0; i < 15; i++) {
    newMoons[i] = _int2(getChineseHistoricalMonth(firstNewMoon + i * _SYNODIC_MONTH) + 0.5);
  }

  // ---- 步骤 5：计算月大小 ----
  for (let i = 0; i < 14; i++) {
    monthLengths[i] = newMoons[i + 1]! - newMoons[i]!;
  }

  // ---- 步骤 6：古代历法建正（-721 ~ -104 BC） ----
  // 对标 Dart SSQ.calcY() 的 ns[] 逻辑。
  // 春秋建丑/战国建丑/秦汉建亥，不以正月为年首，闰月叫"十三"或"后九"。
  const yy = _int2((solarTerms[0]! + 10 + 180) / _TROPICAL_YEAR) + 2000;
  if (yy >= -721 && yy <= -104) {
    const ns: number[] = new Array(3);
    const nsName: string[] = new Array(3);
    const nsMonth: number[] = new Array(3);

    for (let k = 0; k < 3; k++) {
      const y = yy + k - 1;
      if (y >= -721) {
        // 春秋：建丑，闰月名"十三"
        ns[k] = _int2(
          getChineseHistoricalMonth(
            1457698 - J2000 + _int2(0.342 + (y + 721) * 12.368422) * _SYNODIC_MONTH,
          ) + 0.5,
        );
        nsName[k] = '十三';
        nsMonth[k] = 2; // 建丑
      }
      if (y >= -479) {
        // 战国：建丑，闰月名"十三"
        ns[k] = _int2(
          getChineseHistoricalMonth(
            1546083 - J2000 + _int2(0.500 + (y + 479) * 12.368422) * _SYNODIC_MONTH,
          ) + 0.5,
        );
        nsName[k] = '十三';
        nsMonth[k] = 2; // 建丑
      }
      if (y >= -220) {
        // 秦汉：建亥，闰月名"后九"
        ns[k] = _int2(
          getChineseHistoricalMonth(
            1640641 - J2000 + _int2(0.866 + (y + 220) * 12.369000) * _SYNODIC_MONTH,
          ) + 0.5,
        );
        nsName[k] = '后九';
        nsMonth[k] = 11; // 建亥
      }
    }

    // 按月排名称：找到所属年份 → 计算积月数 → 映射月名
    for (let i = 0; i < 14; i++) {
      let nn = 2;
      for (; nn >= 0; nn--) {
        if (newMoons[i]! >= ns[nn]!) break;
      }
      if (nn < 0) nn = 0;

      const f1 = _int2((newMoons[i]! - ns[nn]! + 15) / _SYNODIC_MONTH);
      if (f1 < 12) {
        monthNames[i] = _monthNames[(f1 + nsMonth[nn]!) % 12]!;
      } else {
        monthNames[i] = nsName[nn]!;
      }
    }

    return {
      year,
      solarTerms,
      newMoons,
      monthLengths,
      monthNames,
      leapMonthIndex: -1, // 古代历法不计算闰月
      winterSolstice,
    };
  }

  // ---- 步骤 7：无中气置闰法 ----
  const monthIndices = new Array(14).fill(0).map((_, i) => i);

  if (newMoons[13]! <= solarTerms[24]!) {
    let i: number;
    for (i = 1; i < 13 && newMoons[i + 1]! > solarTerms[2 * i]!; i++) {
      // 空循环体，条件即逻辑
    }
    leapMonthIndex = i;
    for (; i < 14; i++) {
      monthIndices[i]!--;
    }
  }

  // ---- 步骤 8：月名转换与改历窗口修正 ----
  for (let i = 0; i < 14; i++) {
    const v2 = monthIndices[i]!;
    const dm = newMoons[i]! + J2000; // 绝对儒略日，用于改历窗口判断

    let nameIndex = ((v2 % 12) + 12) % 12;
    let name = _monthNames[nameIndex]!;

    // 新莽：月建 +1（建丑→建寅）
    if (dm >= 1724360 && dm <= 1729794) {
      nameIndex = ((v2 + 1) % 12 + 12) % 12;
      name = _monthNames[nameIndex]!;
    }
    // 魏明帝：月建 +1（建丑→建寅）
    else if (dm >= 1807724 && dm <= 1808699) {
      nameIndex = ((v2 + 1) % 12 + 12) % 12;
      name = _monthNames[nameIndex]!;
    }
    // 武则天：月建 +2（建子→建寅）
    else if (dm >= 1999349 && dm <= 1999467) {
      nameIndex = ((v2 + 2) % 12 + 12) % 12;
      name = _monthNames[nameIndex]!;
    }
    // 武则天周历：特殊替换
    else if (dm >= 1973067 && dm <= 1977052) {
      if (v2 % 12 === 0) name = '正';
      if (v2 === 2) name = '一';
    }

    // 特殊月名避免重名（新莽/魏明帝最后一个月）
    if (dm === 1729794 || dm === 1808699) name = '拾贰';

    // 闰月前缀
    if (i === leapMonthIndex) {
      name = `闰${name}`;
    }
    monthNames[i] = name;
  }

  return {
    year,
    solarTerms,
    newMoons,
    monthLengths,
    monthNames,
    leapMonthIndex,
    winterSolstice,
  };
}

// ============ 便捷查询 ============

/**
 * 获取指定公历日期所在的历史农历月信息。
 *
 * @param jd 公历日期（J2000 相对儒略日，UT）
 */
export function getHistoricalLunarMonthAt(jd: number): {
  monthName: string;
  isLeap: boolean;
  monthLength: number;
  monthStart: number;
  monthEnd: number;
} {
  const year = arrangeHistoricalLunarYear(jd);
  const localDay = _int2(_toBjt(jd) + 0.5);

  for (let i = 0; i < 14; i++) {
    const start = year.newMoons[i]!;
    const end = year.newMoons[i + 1]!;

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

  throw new Error(`Date ${jd} not found in historical lunar year`);
}

/**
 * 获取指定公历日期所在的历史农历日信息。
 *
 * @param jd 公历日期（J2000 相对儒略日，UT）
 */
export function getHistoricalLunarDayAt(jd: number): {
  monthName: string;
  isLeap: boolean;
  day: number;
  monthLength: number;
} {
  const year = arrangeHistoricalLunarYear(jd);
  const localDay = _int2(_toBjt(jd) + 0.5);

  for (let i = 0; i < 14; i++) {
    const start = year.newMoons[i]!;
    const end = year.newMoons[i + 1]!;

    if (localDay >= start && localDay < end) {
      return {
        monthName: year.monthNames[i]!,
        isLeap: i === year.leapMonthIndex,
        day: localDay - start + 1,
        monthLength: year.monthLengths[i]!,
      };
    }
  }

  throw new Error(`Date ${jd} not found in historical lunar year`);
}
