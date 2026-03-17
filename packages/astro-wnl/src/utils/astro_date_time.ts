/**
 * 支持公元前的天文日期时间类。
 *
 * `year` 采用天文纪年（Astronomical Year Numbering）：
 *   1 = 公元1年, 0 = 公元前1年, -1 = 公元前2年, ...
 *
 * 构造函数签名与原生习惯保持一致，方便迁移：
 *   `new AstroDateTime(year, month, day, hour, minute, second)`
 *
 * 内部通过儒略日（Julian Day）进行日期运算，
 * 所有天文/历法计算均基于 J2000.0 相对儒略日。
 */
class AstroDateTime {
    /** 天文纪年年份（有0年：0 = 公元前1年） */
    readonly year: number;

    /** 月 (1-12) */
    readonly month: number;

    /** 日 (1-31) */
    readonly day: number;

    /** 时 (0-23) */
    readonly hour: number;

    /** 分 (0-59) */
    readonly minute: number;

    /** 秒 (0-59) */
    readonly second: number;

    /** 构造函数，参数顺序与原生 Date 一致。 */
    constructor(
        year: number,
        month: number = 1,
        day: number = 1,
        hour: number = 0,
        minute: number = 0,
        second: number = 0,
    ) {
        this.year = year;
        this.month = month;
        this.day = day;
        this.hour = hour;
        this.minute = minute;
        this.second = second;
    }

    // --------------- 与 Date 兼容的属性 ---------------

    /** 是否公元前 */
    get isBCE(): boolean {
        return this.year <= 0;
    }

    /**
     * 公元前的传统纪年（公元前1年 → 1, 公元前2年 → 2）。
     * 公元后返回 null。
     */
    get bceYear(): number | null {
        return this.isBCE ? 1 - this.year : null;
    }

    /** 星期几 (1 = Monday, 7 = Sunday)，与 Dart DateTime.weekday 一致。 */
    get weekday(): number {
        // 从儒略日计算星期
        const jd = this.toJulianDay();
        // JD 0 是星期一，JD 的小数部分从正午开始
        // 标准公式：(floor(JD + 1.5)) mod 7 → 0=Mon, 1=Tue, ..., 6=Sun
        const w = ((Math.floor(jd + 1.5) % 7) + 7) % 7;
        // 转为 1=Mon ~ 7=Sun
        return w === 0 ? 7 : w;
    }
    // --------------- 核心：儒略日转换 ---------------

    /** 绝对儒略日常量 J2000.0 = 2451545.0 (2000-01-01 12:00 TT) */
    static readonly j2000: number = 2451545.0;

    /**
     * ### 转为绝对儒略日 (JD)
     *
     * 基于 Jean Meeus 标准算法，将当前历法时间转换为绝对儒略日。
     *
     * **历法切换逻辑：**
     * * **格里历 (Gregorian)**：1582-10-15 及之后。
     * * **儒略历 (Julian)**：1582-10-15 之前。
     *
     * **注意：**
     * 本方法仅执行数学转换，不包含时区或 ΔT 修正。
     * 若当前对象表示的是北京时间，则返回的也是北京时间标尺下的 JD。
     */
    toJulianDay(): number {
        return AstroDateTime._gregorianToJD(
            this.year, this.month, this.day,
            this.hour, this.minute, this.second
        );
    }

    /**
     * ### 转为 J2000.0 相对天数
     *
     * 计算相对于历元 J2000.0 (2000-01-01 12:00:00) 的偏移天数。
     *
     * **核心用途：**
     * 此结果是 sxwnl（如行星摄动、定气定朔）的标准输入格式。
     *
     * **换算关系：**
     * `j2kDays = absoluteJD - 2451545.0`
     */
    toJ2000(): number {
        return this.toJulianDay() - AstroDateTime.j2000;
    }

