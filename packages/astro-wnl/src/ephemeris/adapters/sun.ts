/**
 * 分级太阳视黄经计算
 *
 * 三种精度级别，统一返回历元真黄道视黄经：
 * - Low:    约 49 项 VSOP87，速度最快
 * - Medium: 约 840 项 VSOP87，日常计算精度
 * - High:   2564 项全量 VSOP87，最终精修
 *
 * 接口统一使用 J2000 相对 UT 儒略日（number）流转，
 * 内部调用星历时临时转为 TT。
 */

import { AstroTime, Ecliptic, Vector } from '../astronomy/astronomy';
import { vsop } from '../astronomy/vsop87_data';
import { deltaTDays } from '../delta-t';
import { Precision } from './precision';

const PI2 = 2 * Math.PI;
const RAD2DEG = 180 / Math.PI;
const DAYS_PER_MILLENNIUM = 365250;
const C_AUDAY = 173.1446326846693;

/** UT → TT：星历计算需要力学时 */
function utToTt(jd: number): number {
  return jd + deltaTDays(jd);
}

/** 构造内部 AstroTime（仅供 astronomy-engine 调用） */
function _at(jd: number): AstroTime {
  const tt = utToTt(jd);
  // AstroTime 构造函数传 number 时当成 ut，但我们已经算了 tt
  // 手动设置避免它再用内置 deltaT（可能跟我们的不一致）
  const at = new AstroTime(0);
  (at as any).ut = jd;
  (at as any).tt = tt;
  return at;
}

/** VSOP87 动力学黄道 → J2000 赤道旋转矩阵 */
const VSOP_ROT = {
  m00: 1.000000000000,
  m01: 0.000000440360,
  m02: -0.000000190919,
  m10: -0.000000479966,
  m11: 0.917482137087,
  m12: -0.397776982902,
  m20: 0.000000000000,
  m21: 0.397776982902,
  m22: 0.917482137087,
};

/** 原版 astronomy-engine 地球项数（~49 项） */
const LOW_TERMS = {
  L: [28, 2, 1, 0, 0, 0] as number[],
  B: [0, 2, 0, 0, 0, 0] as number[],
  R: [13, 2, 1, 0, 0, 0] as number[],
};

/** 各幂次取约 1/3（~840 项） */
const MEDIUM_TERMS = {
  L: [200, 120, 50, 8, 4, 2] as number[],
  B: [60, 45, 20, 5, 2, 1] as number[],
  R: [170, 100, 45, 7, 3, 1] as number[],
};

/** 全量项数（动态读取） */
const FULL_TERMS = {
  L: vsop.Earth[0].map(s => s.length),
  B: vsop.Earth[1].map(s => s.length),
  R: vsop.Earth[2].map(s => s.length),
};

/**
 * VSOP87 级数求值（支持截断）
 */
function vsopFormula(
  formula: number[][][],
  t: number,
  clampAngle: boolean,
  maxTerms: number[],
): number {
  let tpower = 1;
  let coord = 0;
  for (let i = 0; i < formula.length; i++) {
    const series = formula[i]!;
    const limit = maxTerms[i] ?? series.length;
    let sum = 0;
    for (let j = 0; j < Math.min(limit, series.length); j++) {
      const term = series[j]!;
      const ampl = term[0]!;
      const phas = term[1]!;
      const freq = term[2]!;
      sum += ampl * Math.cos(phas + t * freq);
    }
    let incr = tpower * sum;
    if (clampAngle) {
      incr %= PI2;
    }
    coord += incr;
    tpower *= t;
  }
  return coord;
}

/**
 * 球面转直角坐标
 */
function vsopSphereToRect(lon: number, lat: number, radius: number): [number, number, number] {
  const rCosLat = radius * Math.cos(lat);
  return [
    rCosLat * Math.cos(lon),
    rCosLat * Math.sin(lon),
    radius * Math.sin(lat),
  ];
}

/**
 * 计算太阳地心 J2000 赤道几何坐标（截断 VSOP87）
 * @param jd J2000 相对 UT 儒略日
 */
function calcSunGeometricEquJ2000(
  jd: number,
  lTerms: number[],
  bTerms: number[],
  rTerms: number[],
): [number, number, number] {
  // 光行时间修正：减去光从太阳到地球的传播时间
  // 先算 TT，再减光行时
  const tt = utToTt(jd);
  const ttDays = tt - 1 / C_AUDAY;
  const t = ttDays / DAYS_PER_MILLENNIUM;

  const lon = vsopFormula(vsop.Earth[0], t, true, lTerms);
  const lat = vsopFormula(vsop.Earth[1], t, false, bTerms);
  const rad = vsopFormula(vsop.Earth[2], t, false, rTerms);

  const eclip = vsopSphereToRect(lon, lat, rad);
  // 日心 → 地心（动力学黄道）
  const x = -eclip[0];
  const y = -eclip[1];
  const z = -eclip[2];

  // 动力学黄道 → J2000 赤道
  return [
    VSOP_ROT.m00 * x + VSOP_ROT.m01 * y + VSOP_ROT.m02 * z,
    VSOP_ROT.m10 * x + VSOP_ROT.m11 * y + VSOP_ROT.m12 * z,
    VSOP_ROT.m20 * x + VSOP_ROT.m21 * y + VSOP_ROT.m22 * z,
  ];
}

