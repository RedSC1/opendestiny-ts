/**
 * 日历聚合层
 *
 * 对标 sxwnl_spa_dart 的 calendar.dart
 * 底层星历返回 UT，本层负责：
 * - 时区转换（经度 → 地方时）
 * - 农历/节气/干支/节日聚合
 * - 按公历月/农历月/节气周期组织输出
 */

import AstroDateTime from '../utils/astro_date_time';
import type { GanZhi, BaZi } from './gan-zhi';
import { dayGanZhi, yearGanZhi, diZhiToShengXiao } from './gan-zhi';
import type { SolarTermResult } from './jie-qi';
import { yearSolarTerms, solarTermNames, prevJieFromJd, nextJieFromJd } from './jie-qi';
import { arrangeHistoricalLunarYear } from '../historical/lunar-year';
import { Precision } from '../ephemeris/adapters/precision';
import { sunEclipticLongitude } from '../ephemeris/adapters/sun';
import { deltaTDays } from '../ephemeris/delta-t';
import { lunarPhase, moonPhaseNames4 } from './shuo-wang';
import { calcTrueSolarTime } from '../sxwnl/true_solar_time';
import { Location } from '../models/location';
import { PolarStatus } from '../enums/polar-status';
import { LunarDate, type LunarDateOptions } from './lunar-date';

// ============ 时区工具 ============

/** 默认经度：东经 120°（北京时间） */
export const DEFAULT_LONGITUDE = 120;

/**
 * 经度 → 时区偏移（小时）。
 * 北京 120°E → 0h；越南 105°E → +1h；日本 135°E → -1h。
 * 含义：本地时间比北京时间晚多少小时（本地时间 = 北京时间 + offset）。
 * 正数表示本地太阳时晚于北京（更西），负数表示早于北京（更东）。
 */
export function longitudeToOffsetHours(longitude: number): number {
  return (120 - longitude) / 15;
}

/**
 * UT JD → 地方时 JD。
 * @param jdUT J2000 相对儒略日（UT）
 * @param longitude 经度（默认 120）
 * @returns 地方时 JD（仍相对于 J2000）
 */
export function utToLocalJd(jdUT: number, longitude: number = DEFAULT_LONGITUDE): number {
  return jdUT + longitude / 15 / 24;
}

// ============ 节日系统（占位，后续扩展） ============

export enum FestivalLevel {
  statutory = 'statutory',
  traditional = 'traditional',
  popular = 'popular',
  minor = 'minor',
}

export enum FestivalSource {
  solar = 'solar',
  lunar = 'lunar',
  solarTerm = 'solarTerm',
  custom = 'custom',
}

export interface Festival {
  readonly name: string;
  readonly level: FestivalLevel;
  readonly source: FestivalSource;
}

// ============ 单日信息 ============

/** 单日完整信息（已转换为目标经度的地方时） */
export interface DayInfo {
  readonly solarDate: AstroDateTime;
  readonly lunarDate: LunarDate;
  readonly weekday: number;
  readonly ganZhi: GanZhi;
  readonly baZi?: BaZi;
  readonly solarTerm: string | null;
  readonly solarTermTime: AstroDateTime | null;
  readonly moonPhase: string | null;
  readonly moonPhaseTime: AstroDateTime | null;
  readonly constellation: string | null;
  readonly festivals: readonly Festival[];
  readonly polarStatus: PolarStatus;
  /** 日出时刻（地方时），未传 location 时为 null */
  readonly sunrise: AstroDateTime | null;
  /** 日落时刻（地方时），未传 location 时为 null */
  readonly sunset: AstroDateTime | null;
}

// ============ 年份信息 ============

export interface YearInfo {
  readonly year: number;
  readonly ganZhi: GanZhi;
  readonly shengXiao: string;
}

// ============ 日历查询选项 ============

export interface CalendarOptions {
  /** 目标经度（默认 120，即北京时间）。决定节气/朔望显示的地方时。 */
  longitude?: number;
  /** 地理位置（用于日出日落计算） */
  location?: { longitude: number; latitude: number };
  /** 是否使用历史节气修正（古历还原） */
  useHistoricalSolarTerms?: boolean;
  /** 是否计算八字 */
  includeBaZi?: boolean;
  /** 是否分早子时/晚子时 */
  splitRatHour?: boolean;
}

// ============ 内部辅助 ============

/** 日序号：正午 UT 的整 JD */
function _dayId(year: number, month: number, day: number): number {
  return Math.floor(new AstroDateTime(year, month, day, 12, 0, 0).toJ2000());
}

/** AstroDateTime → 日序号 */
function _astroDayId(d: AstroDateTime): number {
  return _dayId(d.year, d.month, d.day);
}

/** 节气条目 */
interface _JieQiEntry {
  name: string;
  time: AstroDateTime;
}

// ============ 黄道十二宫 ============

