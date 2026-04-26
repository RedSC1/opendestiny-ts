/**
 * 极区特殊天象状态
 */
export enum PolarStatus {
  /** 正常昼夜交替 */
  none = 'none',

  /** 极昼（太阳永不落） */
  polarDay = 'polarDay',

  /** 极夜（太阳永不升） */
  polarNight = 'polarNight',
}
