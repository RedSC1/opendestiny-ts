/**
 * VSOP87B 行星星历数据声明
 *
 * 每个行星的数据是三维数组：[L, B, R]
 * 每个坐标是二维数组：[t^0, t^1, t^2, t^3, t^4, t^5]
 * 每个幂次是一维数组：[[ampl, phas, freq], ...]
 */

/** 各行星 VSOP87B 数据 */
export const vsop: {
  Mercury: [number[][][], number[][][], number[][][]];
  Venus: [number[][][], number[][][], number[][][]];
  Earth: [number[][][], number[][][], number[][][]];
  Mars: [number[][][], number[][][], number[][][]];
  Jupiter: [number[][][], number[][][], number[][][]];
  Saturn: [number[][][], number[][][], number[][][]];
  Uranus: [number[][][], number[][][], number[][][]];
  Neptune: [number[][][], number[][][], number[][][]];
};