    /**
     * 从绝对儒略日 (JD) 构造历法时间。
     *
     * **核心逻辑：**
     * * **时区/标尺中立**：不包含时区偏移或ΔT (TT-UT1) 修正。输入是什么标尺（TT/UT1/UTC等），解析出的就是什么标尺。
     * * **天文学纪年法**：包含公元 0 年。
     *   * `year > 0`：公元纪年（如 2026 = AD 2026）。
     *   * `year == 0`：公元前 1 年 (1 BC)。
     *   * `year < 0`：公元前 |year| + 1 年（例: -1 = 2 BC）。
     * * **UI 注意事项**：展示古代年份时，前端需自行处理 `year <= 0` 的平移逻辑。
     */
    static fromJulianDay(jd: number): AstroDateTime {
        return AstroDateTime._jdToGregorian(jd);
    }

    /**
     * 从 J2000.0 相对天数构造历法时间。
     *
     * **核心逻辑：**
     * * **历元基准**：J2000.0 对应绝对儒略日 `2451545.0` (2000-01-01 12:00:00)。
     * * **单位限制**：入参 `j2k` 必须是**天数 (Days)**。
     * * **避坑指南**：此接口仅接收天数，切勿传入星历公式中常用的儒略世纪数 (T)。
     */
    static fromJ2000(j2k: number): AstroDateTime {
        return AstroDateTime._jdToGregorian(j2k + AstroDateTime.j2000);
    }
    // --------------- 与 JS Date 互转 ---------------

    /** 从 JS Date 构造（现代日期的便捷入口）。 */
    public static fromJSDate(dt: Date): AstroDateTime {
        return new AstroDateTime(
            dt.getFullYear(),
            dt.getMonth() + 1,
            dt.getDate(),
            dt.getHours(),
            dt.getMinutes(),
            dt.getSeconds()
        );
    }

    /**
     * 转为 JS Date。
     *
     * 如果日期在公元前（isBCE == true），返回 null，
     * 因为 JS 的 Date 不支持公元前。
     */
    public toJSDate(): Date | null {
        if (this.isBCE) return null;

        const d = new Date(this.year, this.month - 1, this.day, this.hour, this.minute, this.second);

        // 修正 0-99 年的 JS 遗留 Bug
        if (this.year >= 0 && this.year <= 99) {
            d.setFullYear(this.year);
        }

        return d;
    }

    // --------------- 运算 ---------------

    /**
     * 加上一段时间（毫秒），返回新的 AstroDateTime。
     *
     * 内部通过儒略日运算，天然支持跨公元前后。
     */
    add(durationMs: number): AstroDateTime {
        const jd = this.toJulianDay() + durationMs / 86400000.0;
        return AstroDateTime.fromJulianDay(jd);
    }

    /** 减去一段时间（毫秒），返回新的 AstroDateTime。 */
    subtract(durationMs: number): AstroDateTime {
        return this.add(-durationMs);
    }

    /** 两个日期之间的时间差，返回毫秒数。 */
    difference(other: AstroDateTime): number {
        const diffDays = this.toJulianDay() - other.toJulianDay();
        return Math.round(diffDays * 86400000);
    }

    /** 是否在 other 之后。 */
    isAfter(other: AstroDateTime): boolean {
        return this.toJulianDay() > other.toJulianDay();
    }

    /** 是否在 other 之前。 */
    isBefore(other: AstroDateTime): boolean {
        return this.toJulianDay() < other.toJulianDay();
    }

    // --------------- Comparable / Object ---------------

    compareTo(other: AstroDateTime): number {
        const diff = this.toJulianDay() - other.toJulianDay();
        if (diff < 0) {
            return -1;
        }
        if (diff > 0) {
            return 1;
        }
        return 0;
    }

    equals(other: unknown): boolean {
        if (this === other) {
            return true;
        }
        return other instanceof AstroDateTime &&
            other.year === this.year &&
            other.month === this.month &&
            other.day === this.day &&
            other.hour === this.hour &&
            other.minute === this.minute &&
            other.second === this.second;
    }

