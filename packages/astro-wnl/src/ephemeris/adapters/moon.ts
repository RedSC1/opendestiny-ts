/**
 * 分级月球视位置计算
 *
 * 所有精度统一返回历元真黄道视坐标：
 * - VeryLow:     布朗月球理论（~116 项），速度最快，误差 10"~1′
 * - Low:         SXWNL XL1 简化版（1175 项）
 * - Medium:      ELPMPP02 5e-4 截断版
 * - High:        ELPMPP02 完整版（24896 项）
 *
 * 接口统一使用 J2000 相对 UT 儒略日（number）流转，
 * 内部调用星历时临时转为 TT。
 */

import { AstroTime, Ecliptic, Vector } from '../astronomy/astronomy';
import { brownMoonCoords } from '../astronomy/brown_moon';
import { elpmpp02 } from '../astronomy/elpmpp02';
import { elpmpp02_5e4 } from '../astronomy/elpmpp02_5e4';
import { xl1MoonCoords } from '../astronomy/xl1_moon';
import { deltaTDays } from '../delta-t';
import { Precision } from './precision';

const KM_PER_AU = 149597870.69098932;

/** UT → TT */
function utToTt(jd: number): number {
  return jd + deltaTDays(jd);
}

/** 构造内部 AstroTime（仅供 astronomy-engine 调用） */
function _at(jd: number): AstroTime {
  const tt = utToTt(jd);
  const at = new AstroTime(0);
  (at as any).ut = jd;
  (at as any).tt = tt;
  return at;
}

/**
 * J2000 平黄赤交角 ε₀ = 23°26′21″.406（IAU 2000 模型常数）。
 * 来自 astronomy.js 的 mean_obliq(t=0) = 84381.406" / 3600。
 */
const OBL_J2000_DEG = 84381.406 / 3600;
const OBL_J2000_RAD = OBL_J2000_DEG * (Math.PI / 180);
const COS_EPS = Math.cos(OBL_J2000_RAD);
const SIN_EPS = Math.sin(OBL_J2000_RAD);

/**
 * 月球地心黄道球面坐标
 */
export interface MoonSpherical {
  /** 黄经（度） */
  elon: number;
  /** 黄纬（度） */
  elat: number;
  /** 地心距离（AU） */
  dist: number;
}

/**
 * ELPMPP02 的 J2000 平黄道直角坐标 → 历元真黄道视坐标
 * @param jd J2000 相对 UT 儒略日
 */
function elpToApparent(x: number, y: number, z: number, jd: number): MoonSpherical {
  // J2000 平黄道 → J2000 赤道
  const xeq = x;
  const yeq = COS_EPS * y - SIN_EPS * z;
  const zeq = SIN_EPS * y + COS_EPS * z;
  const at = _at(jd);
  const vec = new Vector(xeq / KM_PER_AU, yeq / KM_PER_AU, zeq / KM_PER_AU, at);
  // Ecliptic: J2000 赤道 → 历元平赤道（岁差）→ 历元真赤道（章动）→ 历元真黄道
  const ecl = Ecliptic(vec);
  return { elon: ecl.elon, elat: ecl.elat, dist: ecl.vec.Length() };
}

/**
 * 月球地心黄道视坐标（精度分级）
 *
 * @param jd J2000 相对 UT 儒略日
 * @param precision 精度等级
 * @returns 月球历元真黄道球面坐标
 */
export function moonEclipticPosition(jd: number, precision: Precision): MoonSpherical {
  // ELPMPP02 需要 TT
  const tt = utToTt(jd);
  const tjDays = tt;

  switch (precision) {
    case Precision.High:
      return elpToApparent(...elpmpp02(tjDays), jd);
    case Precision.Medium:
      return elpToApparent(...elpmpp02_5e4(tjDays), jd);
    case Precision.Low: {
      const t = tjDays / 36525;
      return elpToApparent(...xl1MoonCoords(t), jd);
    }
    case Precision.VeryLow:
    default: {
      const { lon, lat, dist } = brownMoonCoords(tjDays);
      return { elon: lon * (180 / Math.PI), elat: lat * (180 / Math.PI), dist };
    }
  }
}
