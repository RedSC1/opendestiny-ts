/**
 * 布朗月球理论（Brown's Lunar Theory）
 *
 * 源自 astronomy-engine 的 CalcMoon，1954 年《航海历书》改进版。
 * 约 116 项，速度极快，精度约 10"~1′。
 *
 * 返回历元真黄道坐标：
 * - geo_eclip_lon: 历元真黄经（弧度）
 * - geo_eclip_lat: 历元真黄纬（弧度）
 * - distance_au: 地心距离（AU）
 */

const PI2 = 2 * Math.PI;
const ARC = 3600 * (180 / Math.PI); // arcseconds per radian
const KM_PER_AU = 1.4959787069098932e+8;
const EARTH_EQUATORIAL_RADIUS_KM = 6378.1366;
const EARTH_EQUATORIAL_RADIUS_AU = EARTH_EQUATORIAL_RADIUS_KM / KM_PER_AU;

function Frac(x: number): number {
  return x - Math.floor(x);
}

/**
 * 布朗月球理论计算月球地心历元真黄道坐标。
 *
 * @param tjDays TT 标度下自 J2000 起算的日数
 * @returns 历元真黄道坐标 {lon, lat, dist}
 */
export function brownMoonCoords(tjDays: number): { lon: number; lat: number; dist: number } {
  const T = tjDays / 36525;
  const T2 = T * T;

  let DLAM = 0;
  let DS = 0;
  let GAM1C = 0;
  let SINPI = 3422.7000;

  const S1 = Math.sin(PI2 * (0.19833 + 0.05611 * T));
  const S2 = Math.sin(PI2 * (0.27869 + 0.04508 * T));
  const S3 = Math.sin(PI2 * (0.16827 - 0.36903 * T));
  const S4 = Math.sin(PI2 * (0.34734 - 5.37261 * T));
  const S5 = Math.sin(PI2 * (0.10498 - 5.37899 * T));
  const S6 = Math.sin(PI2 * (0.42681 - 0.41855 * T));
  const S7 = Math.sin(PI2 * (0.14943 - 5.37511 * T));

  const DL0 = 0.84 * S1 + 0.31 * S2 + 14.27 * S3 + 7.26 * S4 + 0.28 * S5 + 0.24 * S6;
  const DL = 2.94 * S1 + 0.31 * S2 + 14.27 * S3 + 9.34 * S4 + 1.12 * S5 + 0.83 * S6;
  const DLS = -6.40 * S1 - 1.89 * S6;
  const DF = 0.21 * S1 + 0.31 * S2 + 14.27 * S3 - 88.70 * S4 - 15.30 * S5 + 0.24 * S6 - 1.86 * S7;
  const DD = DL0 - DLS;
  const DGAM =
    -3332e-9 * Math.sin(PI2 * (0.59734 - 5.37261 * T)) -
    539e-9 * Math.sin(PI2 * (0.35498 - 5.37899 * T)) -
    64e-9 * Math.sin(PI2 * (0.39943 - 5.37511 * T));

  const L0 = PI2 * Frac(0.60643382 + 1336.85522467 * T - 0.00000313 * T2) + DL0 / ARC;
  const L = PI2 * Frac(0.37489701 + 1325.55240982 * T + 0.00002565 * T2) + DL / ARC;
  const LS = PI2 * Frac(0.99312619 + 99.99735956 * T - 0.00000044 * T2) + DLS / ARC;
  const F = PI2 * Frac(0.25909118 + 1342.22782980 * T - 0.00000892 * T2) + DF / ARC;
  const D = PI2 * Frac(0.82736186 + 1236.85308708 * T - 0.00000397 * T2) + DD / ARC;

  // Precompute cos/sin tables for L, LS, F, D
  const co: number[][] = [];
  const si: number[][] = [];
  const args: [number, number, number, number] = [L, LS, F, D];
  const maxs: [number, number, number, number] = [4, 3, 4, 6];
  const facs: [number, number, number, number] = [
    1.000002208,
    0.997504612 - 0.002495388 * T,
    1.000002708 + 139.978 * DGAM,
    1.0,
  ];

  for (let i = 0; i < 4; i++) {
    const arg = args[i]!;
    const max = maxs[i]!;
    const fac = facs[i]!;
    const cRow: number[] = [1, Math.cos(arg) * fac];
    const sRow: number[] = [0, Math.sin(arg) * fac];
    for (let j = 2; j <= max; j++) {
      cRow[j] = cRow[j - 1]! * cRow[1]! - sRow[j - 1]! * sRow[1]!;
      sRow[j] = sRow[j - 1]! * cRow[1]! + cRow[j - 1]! * sRow[1]!;
    }
    const cArr: number[] = [];
    const sArr: number[] = [];
    for (let j = -max; j <= max; j++) {
      const idx = Math.abs(j);
      cArr.push(cRow[idx]!);
      sArr.push(j < 0 ? -sRow[idx]! : sRow[idx]!);
    }
    co.push(cArr);
    si.push(sArr);
  }

  function term(p: number, q: number, r: number, s: number): { x: number; y: number } {
    const I = [0, p, q, r, s];
    let x = 1;
    let y = 0;
    for (let k = 1; k <= 4; k++) {
      if (I[k] !== 0) {
        const idx = I[k]! + maxs[k - 1]!;
        const ck = co[k - 1]![idx]!;
        const sk = si[k - 1]![idx]!;
        const nx = x * ck - y * sk;
        const ny = y * ck + x * sk;
        x = nx;
        y = ny;
      }
    }
    return { x, y };
  }

  function addSol(
    coeffl: number,
    coeffs: number,
    coeffg: number,
    coeffp: number,
    p: number,
    q: number,
    r: number,
    s: number,
  ): void {
    const { x, y } = term(p, q, r, s);
    DLAM += coeffl * y;
    DS += coeffs * y;
    GAM1C += coeffg * x;
    SINPI += coeffp * x;
  }

  function addN(coeffn: number, p: number, q: number, r: number, s: number): number {
    return coeffn * term(p, q, r, s).y;
  }

  // Longitude/distance terms
  addSol(13.902, 14.06, -0.001, 0.2607, 0, 0, 0, 4);
  addSol(0.403, -4.01, 0.394, 0.0023, 0, 0, 0, 3);
  addSol(2369.912, 2373.36, 0.601, 28.2333, 0, 0, 0, 2);
  addSol(-125.154, -112.79, -0.725, -0.9781, 0, 0, 0, 1);
  addSol(1.979, 6.98, -0.445, 0.0433, 1, 0, 0, 4);
  addSol(191.953, 192.72, 0.029, 3.0861, 1, 0, 0, 2);
  addSol(-8.466, -13.51, 0.455, -0.1093, 1, 0, 0, 1);
  addSol(22639.5, 22609.07, 0.079, 186.5398, 1, 0, 0, 0);
  addSol(18.609, 3.59, -0.094, 0.0118, 1, 0, 0, -1);
  addSol(-4586.465, -4578.13, -0.077, 34.3117, 1, 0, 0, -2);
  addSol(3.215, 5.44, 0.192, -0.0386, 1, 0, 0, -3);
  addSol(-38.428, -38.64, 0.001, 0.6008, 1, 0, 0, -4);
  addSol(-0.393, -1.43, -0.092, 0.0086, 1, 0, 0, -6);
  addSol(-0.289, -1.59, 0.123, -0.0053, 0, 1, 0, 4);
  addSol(-24.42, -25.1, 0.04, -0.3, 0, 1, 0, 2);
  addSol(18.023, 17.93, 0.007, 0.1494, 0, 1, 0, 1);
  addSol(-668.146, -126.98, -1.302, -0.3997, 0, 1, 0, 0);
  addSol(0.56, 0.32, -0.001, -0.0037, 0, 1, 0, -1);
  addSol(-165.145, -165.06, 0.054, 1.9178, 0, 1, 0, -2);
  addSol(-1.877, -6.46, -0.416, 0.0339, 0, 1, 0, -4);
  addSol(0.213, 1.02, -0.074, 0.0054, 2, 0, 0, 4);
  addSol(14.387, 14.78, -0.017, 0.2833, 2, 0, 0, 2);
  addSol(-0.586, -1.2, 0.054, -0.01, 2, 0, 0, 1);
  addSol(769.016, 767.96, 0.107, 10.1657, 2, 0, 0, 0);
  addSol(1.75, 2.01, -0.018, 0.0155, 2, 0, 0, -1);
  addSol(-211.656, -152.53, 5.679, -0.3039, 2, 0, 0, -2);
  addSol(1.225, 0.91, -0.03, -0.0088, 2, 0, 0, -3);
  addSol(-30.773, -34.07, -0.308, 0.3722, 2, 0, 0, -4);
  addSol(-0.57, -1.4, -0.074, 0.0109, 2, 0, 0, -6);
  addSol(-2.921, -11.75, 0.787, -0.0484, 1, 1, 0, 2);
  addSol(1.267, 1.52, -0.022, 0.0164, 1, 1, 0, 1);
  addSol(-109.673, -115.18, 0.461, -0.949, 1, 1, 0, 0);
  addSol(-205.962, -182.36, 2.056, 1.4437, 1, 1, 0, -2);
  addSol(0.233, 0.36, 0.012, -0.0025, 1, 1, 0, -3);
  addSol(-4.391, -9.66, -0.471, 0.0673, 1, 1, 0, -4);
  addSol(0.283, 1.53, -0.111, 0.006, 1, -1, 0, 4);
  addSol(14.577, 31.7, -1.54, 0.2302, 1, -1, 0, 2);
  addSol(147.687, 138.76, 0.679, 1.1528, 1, -1, 0, 0);
  addSol(-1.089, 0.55, 0.021, 0, 1, -1, 0, -1);
  addSol(28.475, 23.59, -0.443, -0.2257, 1, -1, 0, -2);
  addSol(-0.276, -0.38, -0.006, -0.0036, 1, -1, 0, -3);
  addSol(0.636, 2.27, 0.146, -0.0102, 1, -1, 0, -4);
  addSol(-0.189, -1.68, 0.131, -0.0028, 0, 2, 0, 2);
  addSol(-7.486, -0.66, -0.037, -0.0086, 0, 2, 0, 0);
  addSol(-8.096, -16.35, -0.74, 0.0918, 0, 2, 0, -2);
  addSol(-5.741, -0.04, 0, -0.0009, 0, 0, 2, 2);
  addSol(0.255, 0, 0, 0, 0, 0, 2, 1);
  addSol(-411.608, -0.2, 0, -0.0124, 0, 0, 2, 0);
  addSol(0.584, 0.84, 0, 0.0071, 0, 0, 2, -1);
  addSol(-55.173, -52.14, 0, -0.1052, 0, 0, 2, -2);
  addSol(0.254, 0.25, 0, -0.0017, 0, 0, 2, -3);
  addSol(0.025, -1.67, 0, 0.0031, 0, 0, 2, -4);
  addSol(1.06, 2.96, -0.166, 0.0243, 3, 0, 0, 2);
  addSol(36.124, 50.64, -1.3, 0.6215, 3, 0, 0, 0);
  addSol(-13.193, -16.4, 0.258, -0.1187, 3, 0, 0, -2);
  addSol(-1.187, -0.74, 0.042, 0.0074, 3, 0, 0, -4);
  addSol(-0.293, -0.31, -0.002, 0.0046, 3, 0, 0, -6);
  addSol(-0.29, -1.45, 0.116, -0.0051, 2, 1, 0, 2);
  addSol(-7.649, -10.56, 0.259, -0.1038, 2, 1, 0, 0);
  addSol(-8.627, -7.59, 0.078, -0.0192, 2, 1, 0, -2);
  addSol(-2.74, -2.54, 0.022, 0.0324, 2, 1, 0, -4);
  addSol(1.181, 3.32, -0.212, 0.0213, 2, -1, 0, 2);
  addSol(9.703, 11.67, -0.151, 0.1268, 2, -1, 0, 0);
  addSol(-0.352, -0.37, 0.001, -0.0028, 2, -1, 0, -1);
  addSol(-2.494, -1.17, -0.003, -0.0017, 2, -1, 0, -2);
  addSol(0.36, 0.2, -0.012, -0.0043, 2, -1, 0, -4);
  addSol(-1.167, -1.25, 0.008, -0.0106, 1, 2, 0, 0);
  addSol(-7.412, -6.12, 0.117, 0.0484, 1, 2, 0, -2);
  addSol(-0.311, -0.65, -0.032, 0.0044, 1, 2, 0, -4);
  addSol(0.757, 1.82, -0.105, 0.0112, 1, -2, 0, 2);
  addSol(2.58, 2.32, 0.027, 0.0196, 1, -2, 0, 0);
  addSol(2.533, 2.4, -0.014, -0.0212, 1, -2, 0, -2);
  addSol(-0.344, -0.57, -0.025, 0.0036, 0, 3, 0, -2);
  addSol(-0.992, -0.02, 0, 0, 1, 0, 2, 2);
  addSol(-45.099, -0.02, 0, -0.001, 1, 0, 2, 0);
  addSol(-0.179, -9.52, 0, -0.0833, 1, 0, 2, -2);
  addSol(-0.301, -0.33, 0, 0.0014, 1, 0, 2, -4);
  addSol(-6.382, -3.37, 0, -0.0481, 1, 0, -2, 2);
  addSol(39.528, 85.13, 0, -0.7136, 1, 0, -2, 0);
  addSol(9.366, 0.71, 0, -0.0112, 1, 0, -2, -2);
  addSol(0.202, 0.02, 0, 0, 1, 0, -2, -4);
  addSol(0.415, 0.1, 0, 0.0013, 0, 1, 2, 0);
  addSol(-2.152, -2.26, 0, -0.0066, 0, 1, 2, -2);
  addSol(-1.44, -1.3, 0, 0.0014, 0, 1, -2, 2);
  addSol(0.384, -0.04, 0, 0, 0, 1, -2, -2);
  addSol(1.938, 3.6, -0.145, 0.0401, 4, 0, 0, 0);
  addSol(-0.952, -1.58, 0.052, -0.013, 4, 0, 0, -2);
  addSol(-0.551, -0.94, 0.032, -0.0097, 3, 1, 0, 0);
  addSol(-0.482, -0.57, 0.005, -0.0045, 3, 1, 0, -2);
  addSol(0.681, 0.96, -0.026, 0.0115, 3, -1, 0, 0);
  addSol(-0.297, -0.27, 0.002, -0.0009, 2, 2, 0, -2);
  addSol(0.254, 0.21, -0.003, 0, 2, -2, 0, -2);
  addSol(-0.25, -0.22, 0.004, 0.0014, 1, 3, 0, -2);
  addSol(-3.996, 0, 0, 0.0004, 2, 0, 2, 0);
  addSol(0.557, -0.75, 0, -0.009, 2, 0, 2, -2);
  addSol(-0.459, -0.38, 0, -0.0053, 2, 0, -2, 2);
  addSol(-1.298, 0.74, 0, 0.0004, 2, 0, -2, 0);
  addSol(0.538, 1.14, 0, -0.0141, 2, 0, -2, -2);
  addSol(0.263, 0.02, 0, 0, 1, 1, 2, 0);
  addSol(0.426, 0.07, 0, -0.0006, 1, 1, -2, -2);
  addSol(-0.304, 0.03, 0, 0.0003, 1, -1, 2, 0);
  addSol(-0.372, -0.19, 0, -0.0027, 1, -1, -2, 2);
  addSol(0.418, 0, 0, 0, 0, 0, 4, 0);
  addSol(-0.33, -0.04, 0, 0, 3, 0, 2, 0);

  // Latitude terms
  let N = 0;
  N += addN(-526.069, 0, 0, 1, -2);
  N += addN(-3.352, 0, 0, 1, -4);
  N += addN(44.297, 1, 0, 1, -2);
  N += addN(-6.0, 1, 0, 1, -4);
  N += addN(20.599, -1, 0, 1, 0);
  N += addN(-30.598, -1, 0, 1, -2);
  N += addN(-24.649, -2, 0, 1, 0);
  N += addN(-2.0, -2, 0, 1, -2);
  N += addN(-22.571, 0, 1, 1, -2);
  N += addN(10.985, 0, -1, 1, -2);

  DLAM +=
    0.82 * Math.sin(PI2 * (0.7736 - 62.5512 * T)) +
    0.31 * Math.sin(PI2 * (0.0466 - 125.1025 * T)) +
    0.35 * Math.sin(PI2 * (0.5785 - 25.1042 * T)) +
    0.66 * Math.sin(PI2 * (0.4591 + 1335.8075 * T)) +
    0.64 * Math.sin(PI2 * (0.313 - 91.568 * T)) +
    1.14 * Math.sin(PI2 * (0.148 + 1331.2898 * T)) +
    0.21 * Math.sin(PI2 * (0.5918 + 1056.5859 * T)) +
    0.44 * Math.sin(PI2 * (0.5784 + 1322.8595 * T)) +
    0.24 * Math.sin(PI2 * (0.2275 - 5.7374 * T)) +
    0.28 * Math.sin(PI2 * (0.2965 + 2.6929 * T)) +
    0.33 * Math.sin(PI2 * (0.3132 + 6.3368 * T));

  const S = F + DS / ARC;
  const latSeconds =
    (1.000002708 + 139.978 * DGAM) * (18518.511 + 1.189 + GAM1C) * Math.sin(S) -
    6.24 * Math.sin(3 * S) +
    N;

  return {
    lon: PI2 * Frac((L0 + DLAM / ARC) / PI2),
    lat: (Math.PI / (180 * 3600)) * latSeconds,
    dist: (ARC * EARTH_EQUATORIAL_RADIUS_AU) / (0.999953253 * SINPI),
  };
}
