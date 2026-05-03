/**
 * 历史历法时期常量
 *
 * 统一导出修正表覆盖范围、古代建正区间、改历窗口等，
 * 方便下游做 UI 提示或测试断言。
 *
 * 年份均为天文纪年（有公元 0 年）：0 = 1 BC, -1 = 2 BC, ...
 * JD 均为绝对儒略日（J2000 = 2451545）。
 */

/** 历史时期描述 */
export interface HistoricalPeriod {
  readonly name: string;
  readonly description: string;
  /** 起始年（天文纪年，含） */
  readonly startYear: number;
  /** 结束年（天文纪年，含） */
  readonly endYear: number;
}

// ============ 修正表覆盖范围 ============

/** 朔日修正表覆盖范围：约 722 BC ~ 1960 AD */
export const SUO_CORRECTION_PERIOD: HistoricalPeriod = {
  name: '朔日修正',
  description: '朔日历史修正表（SUO_CORRECTION_DATA），覆盖春秋至近代',
  startYear: -721,
  endYear: 1959,
};

/** 远古节气修正表覆盖范围（平气时期）：约 221 BC ~ 1645 AD */
export const QI_ANCIENT_PERIOD: HistoricalPeriod = {
  name: '远古节气（平气）',
  description: '远古节气修正表（QI_ANCIENT_DATA），平气时代，均匀间隔 ~15.218 天',
  startYear: -220,
  endYear: 1645,
};

/** 近代节气修正表覆盖范围（定气时期）：1646 ~ 1960 AD */
export const QI_MODERN_PERIOD: HistoricalPeriod = {
  name: '近代节气（定气）',
  description: '近代节气修正表（QI_CORRECTION_DATA），定气时代，天文搜索 + 小校正',
  startYear: 1646,
  endYear: 1959,
};

/** 历史修正表总覆盖范围（取并集） */
export const HISTORICAL_CORRECTION_PERIOD: HistoricalPeriod = {
  name: '历史修正（总）',
  description: '朔日 + 远古节气 + 近代节气修正表的并集范围',
  startYear: -721,
  endYear: 1959,
};

// ============ 古代建正区间（-721 ~ -104 BC） ============

/** 春秋建丑 */
export const SPRING_AUTUMN_PERIOD: HistoricalPeriod = {
  name: '春秋建丑',
  description: '春秋时期，以丑月（十二月）为年首，闰月称"十三"',
  startYear: -721,
  endYear: -480,
};

/** 战国建丑 */
export const WARRING_STATES_PERIOD: HistoricalPeriod = {
  name: '战国建丑',
  description: '战国时期，以丑月为年首，闰月称"十三"',
  startYear: -479,
  endYear: -221,
};

/** 秦汉建亥 */
export const QIN_HAN_PERIOD: HistoricalPeriod = {
  name: '秦汉建亥',
  description: '秦汉时期，以亥月（十月）为年首，闰月称"后九"',
  startYear: -220,
  endYear: -104,
};

/** 古代特殊历法区间（春秋至汉初，不以正月为年首） */
export const ANCIENT_CALENDAR_PERIOD: HistoricalPeriod = {
  name: '古代特殊历法',
  description: '春秋建丑 / 战国建丑 / 秦汉建亥，不以正月为年首',
  startYear: -721,
  endYear: -104,
};

// ============ 改历窗口（月名修正） ============

/**
 * 新莽改历窗口：建丑→建寅，月建 +1。
 * 9-23 AD，约公元 9 年 1 月 15 日 ~ 23 年 12 月 2 日。
 */
export const XIN_MANG_PERIOD: HistoricalPeriod = {
  name: '新莽',
  description: '王莽新朝，月建 +1（建丑→建寅），最后一个月避讳称"拾贰"',
  startYear: 9,
  endYear: 23,
};

/**
 * 魏明帝改历窗口：建丑→建寅，月建 +1。
 * 237-239 AD，约公元 237 年 4 月 12 日 ~ 239 年 12 月 13 日。
 */
export const WEI_MING_PERIOD: HistoricalPeriod = {
  name: '魏明帝',
  description: '曹叡景初元年至三年，月建 +1（建丑→建寅），最后一个月称"拾贰"',
  startYear: 237,
  endYear: 239,
};

/**
 * 武则天改历窗口：建子→建寅，月建 +2。
 * 761-762 AD，约公元 761 年 12 月 2 日 ~ 762 年 3 月 30 日。
 */
export const WU_ZE_TIAN_PERIOD: HistoricalPeriod = {
  name: '武则天改历',
  description: '武则天时期月建 +2（建子→建寅）',
  startYear: 761,
  endYear: 762,
};

/**
 * 武则天周历窗口：特殊月名替换（正→正，二→一）。
 * 689-700 AD，约公元 689 年 12 月 18 日 ~ 700 年 11 月 15 日。
 */
export const WU_ZHOU_PERIOD: HistoricalPeriod = {
  name: '武则天周历',
  description: '武则天周历时期，以十一月为正月，月名特殊替换',
  startYear: 689,
  endYear: 700,
};

// ============ 汇总列表 ============

/** 修正表覆盖范围列表 */
export const CORRECTION_PERIODS: readonly HistoricalPeriod[] = [
  SUO_CORRECTION_PERIOD,
  QI_ANCIENT_PERIOD,
  QI_MODERN_PERIOD,
  HISTORICAL_CORRECTION_PERIOD,
];

/** 古代特殊建正列表 */
export const ANCIENT_BUILD_PERIODS: readonly HistoricalPeriod[] = [
  SPRING_AUTUMN_PERIOD,
  WARRING_STATES_PERIOD,
  QIN_HAN_PERIOD,
];

/** 改历窗口列表 */
export const CALENDAR_REFORM_PERIODS: readonly HistoricalPeriod[] = [
  XIN_MANG_PERIOD,
  WEI_MING_PERIOD,
  WU_ZE_TIAN_PERIOD,
  WU_ZHOU_PERIOD,
];
