/**
 * 节气/朔望搜索（支持精度分级与两阶段策略）
 *
 * 接口统一使用 J2000 相对 UT 儒略日（number）流转。
 * 内部调用 astronomy-engine Search 时临时构造 AstroTime，
 * 目标函数中忽略 AstroTime 自带的 tt，直接使用 .ut。
 *
 * 两阶段策略（High 精度默认启用）：
 * 1. Low 精度快速扫描定位到 ±1 天区间
 * 2. High 精度在窄区间内精修到秒级
 *
 * 单精度模式：传入 Precision.Low/Medium 时，直接使用对应精度一步算完。
 */

import { AstroTime, MakeTime, Search } from '../astronomy/astronomy';
import { Precision } from './precision';
import { sunEclipticLongitude } from './sun';
import { moonEclipticPosition } from './moon';

/**
 * 角度差规范化到 [-180, 180)
 */
function longitudeOffset(diff: number): number {
  let offset = diff;
  while (offset <= -180) offset += 360;
  while (offset > 180) offset -= 360;
  return offset;
}

/** number → AstroTime（仅供 Search 内部使用） */
function _at(jd: number): AstroTime {
  return new AstroTime(jd);
}

// ============ 节气搜索 ============

/**
 * 搜索太阳视黄经达到 targetLon 的时刻
 *
 * @param targetLon 目标黄经（度），如 0=春分, 90=夏至, 180=秋分, 270=冬至
 * @param jdStart   搜索起始时间（J2000 相对 UT 儒略日）
 * @param limitDays 向前搜索的最大天数
 * @param precision 精度等级，默认 High（启用两阶段策略）
 * @returns 精确时刻（J2000 相对 UT 儒略日），未找到返回 null
 */
export function searchSolarTerm(
  targetLon: number,
  jdStart: number,
  limitDays: number,
  precision: Precision = Precision.High,
): number | null {
  if (precision === Precision.High) {
    return searchSolarTermTwoPhase(targetLon, jdStart, limitDays);
  }

  const t1 = _at(jdStart);
  const t2 = _at(jdStart + limitDays);

  function sunOffset(t: AstroTime): number {
    // 忽略 astronomy-engine 的 tt，使用 .ut（UT）
    const lon = sunEclipticLongitude(t.ut, precision);
    return longitudeOffset(lon - targetLon);
  }

  const result = Search(sunOffset, t1, t2, { dt_tolerance_seconds: 0.01 });
  return result ? result.ut : null;
}

/**
 * 两阶段节气搜索
 * 阶段 1：Low 精度粗定位（容差 60 秒）
 * 阶段 2：High 精度精修（容差 0.01 秒）
 */
function searchSolarTermTwoPhase(
  targetLon: number,
  jdStart: number,
  limitDays: number,
): number | null {
  const t1 = _at(jdStart);
  const t2 = _at(jdStart + limitDays);

  // 阶段 1：Low 精度粗搜
  const coarse = Search(
    (t: AstroTime) => longitudeOffset(sunEclipticLongitude(t.ut, Precision.Low) - targetLon),
    t1,
    t2,
    { dt_tolerance_seconds: 60 },
  );
  if (!coarse) return null;

  // 阶段 2：High 精度在 ±1 天区间内精修
  const fine = Search(
    (t: AstroTime) => longitudeOffset(sunEclipticLongitude(t.ut, Precision.High) - targetLon),
    _at(coarse.ut - 1),
    _at(coarse.ut + 1),
    { dt_tolerance_seconds: 0.01 },
  );
  return fine ? fine.ut : null;
}

// ============ 朔望搜索 ============

/**
 * 搜索月相时刻（朔/上弦/望/下弦）
 *
 * @param targetPhase 目标月相角（度）：0=朔, 90=上弦, 180=望, 270=下弦
 * @param jdStart     搜索起始时间（J2000 相对 UT 儒略日）
 * @param limitDays   向前搜索的最大天数
 * @param precision   精度等级，默认 High（启用两阶段策略）
 * @returns 精确时刻（J2000 相对 UT 儒略日），未找到返回 null
 */
export function searchLunarPhase(
  targetPhase: number,
  jdStart: number,
  limitDays: number,
  precision: Precision = Precision.High,
): number | null {
  if (precision === Precision.High) {
    return searchLunarPhaseTwoPhase(targetPhase, jdStart, limitDays);
  }

  const t1 = _at(jdStart);
  const t2 = _at(jdStart + limitDays);

  function phaseOffset(t: AstroTime): number {
    const sunLon = sunEclipticLongitude(t.ut, precision);
    const moon = moonEclipticPosition(t.ut, precision);
    const diff = longitudeOffset(moon.elon - sunLon);
    return longitudeOffset(diff - targetPhase);
  }

  const result = Search(phaseOffset, t1, t2, { dt_tolerance_seconds: 0.01 });
  return result ? result.ut : null;
}

/**
 * 两阶段朔望搜索
 */
function searchLunarPhaseTwoPhase(
  targetPhase: number,
  jdStart: number,
  limitDays: number,
): number | null {
  const t1 = _at(jdStart);
  const t2 = _at(jdStart + limitDays);

  const coarse = Search(
    (t: AstroTime) => {
      const sunLon = sunEclipticLongitude(t.ut, Precision.Low);
      const moon = moonEclipticPosition(t.ut, Precision.Low);
      const diff = longitudeOffset(moon.elon - sunLon);
      return longitudeOffset(diff - targetPhase);
    },
    t1,
    t2,
    { dt_tolerance_seconds: 60 },
  );
  if (!coarse) return null;

  const fine = Search(
    (t: AstroTime) => {
      const sunLon = sunEclipticLongitude(t.ut, Precision.High);
      const moon = moonEclipticPosition(t.ut, Precision.High);
      const diff = longitudeOffset(moon.elon - sunLon);
      return longitudeOffset(diff - targetPhase);
    },
    _at(coarse.ut - 1),
    _at(coarse.ut + 1),
    { dt_tolerance_seconds: 0.01 },
  );
  return fine ? fine.ut : null;
}
