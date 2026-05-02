/**
 * 天文计算精度等级
 *
 * - VeryLow: 约 10 项 VSOP87，误差 ~10"-60"，速度最快 —— 历史修正初值
 * - Low:     约 49 项 VSOP87，误差 ~1.4"，速度 45x —— 预搜索粗定位
 * - Medium:  约 840 项 VSOP87，误差 ~0.03"，速度 3.6x —— 日常计算
 * - High:    2564 项全量 + 岁差章动光行差 —— 最终精修
 */
export enum Precision {
  VeryLow = 'verylow',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}
