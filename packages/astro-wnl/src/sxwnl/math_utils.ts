/**
 * 天文数学工具函数
 *
 * 移植自寿星万年历 (sxwnl) eph0.js 的基础数学工具部分。
 */

const PI2 = 2 * Math.PI;

/** 每弧度的角秒数 (206264.806...) */
const RAD = (180 * 3600) / Math.PI;

// ==================== 角度归一化 ====================

/** 将角度归一化到 [0, 2π) */
export function rad2mrad(v: number): number {
  v = v % PI2;
  if (v < 0) v += PI2;
  return v;
}

/** 将角度归一化到 (-π, π] */
export function rad2rrad(v: number): number {
  v = v % PI2;
  if (v <= -Math.PI) v += PI2;
  if (v > Math.PI) v -= PI2;
  return v;
}

// ==================== 坐标转换 ====================

/**
 * 黄道坐标 → 赤道坐标
 *
 * @param z [经度, 纬度, 距离]
 * @param e 黄赤交角（弧度）
 * @returns [赤经, 赤纬, 距离]
 */
export function llrConv(z: [number, number, number], e: number): [number, number, number] {
  const jj = z[0];
  const w = z[1];
  const sinE = Math.sin(e);
  const cosE = Math.cos(e);
  const sinW = Math.sin(w);
  const cosW = Math.cos(w);

  const ra = Math.atan2(Math.sin(jj) * cosE - (sinW / cosW) * sinE, Math.cos(jj));
  const dec = Math.asin(sinW * cosE + cosW * sinE * Math.sin(jj));

  return [rad2mrad(ra), dec, z[2]];
}

// ==================== 恒星时 ====================

/**
 * 平恒星时计算 (IAU 1982)
 *
 * @param jd J2000 相对 UT 儒略日
 * @param dt ΔT（日）
 * @returns 格林尼治平恒星时（弧度）
 */
export function pGst(jd: number, dt: number): number {
  const t = (jd + dt) / 36525;
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;

  let v =
    PI2 * (0.779057273264 + 1.00273781191135448 * jd) +
    (0.014506 +
      4612.15739966 * t +
      1.39667721 * t2 -
      0.00009344 * t3 +
      0.00001882 * t4) /
      RAD;

  return rad2mrad(v);
}

// ==================== 取整 ====================

/** 向零截断取模 (模拟 JS %) */
function jsMod(a: number, b: number): number {
  return a - b * Math.trunc(a / b);
}

/**
 * 临界余数：a 与最近的整倍数 b 相差的距离
 * 原函数名：mod2(a, b)
 */
export function mod2(a: number, b: number): number {
  let c = jsMod(a + b, b);
  if (c > b / 2) c -= b;
  return c;
}
