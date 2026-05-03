/**
 * 真太阳时计算（sxwnl VSOP87 算法版）
 *
 * 移植自寿星万年历 (sxwnl) szj.dart / eph.js 的 SZJ.st() 方法。
 * 使用项目自带的 VSOP87 太阳位置计算，不依赖第三方 SPA。
 *
 * 接口使用 J2000 相对 UT 儒略日流转，与项目其它模块一致。
 */

import AstroDateTime from '../utils/astro_date_time';
import { Location } from '../models/location';
import { SolarTimeResult } from '../models/solar-time-result';
import { PolarStatus } from '../enums/polar-status';
import { sunEclipticLongitude } from '../ephemeris/adapters/sun';
import { Precision } from '../ephemeris/adapters/precision';
import { iau2000b, mean_obliq } from '../ephemeris/astronomy/astronomy';
import { deltaTDays } from '../ephemeris/delta-t';
import { rad2rrad, llrConv, pGst, mod2 } from './math_utils';

const PI2 = 2 * Math.PI;
const RAD = (180 * 3600) / Math.PI;

// ==================== 内部辅助 ====================

/** 真黄赤交角（P03 平黄赤交角 + IAU2000B 章动），返回弧度 */
function obliquity(ttDays: number): number {
  const meanDeg = mean_obliq({ tt: ttDays });
  const nut = iau2000b({ tt: ttDays });
  return (meanDeg + nut.deps / 3600) * Math.PI / 180;
}

// ==================== 常量 ====================

/** 太阳视半径 + 大气折射 ≈ 50 角分，用于日出日落判定 */
const SUN_ALTITUDE = (-50 * 60) / RAD; // 弧度

// ==================== 内部辅助 ====================

/**
 * 计算天体时角
 * @param h 地平纬度（弧度，负值为地平以下）
 * @param dec 赤纬（弧度）
 * @param lat 地理纬度（弧度）
 * @returns 时角（弧度），若永不升落返回 π
 */
