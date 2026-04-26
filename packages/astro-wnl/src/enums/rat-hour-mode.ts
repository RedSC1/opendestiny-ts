/**
 * 早晚子时处理模式
 *
 * 对标 Dart 版本的 RatHourMode。
 */
export enum RatHourMode {
  /** 不区分早晚子时（传统早子时）。23:00 直接算次日日柱。 */
  noSplit = 'noSplit',

  /** 区分早晚子时 —— 晚子时日柱仍算今天，时柱天干按今天日干五鼠遁。 */
  todayGan = 'todayGan',

  /** 区分早晚子时 —— 晚子时日柱仍算今天，时柱天干按明天日干五鼠遁。 */
  tomorrowGan = 'tomorrowGan',
}