    get hashCode(): number {
        let hash = 17;
        hash = hash * 31 + this.year;
        hash = hash * 31 + this.month;
        hash = hash * 31 + this.day;
        hash = hash * 31 + this.hour;
        hash = hash * 31 + this.minute;
        hash = hash * 31 + this.second;
        return hash | 0;
    }

    toString(): string {
        const y = this.isBCE ? `公元前${1 - this.year}` : `${this.year}`;
        const m = this.month.toString().padStart(2, '0');
        const d = this.day.toString().padStart(2, '0');
        return `${y}-${m}-${d} ${this.toTimeString()}`;
    }

    /** 获取时间部分的字符串 (HH:mm:ss) */
    toTimeString(): string {
        const h = this.hour.toString().padStart(2, '0');
        const mi = this.minute.toString().padStart(2, '0');
        const s = this.second.toString().padStart(2, '0');
        return `${h}:${mi}:${s}`;
    }

    // --------------- 内部：JD 转换算法 (Meeus) ---------------

    /**
     * 绝对儒略日 → 公历。
     *
     * 基于 Meeus 逆算法。
     */
    private static _jdToGregorian(jd: number): AstroDateTime {
        const jdRounded = Math.round(jd * 86400) / 86400.0;
        let jdShifted = jdRounded + 0.5;
        let z = Math.floor(jdShifted);
        let f = jdShifted - z;
        let totalSeconds = Math.round(f * 86400);
        if (totalSeconds >= 86400) {
            totalSeconds -= 86400;
            z += 1;
        } else if (totalSeconds < 0) {
            totalSeconds += 86400;
            z -= 1;
        }
        f = totalSeconds / 86400.0;

        let a: number;
        if (z < 2299161) {
            // 儒略历
            a = z;
        } else {
            // 格里历
            const alpha = Math.floor((z - 1867216.25) / 36524.25);
            a = z + 1 + alpha - Math.floor(alpha / 4);
        }

        const b = a + 1524;
        const c = Math.floor((b - 122.1) / 365.25);
        const d = Math.floor(365.25 * c);
        const e = Math.floor((b - d) / 30.6001);

        const dayFraction = b - d - Math.floor(30.6001 * e) + f;
        const day = Math.floor(dayFraction);

        const month = e < 14 ? e - 1 : e - 13;
        const year = month > 2 ? c - 4716 : c - 4715;

        const hour = Math.floor(totalSeconds / 3600);
        const minute = Math.floor((totalSeconds % 3600) / 60);
        const second = totalSeconds % 60;

        return new AstroDateTime(year, month, day, hour, minute, second);
    }

    /**
     * 公历 → 绝对儒略日。
     *
     * 基于 Jean Meeus《Astronomical Algorithms》标准算法。
     * 正确处理 Julian/Gregorian 历法切换（1582-10-15）。
     */
    private static _gregorianToJD(
        y: number, m: number, d: number,
        h: number, mi: number, s: number,
    ): number {
        const dayFraction = d + h / 24.0 + mi / 1440.0 + s / 86400.0;

        let year = y;
        let month = m;
        if (month <= 2) {
            year -= 1;
            month += 12;
        }

        // 判断是否在格里历生效之后（1582-10-15）
        // 使用线性比较避免多重条件
        const isGregorian = (y * 10000.0 + m * 100.0 + d) >= 15821015.0
            ? 1.0
            : 0.0;

        const a = Math.floor(year / 100);
        // 格里历修正项：格里历时 B = 2 - A + floor(A/4)，儒略历时 B = 0
        const b = isGregorian * (2 - a + Math.floor(a / 4));

        return Math.floor(365.25 * (year + 4716)) +
            Math.floor(30.6001 * (month + 1)) +
            dayFraction +
            b -
            1524.5;
    }
}

export default AstroDateTime;