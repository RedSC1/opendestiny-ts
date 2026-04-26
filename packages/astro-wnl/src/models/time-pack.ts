/**
 * 时间封装包 (TimePack)
 *
 * 核心职责：
 * 1. 承载用户输入的原始时间 (Clock Time)。
 * 2. 计算并携带天文时间 (UTC, True Solar Time)。
 * 3. 确定排盘基准时间 (Virtual Time)，但不做换日处理。
 * 4. 携带排盘配置 (如是否分早晚子时)。
 */

import AstroDateTime from '../utils/astro_date_time';
import { Location } from './location';
import { SolarTimeResult } from './solar-time-result';
import { RatHourMode } from '../enums/rat-hour-mode';

export class TimePack {
  /** 用户输入的墙上钟表时间 (Face Value) */
  readonly clockTime: AstroDateTime;

  /** 真太阳时计算结果 */
  readonly solarTime: SolarTimeResult;

  /**
   * 排盘基准时间
   *
   * 用于定【日柱】和【时柱】。
   * - 若 useTrueSolarTime = true，此处为真太阳时。
   * - 若 useTrueSolarTime = false，此处为钟表时间。
   * 注意：此处【不处理】早晚子时的日期变更，保持原始值。
   */
  readonly virtualTime: AstroDateTime;

  /** 世界协调时 (UTC)。用于和天文算法返回的节气进行绝对时间对比。 */
  readonly utcTime: AstroDateTime;

  /** 用户所在时区（小时偏移，如 +8.0） */
  readonly timezone: number;

  /** 用户所在地理位置 */
  readonly location: Location;

  /** 配置：早晚子时处理模式 */
  readonly ratHourMode: RatHourMode;

  /** 是否开启子时拆分 */
  get splitByRatHour(): boolean {
    return this.ratHourMode !== RatHourMode.noSplit;
  }

  constructor(options: {
    clockTime: AstroDateTime;
    solarTime: SolarTimeResult;
    virtualTime: AstroDateTime;
    utcTime: AstroDateTime;
    timezone: number;
    location: Location;
    ratHourMode: RatHourMode;
  }) {
    this.clockTime = options.clockTime;
    this.solarTime = options.solarTime;
    this.virtualTime = options.virtualTime;
    this.utcTime = options.utcTime;
    this.timezone = options.timezone;
    this.location = options.location;
    this.ratHourMode = options.ratHourMode;
  }

  // TODO: factory createBySolarTime 需要 calcTrueSolarTime 实现后才能补全
}
