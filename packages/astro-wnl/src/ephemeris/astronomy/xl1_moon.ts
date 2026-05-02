/**
 * SXWNL XL1 月球坐标计算（简化 ELP-2000）
 *
 * 移植自 sxwnl Dart xl_data.dart / solar_lunar_pos.dart 的 xl1Calc。
 * 数据表 xl1_data.ts 由 scripts/convert_xl1.js 从 sxwnl 导出。
 *
 * 返回 J2000 平黄道球面坐标：
 * - 黄经（弧度）
 * - 黄纬（弧度）
 * - 地心距离（千米）
 *
 * 项数：黄经 627 + 黄纬 263 + 距离 285 = 1175 项
 * 与 sxwnl 的 `mLon(t, -1)` 等效。
 */

import { xl1, W1, RAD } from './xl1_data';

const PI = Math.PI;

/** 向下取整 */
function int2(v: number): number {
  return v < 0 ? Math.ceil(v) : Math.floor(v);
}

/**
 * XL1 月球坐标级数求和。
 *
 * @param zn 坐标号 (0=黄经, 1=黄纬, 2=距离)
 * @param t 儒略世纪数 (J2000.0 起算)
 * @param n 计算项数 (负数=全部项)
 * @returns 坐标值（黄经/黄纬为弧度，距离为千米）
 */
export function xl1Calc(zn: number, t: number, n: number): number {
  const ob = xl1[zn]!;
  let v = 0;
  let tn = 1;
  let t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;
  const tx = t - 10;

  if (zn === 0) {
    // 月球平黄经（角秒）
    v +=
      (3.81034409 +
        8399.684730072 * t -
        0.00003319 * t2 +
        3.11e-8 * t3 -
        2.033e-10 * t4) *
      RAD;
    // 岁差（角秒）
    v +=
      5028.792262 * t +
      1.1124406 * t2 +
      0.00007699 * t3 -
      0.000023479 * t4 -
      0.0000000178 * t5;
    // 对公元3000年至公元5000年的拟合
    if (tx > 0) v += -0.866 + 1.43 * tx + 0.054 * tx * tx;
  }

  // 缩放 t 的高次方（与 sxwnl 一致）
  t2 /= 1e4;
  const t3s = t3 / 1e8;
  const t4s = t4 / 1e8;

  let termN = n * 6;
  if (termN < 0) termN = ob[0]!.length;

  for (let i = 0; i < ob.length; i++, tn *= t) {
    const f = ob[i]!;
    let ni = int2((termN * f.length) / ob[0]!.length + 0.5);
    if (i !== 0) ni += 6;
    if (ni > f.length) ni = f.length;

    let c = 0;
    for (let j = 0; j < ni; j += 6) {
      c +=
        f[j]! *
        Math.cos(
          f[j + 1]! +
            t * f[j + 2]! +
            t2 * f[j + 3]! +
            t3s * f[j + 4]! +
            t4s * f[j + 5]!,
        );
    }
    v += c * tn;
  }

  if (zn !== 2) v /= RAD;
  return v;
}

/**
 * 月球地心 J2000 平黄道直角坐标（全部项）
 * @param t 儒略世纪数
 * @returns [x, y, z] 单位 km
 */
export function xl1MoonCoords(t: number): [number, number, number] {
  const lon = xl1Calc(0, t, -1);
  const lat = xl1Calc(1, t, -1);
  const dist = xl1Calc(2, t, -1);
  const rCosLat = dist * Math.cos(lat);
  return [rCosLat * Math.cos(lon), rCosLat * Math.sin(lon), dist * Math.sin(lat)];
}