/** 黄道十二宫中文名（按太阳黄经 0°=白羊 起始） */
const _zodiacNames: readonly string[] = [
  '白羊', '金牛', '双子', '巨蟹', '狮子', '处女',
  '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼',
];

/**
 * 获取指定 UT 时刻太阳所在的黄道星座名。
 * @param jdUT J2000 相对儒略日（UT）
 */
export function getZodiacSign(jdUT: number): string {
  const ttJd = jdUT + deltaTDays(jdUT);
  const lon = sunEclipticLongitude(ttJd, Precision.Low);
  const idx = Math.floor(((lon % 360) + 360) % 360 / 30);
  return `${_zodiacNames[idx]!}座`;
}

// ============ 月相预计算 ============

/** 月相条目 */
interface _MoonPhaseEntry {
  name: string;
  time: AstroDateTime;
}

/** 月相 slot 步长（π/2 弧度 = 90°，对应朔→上弦→望→下弦） */
const _PHASE_SLOT_RAD = Math.PI / 2;
/** 平均朔望月（天） */
const _SYNODIC_MONTH = 29.5306;
/** J2000 附近首个朔的近似偏移（天） */
const _FIRST_SHUO_OFFSET = 8;

/**
 * 预计算日期范围内的所有月相（朔/上弦/望/下弦），
 * 按地方时日序号建表供逐日 O(1) 查询。
 */
function _buildMoonPhaseMap(
  minUtJd: number,
  maxUtJd: number,
  longitude: number,
): Map<number, _MoonPhaseEntry> {
  const map = new Map<number, _MoonPhaseEntry>();

  let slot = Math.floor((minUtJd + _FIRST_SHUO_OFFSET) / (_SYNODIC_MONTH / 4)) - 2;

  while (true) {
    const jd = lunarPhase(slot * _PHASE_SLOT_RAD, Precision.Low);
    if (jd > maxUtJd + 1) break;

    if (jd >= minUtJd - 1) {
      const localJd = utToLocalJd(jd, longitude);
      const localDay = Math.floor(localJd + 0.5);
      const phaseIndex = ((slot % 4) + 4) % 4;
      map.set(localDay, {
        name: moonPhaseNames4[phaseIndex]!,
        time: AstroDateTime.fromJ2000(localJd),
      });
    }
    slot++;
  }

  return map;
}

// ============ 核心 API：逐日查询 ============

/**
 * 获取日期范围内每一天的日历详细信息。
 *
 * @param start 起始日期（本地历法时间）
 * @param end 结束日期（本地历法时间，包含）
 * @param options 可选配置
 * @returns DayInfo 数组（已按指定经度转换地方时）
 */
export function getDayRange(
  start: AstroDateTime,
  end: AstroDateTime,
  options?: CalendarOptions,
): DayInfo[] {
  const longitude = options?.longitude ?? DEFAULT_LONGITUDE;
  const hasLocation = options?.location !== undefined;

  // ---- 预计算节气表（覆盖所有相关年份） ----
  const jieqiMap = new Map<number, _JieQiEntry>();
  const minYear = start.year - 1;
  const maxYear = end.year + 1;

  for (let y = minYear; y <= maxYear; y++) {
    try {
      const terms = yearSolarTerms(y, Precision.Low);
      for (const term of terms) {
        const localJd = utToLocalJd(term.jd, longitude);
        const localDay = Math.floor(localJd + 0.5);
        jieqiMap.set(localDay, { name: term.name, time: AstroDateTime.fromJ2000(localJd) });
      }
    } catch {
      // 现代天文算法对远古日期可能不收敛，历史模式下忽略即可
    }
  }

  // ---- 预计算历史节气表（对标 Dart useHistoricalSolarTerms 路径） ----
  const useHistorical = options?.useHistoricalSolarTerms === true;
  const histJqMap = new Map<number, _JieQiEntry>();
  if (useHistorical) {
    for (let y = minYear; y <= maxYear; y++) {
      const histYear = arrangeHistoricalLunarYear(
        new AstroDateTime(y, 6, 1).toJ2000(),
      );
      for (let k = 0; k < 25; k++) {
        const bjtDay = histYear.solarTerms[k]!;
        const mappedIndex = (k + 23) % 24;
        const name = solarTermNames[mappedIndex]!;
        histJqMap.set(bjtDay, { name, time: AstroDateTime.fromJ2000(bjtDay) });
      }
    }
  }

  // ---- 预计算月相表 ----
  const moonPhaseMap = _buildMoonPhaseMap(
    start.toJ2000(),
    end.toJ2000(),
    longitude,
  );

  // ---- 逐日遍历 ----
  const result: DayInfo[] = [];
  const oneDayMs = 86400000;
  const endDayId = _astroDayId(end);
  const timezone = longitude / 15;
  const location = hasLocation
    ? new Location(options.location!.longitude, options.location!.latitude)
    : undefined;

  const lunarOptions: LunarDateOptions = { longitude };
  if (options?.useHistoricalSolarTerms !== undefined) {
    lunarOptions.useHistorical = options.useHistoricalSolarTerms;
  }

  let current = new AstroDateTime(start.year, start.month, start.day);

  while (true) {
    const dayId = _astroDayId(current);
    if (dayId > endDayId) break;

    const lunarDate = LunarDate.fromSolar(current, lunarOptions);
    const gz = dayGanZhi(current);
    const mp = moonPhaseMap.get(dayId);

    // 节气名与时刻：历史模式取修正后的节气名，再搜现代表取精确时刻
    let solarTermName: string | null = null;
    let solarTermTime: AstroDateTime | null = null;
    if (useHistorical) {
      const histJq = histJqMap.get(dayId);
      if (histJq) {
        solarTermName = histJq.name;
        for (let offset = -3; offset <= 3; offset++) {
          const candidate = jieqiMap.get(dayId + offset);
          if (candidate?.name === solarTermName) {
            solarTermTime = candidate.time;
            break;
          }
        }
      }
    } else {
      const jq = jieqiMap.get(dayId);
      solarTermName = jq?.name ?? null;
      solarTermTime = jq?.time ?? null;
    }

    // 日出日落
    let sunrise: AstroDateTime | null = null;
    let sunset: AstroDateTime | null = null;
    let polarStatus = PolarStatus.none;
    if (location) {
      const st = calcTrueSolarTime(current, location, timezone);
      sunrise = st.sunrise;
      sunset = st.sunset;
      polarStatus = st.polarStatus;
    }

    result.push({
      solarDate: current,
      lunarDate,
      weekday: current.weekday,
      ganZhi: gz,
      solarTerm: solarTermName,
      solarTermTime,
      moonPhase: mp?.name ?? null,
      moonPhaseTime: mp?.time ?? null,
      constellation: getZodiacSign(current.toJ2000()),
      festivals: [],
      polarStatus,
      sunrise,
      sunset,
    });

    current = current.add(oneDayMs);
  }

  return result;
}

