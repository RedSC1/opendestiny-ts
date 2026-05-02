/**
 * 历史农历天文修正模块
 *
 * 提供基于现代天文算法 + sxwnl 历史修正表的
 * 节气与朔日查询接口（范围约 619 ~ 2002 年）。
 */

export {
  getChineseHistoricalSolarTerm,
  getChineseHistoricalMonth,
} from './chinese-historical';
