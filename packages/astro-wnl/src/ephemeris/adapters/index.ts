/**
 * 天文星历适配器
 *
 * 提供精度分级的太阳/月球位置计算与节气/朔望搜索。
 * 接口统一使用 J2000 相对 UT 儒略日（number）流转。
 */

export { Precision } from './precision';

export { sunEclipticLongitude, sunEclipticLongitudeWithDerivative } from './sun';
export { moonEclipticPosition } from './moon';
export type { MoonSpherical } from './moon';

export { searchSolarTerm, searchLunarPhase, searchSolarTermNewton, searchSolarTermNewtonWithEstimate } from './search';
