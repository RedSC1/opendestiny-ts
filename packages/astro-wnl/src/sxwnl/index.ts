/**
 * sxwnl 天文算法模块
 *
 * 移植自寿星万年历 (sxwnl) 的纯数学天文算法：
 * - 真太阳时（日上中天/升/降）
 * - 黄赤交角与章动
 * - 坐标转换与恒星时
 */
export { calcTrueSolarTime } from './true_solar_time';
export { rad2mrad, rad2rrad, llrConv, pGst, mod2 } from './math_utils';
