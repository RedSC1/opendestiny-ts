/**
 * 真太阳时计算结果
 */
import AstroDateTime from '../utils/astro_date_time';
import { PolarStatus } from '../enums/polar-status';

export interface SolarTimeResult {
  /** 真太阳时 */
  readonly trueSolarTime: AstroDateTime;

  /** 均时差（Equation of Time），单位：小时 */
  readonly equationOfTime: number;

  /** 当日的日上中天时刻（标准时区时间） */
  readonly solarNoon: AstroDateTime;

  /** 当日日出时刻（标准时区时间），null 表示极夜 */
  readonly sunrise: AstroDateTime | null;

  /** 当日日落时刻（标准时区时间），null 表示极昼 */
  readonly sunset: AstroDateTime | null;

  /** 极地状态 */
  readonly polarStatus: PolarStatus;
}