// ============ 按月查询 ============

/**
 * 获取指定公历月的每日详细信息。
 */
export function getSolarMonthDays(
  year: number,
  month: number,
  options?: CalendarOptions,
): DayInfo[] {
  const start = new AstroDateTime(year, month, 1);
  const nextMonth = month === 12
    ? new AstroDateTime(year + 1, 1, 1)
    : new AstroDateTime(year, month + 1, 1);
  const end = AstroDateTime.fromJ2000(nextMonth.toJ2000() - 1 / 86400);
  return getDayRange(start, end, options);
}

/**
 * 获取指定农历月的每日详细信息。
 */
export function getLunarMonthDays(
  lunarYear: number,
  monthName: string,
  options?: CalendarOptions,
): DayInfo[] {
  const longitude = options?.longitude ?? DEFAULT_LONGITUDE;

  const fromStringOpts: LunarDateOptions = { longitude };
  if (options?.useHistoricalSolarTerms !== undefined) {
    fromStringOpts.useHistorical = options.useHistoricalSolarTerms;
  }
  const lunarDate = LunarDate.fromString(lunarYear, monthName, 1, fromStringOpts);

  const start = lunarDate.toSolar;
  const end = AstroDateTime.fromJ2000(start.toJ2000() + lunarDate.monthSize - 1);

  return getDayRange(start, end, options);
}

/**
 * 获取指定节气周期内的每日详细信息（从目标日期所在"节"到下一个"节"）。
 */
export function getJieQiPeriodDays(
  date: AstroDateTime,
  options?: CalendarOptions,
): DayInfo[] {
  const longitude = options?.longitude ?? DEFAULT_LONGITUDE;
  const localJd = utToLocalJd(date.toJ2000(), longitude);

  // jie-qi 函数返回 UT JD，需转为地方时确定日历日期
  const prev = prevJieFromJd(localJd, Precision.Low);
  const next = nextJieFromJd(prev.jd + 1 / 86400, Precision.Low);

  const prevLocalJd = utToLocalJd(prev.jd, longitude);
  const nextLocalJd = utToLocalJd(next.jd, longitude);

  // 起始日：prev jie 所在的日历日
  const startDay = Math.floor(prevLocalJd + 0.5);
  // 结束日：next jie 所在日历日的前一天
  const endDay = Math.floor(nextLocalJd + 0.5) - 1;

  return getDayRange(
    AstroDateTime.fromJ2000(startDay),
    AstroDateTime.fromJ2000(endDay),
    options,
  );
}

// ============ 年份查询 ============

export function getYearInfo(year: number): YearInfo {
  const gz = yearGanZhi(year);
  return { year, ganZhi: gz, shengXiao: diZhiToShengXiao(gz.zhi) };
}

export function getYearRangeInfo(startYear: number, endYear: number): YearInfo[] {
  const result: YearInfo[] = [];
  for (let y = startYear; y <= endYear; y++) {
    result.push(getYearInfo(y));
  }
  return result;
}