/**
 * J2000 赤道几何坐标 → 历元真黄道视黄经
 * @param jd J2000 相对 UT 儒略日
 */
function equJ2000ToApparent(
  posEquJ2000: [number, number, number],
  jd: number,
): number {
  const at = _at(jd);
  const vec = new Vector(posEquJ2000[0], posEquJ2000[1], posEquJ2000[2], at);
  const ecl = Ecliptic(vec);
  return ecl.elon;
}

/**
 * VSOP87 级数解析导数。
 *
 * formula 结构: number[][][] — [t^0, t^1, t^2, t^3, t^4, t^5]
 * 每项: [ampl, phas, freq]
 *
 * λ(t) = Σ t^i · Σ A·cos(B + C·t)
 * dλ/dt = Σ [i·t^{i-1} · Σ A·cos(B + C·t) + t^i · Σ -A·C·sin(B + C·t)]
 *
 * 返回 dλ/dt，单位: 弧度/千儒略年
 */
function vsopDerivative(
  formula: number[][][],
  t: number,
  maxTerms: number[],
): number {
  let tpower = 1;
  let dcoord = 0;

  for (let i = 0; i < formula.length; i++) {
    const series = formula[i]!;
    const limit = maxTerms[i] ?? series.length;
    let sum = 0;
    let dsum = 0;

    for (let j = 0; j < Math.min(limit, series.length); j++) {
      const term = series[j]!;
      const ampl = term[0]!;
      const phas = term[1]!;
      const freq = term[2]!;
      const angle = phas + t * freq;
      sum += ampl * Math.cos(angle);
      dsum += -ampl * freq * Math.sin(angle);
    }

    if (i > 0) {
      dcoord += i * (tpower / t) * sum;
    }
    dcoord += tpower * dsum;
    tpower *= t;
  }

  return dcoord;
}

/** 获取指定精度的截断参数 */
function _getTerms(precision: Precision): { L: number[]; B: number[]; R: number[] } {
  switch (precision) {
    case Precision.Low:
      return LOW_TERMS;
    case Precision.Medium:
      return MEDIUM_TERMS;
    case Precision.High:
    default:
      return FULL_TERMS;
  }
}

/**
 * 太阳视黄经及其对时间的导数。
 *
 * @param jd J2000 相对 UT 儒略日
 * @param precision 精度等级
 * @returns lon: 视黄经（度）, dlon: 角速度（度/天）
 *
 * 注：dlon 来自动力学黄道层面的 VSOP87 解析导数，
 * 与真黄道角速度的差异 <0.001%，完全满足牛顿迭代需求。
 */
export function sunEclipticLongitudeWithDerivative(
  jd: number,
  precision: Precision,
): { lon: number; dlon: number } {
  const lon = sunEclipticLongitude(jd, precision);

  const terms = _getTerms(precision);
  const tt = utToTt(jd);
  const ttDays = tt - 1 / C_AUDAY;
  const t = ttDays / DAYS_PER_MILLENNIUM;

  const dlonDyn = vsopDerivative(vsop.Earth[0], t, terms.L);
  // 弧度/千儒略年 → 度/天
  const dlon = dlonDyn * RAD2DEG / DAYS_PER_MILLENNIUM;

  return { lon, dlon };
}

/**
 * 太阳视黄经（精度分级）
 *
 * @param jd J2000 相对 UT 儒略日
 * @param precision 精度等级
 * @returns 太阳视黄经（度），范围 [0, 360)
 */
export function sunEclipticLongitude(jd: number, precision: Precision): number {
  switch (precision) {
    case Precision.Low:
      return equJ2000ToApparent(
        calcSunGeometricEquJ2000(jd, LOW_TERMS.L, LOW_TERMS.B, LOW_TERMS.R),
        jd,
      );
    case Precision.Medium:
      return equJ2000ToApparent(
        calcSunGeometricEquJ2000(jd, MEDIUM_TERMS.L, MEDIUM_TERMS.B, MEDIUM_TERMS.R),
        jd,
      );
    case Precision.High:
    default:
      return equJ2000ToApparent(
        calcSunGeometricEquJ2000(jd, FULL_TERMS.L, FULL_TERMS.B, FULL_TERMS.R),
        jd,
      );
  }
}