function getHourAngle(h: number, dec: number, lat: number): number {
  const c = (Math.sin(h) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  if (Math.abs(c) > 1) return Math.PI;
  return Math.acos(c);
}

interface SCoordCtx {
  H: number;   // 时角
  H1: number;  // 日出日落时角
  H2: number;  // 民用晨昏时角
  H3: number;  // 航海晨昏时角
  H4: number;  // 天文晨昏时角
}

/**
 * 计算太阳赤道坐标及各时角
 *
 * @param jd J2000 相对 UT 儒略日
 * @param xm 模式（10=全部, 0=仅中天, 1=日出落, 2=民用, 3=航海, 4=天文）
 * @param dt ΔT（日）
 * @param E 真黄赤交角（弧度）
 * @param L 地理经度（弧度）
 * @param lat 地理纬度（弧度）
 */
function sCoord(
  jd: number,
  xm: number,
  dt: number,
  E: number,
  L: number,
  lat: number,
): SCoordCtx {
  // 太阳地心视黄经（度 → 弧度）
  const sunLonDeg = sunEclipticLongitude(jd, Precision.Low);
  const sunLon = sunLonDeg * Math.PI / 180;

  // 黄道坐标 [lon, lat=0, r=1] → 赤道坐标
  const eq = llrConv([sunLon, 0, 1], E);
  const ra = eq[0];
  const dec = eq[1];

  // 时角 = 格林尼治恒星时 + 经度 - 赤经
  const H = rad2rrad(pGst(jd, dt) + L - ra);

  const ctx: SCoordCtx = { H, H1: 0, H2: 0, H3: 0, H4: 0 };

  if (xm === 10 || xm === 1) ctx.H1 = getHourAngle(SUN_ALTITUDE, dec, lat);
  if (xm === 10 || xm === 2) ctx.H2 = getHourAngle((-6 * 3600) / RAD, dec, lat);
  if (xm === 10 || xm === 3) ctx.H3 = getHourAngle((-12 * 3600) / RAD, dec, lat);
  if (xm === 10 || xm === 4) ctx.H4 = getHourAngle((-18 * 3600) / RAD, dec, lat);

  return ctx;
}

// ==================== 核心算法 ====================

/** 日上中天/升/降计算结果（内部用） */
interface SZJResult {
  s: number;   // 日出 UT (J2000)
  z: number;   // 中天 UT (J2000)
  j: number;   // 日落 UT (J2000)
  sm: string;  // 极地状态备注
  H1: number;  // 日出日落时角（π = 无升落）
}

/**
 * 太阳到中升降时刻计算
 *
 * 移植自 sxwnl SZJ.st()。
 *
 * @param jdNoon 当地时间正午 12:00 对应的 UT J2000 儒略日
 * @param L 经度（弧度，东正）
 * @param lat 纬度（弧度，北正）
 */
function sunTransit(jdNoon: number, L: number, lat: number): SZJResult {
  const dt = deltaTDays(jdNoon);
  const E = obliquity(jdNoon + dt);

  // 对齐到最近的中天时刻
  let jd = jdNoon - mod2(jdNoon + L / PI2, 1);

  const sv = PI2; // 太阳周日运动角速度（弧度/天）
  let sm = '';

  // 第一轮：初始坐标计算
  let ctx = sCoord(jd, 10, dt, E, L, lat);

  // 第一次估算
  let s = jd + (-ctx.H1 - ctx.H) / sv;
  let j = jd + (ctx.H1 - ctx.H) / sv;
  let z = jd + (0 - ctx.H) / sv;

  // 第二轮：精修日出
  ctx = sCoord(s, 1, dt, E, L, lat);
  s += rad2rrad(-ctx.H1 - ctx.H) / sv;
  if (ctx.H1 === Math.PI) sm += '无升起.';

  // 精修日落
  ctx = sCoord(j, 1, dt, E, L, lat);
  j += rad2rrad(ctx.H1 - ctx.H) / sv;
  if (ctx.H1 === Math.PI) sm += '无降落.';

  // 精修中天
  ctx = sCoord(z, 0, dt, E, L, lat);
  z += rad2rrad(0 - ctx.H) / sv;

  return { s, z, j, sm, H1: ctx.H1 };
}

// ==================== 公开 API ====================

/**
 * 计算真太阳时（sxwnl VSOP87 算法）
 *
 * @param dateTime 输入时间（标准时区时间，如北京时间）
 * @param location 地理位置（经纬度，度）
 * @param timezone 时区偏移（小时），默认 +8（北京时间）
 * @returns 真太阳时计算结果
 */
export function calcTrueSolarTime(
  dateTime: AstroDateTime,
  location: Location,
  timezone: number = 8.0,
): SolarTimeResult {
  const L = (location.longitude * Math.PI) / 180;
  const lat = (location.latitude * Math.PI) / 180;

  // 当地正午 12:00 → UT J2000
  const localNoon = new AstroDateTime(dateTime.year, dateTime.month, dateTime.day, 12, 0, 0);
  const jdUtNoon = localNoon.toJ2000() - timezone / 24;

  // 计算日上中天/升/降
  const res = sunTransit(jdUtNoon, L, lat);

  // 工具：UT J2000 → 当地时区时间
  const toLocalTime = (jdUt: number): AstroDateTime =>
    AstroDateTime.fromJ2000(jdUt + timezone / 24);

  // 中天时刻（当地时区时间）
  const solarNoon = toLocalTime(res.z);

  // 均时差计算（与 sxwnl _calcTrueSolarTimeSxwnl 一致）
  // transitOffsetDays = 中天UT - 当地正午UT（天）
  // totalOffsetHours = 真太阳时 - 标准时钟时（小时）
  const transitOffsetDays = res.z - jdUtNoon;
  const totalOffsetHours = -transitOffsetDays * 24;
  const lonDiffHours = (location.longitude - timezone * 15) / 15;
  const eotHours = totalOffsetHours - lonDiffHours;

  // 真太阳时 = 输入时间 + totalOffset
  const totalOffsetMs = totalOffsetHours * 3600 * 1000;
  const trueSolarTime = dateTime.add(totalOffsetMs);

  // 日出日落
  const hasSunrise = !res.sm.includes('无升起');
  const hasSunset = !res.sm.includes('无降落');
  const sunrise = hasSunrise ? toLocalTime(res.s) : null;
  const sunset = hasSunset ? toLocalTime(res.j) : null;

  // 极地状态
  let polarStatus = PolarStatus.none;
  if (!hasSunrise && !hasSunset) {
    // 物理判定：用正午太阳赤纬
    const E = obliquity(res.z + deltaTDays(res.z));
    const sunLonRad = sunEclipticLongitude(res.z, Precision.Low) * Math.PI / 180;
    const eq = llrConv([sunLonRad, 0, 1], E);
    const dec = eq[1];
    const isNorthSummer = dec > 0;

    if (location.latitude > 0) {
      polarStatus = isNorthSummer ? PolarStatus.polarDay : PolarStatus.polarNight;
    } else {
      polarStatus = isNorthSummer ? PolarStatus.polarNight : PolarStatus.polarDay;
    }
  }

  return {
    trueSolarTime,
    equationOfTime: eotHours,
    solarNoon,
    sunrise,
    sunset,
    polarStatus,
  };
}
