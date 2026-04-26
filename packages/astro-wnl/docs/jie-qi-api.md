# 节气模块 API 设计文档

> 本文件记录 `src/core/jie-qi.ts` 的完整 API，与 `sxwnl_spa_dart/lib/src/jie_qi.dart` 100% 对齐。
> 底层星历已就绪（`ephemeris/adapters/search.ts` + `sun.ts`），本层为包装聚合。

---

## 设计原则

1. **所有内部流转使用 UT（世界时）J2000 相对儒略日 `number`**，时区转换由上层 `calendar.ts` 处理。
2. **输入输出提供双轨**：`AstroDateTime` 版本（面向用户）+ `number`（JD）版本（面向内部/性能）。
3. **跟 dart 版本同名同参同行为**，不擅自扩展。

---

## 与 Dart 版本的核心差异

| 维度 | Dart 版本 `sxwnl_spa_dart` | 本 TypeScript 版本 |
|------|---------------------------|-------------------|
| **时间基准** | `JieQiResult.jd` 为 **北京时间**（东经 120° 地方时） | `JieQiResult.jd` 为 **UT（格林尼治时间 / 世界时）**，零时区 |
| **时区处理** | 底层计算后直接 `+8/24` 转为北京时间 | 底层计算保持 UT，时区转换推迟到 `calendar.ts` 或用户层 |
| **AstroDateTime** | `dateTime` 字段为北京时间 | `dateTime` 字段由 **UT 的 JD** 解析而来，仍为 UT 标尺 |
| **设计理由** | 日历库面向中国用户，默认北京时 | 星历层跟天文引擎对齐（VSOP87/ELP 输入输出均为 UT），上层按需转时区 |

> **重要**：本模块内所有 `jd` 参数/返回值、所有 `AstroDateTime` 对象，**均为 UT**。如果你需要北京时间，在 `calendar.ts` 层或调用方自行 `+ 8/24`。

---

## 常量

| 名称 | 类型 | 说明 | Dart 对应 |
|------|------|------|-----------|
| `jieQiNames` | `readonly string[]` | 24 节气名称，索引 0=小寒, 1=大寒, ..., 23=冬至 | `jieQiNames` |

---

## 工具函数

| 函数 | 参数 | 返回值 | 说明 | Dart 对应 |
|------|------|--------|------|-----------|
| `isJie(index)` | `number` | `boolean` | 索引是否为"节"（偶数索引：立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪、小寒） | `isJie` |
| `isQi(index)` | `number` | `boolean` | 索引是否为"气"/中气（奇数索引） | `isQi` |

---

## 类型定义

### `JieQiResult`

```typescript
interface JieQiResult {
  /** 在当年节气列表中的索引（0-23） */
  readonly index: number;
  /** 节气名称（如"立春"） */
  readonly name: string;
  /** J2000 相对儒略日（UT，世界时） */
  readonly jd: number;
  /** 对应的历法时间（由 jd 解析，仍为世界时标尺） */
  readonly dateTime: AstroDateTime;
}
```

**Dart 对应**：`JieQiResult`

---

### `SolarTermSpan`

```typescript
interface SolarTermSpan {
  readonly prev: JieQiResult;
  readonly next: JieQiResult;
  readonly daysSincePrev: number;
  readonly daysUntilNext: number;
  readonly totalDays: number;
  readonly progress: number;  // 0.0 ~ 1.0
}
```

**Dart 对应**：`SolarTermSpan`

---

### `JieDistance`

```typescript
interface JieDistance extends SolarTermSpan {
  readonly prevJie: JieQiResult;
  readonly nextJie: JieQiResult;
  readonly daysSincePrevJie: number;
  readonly daysUntilNextJie: number;
  readonly totalJieDays: number;
  readonly jieProgress: number;
}
```

**Dart 对应**：`JieDistance`

---

### `QiDistance`

```typescript
interface QiDistance extends SolarTermSpan {
  readonly prevQi: JieQiResult;
  readonly nextQi: JieQiResult;
  readonly daysSincePrevQi: number;
  readonly daysUntilNextQi: number;
  readonly totalQiDays: number;
  readonly qiProgress: number;
}
```

**Dart 对应**：`QiDistance`

---

### `JieQiInfo`

```typescript
interface JieQiInfo {
  readonly prevJieQi: JieQiResult;
  readonly nextJieQi: JieQiResult;
  readonly prevJie: JieQiResult;
  readonly nextJie: JieQiResult;
  readonly prevQi: JieQiResult;
  readonly nextQi: JieQiResult;
  readonly daysSincePrevJieQi: number;
  readonly daysUntilNextJieQi: number;
  readonly daysSincePrevJie: number;
  readonly daysUntilNextJie: number;
  readonly daysSincePrevQi: number;
  readonly daysUntilNextQi: number;
}
```

**Dart 对应**：`JieQiInfo`

---

## 核心定气计算（底层，返回 UT）

| 函数 | 参数 | 返回值 | 说明 | 依赖 | Dart 对应 |
|------|------|--------|------|------|-----------|
| `qiAccurate(w)` | `number`（累计弧度） | `number`（JD） | 已知太阳视黄经累计弧度，反推精确交节时刻。`w` 是累计值：0=1999年春分, 2π=2000年春分, 依此类推 | `searchSolarTerm` | `qiAccurate` |
| `qiAccurate2(jd)` | `number`（JD） | `number`（JD） | 智能定气搜索：给定JD附近自动寻找最近的一个精确节气时刻 | `qiAccurate` | `qiAccurate2` |
| `getSpecificJieQi(year, n)` | `year: number, n: 0-23` | `number`（JD） | 获取指定年份特定节气。n 以春分为 0 起点 | `qiAccurate` | `getSpecificJieQi` |

> **注**：`n` 的取值范围 0~23，其中 0~18 为当年春分→冬至，19~23 为次年小寒→惊蛰。

---

## 批量查询

| 函数 | 参数 | 返回值 | 说明 | 依赖 | Dart 对应 |
|------|------|--------|------|------|-----------|
| `getYearJieQi(year)` | `number` | `JieQiResult[]` | 全年 25 个节气（冬至到冬至，含首尾两个冬至） | `qiAccurate2` | `getYearJieQi` |
| `getYearJieQiJd(year)` | `number` | `number[]` | 全年 25 个节气的 Julian Day 数组 | `getYearJieQi` | `getYearJieQiJd` |

---

## 前后搜索（单点查询）

每个函数均提供 `AstroDateTime` 版本和 `number`（JD）版本。

### 任意节气

| 函数（AstroDateTime） | 函数（JD） | 参数 | 返回值 | 依赖 | Dart 对应 |
|----------------------|-----------|------|--------|------|-----------|
| `getPrevJieQi(target)` | `getPrevJieQiFromJd(jd)` | `AstroDateTime` / `number` | `JieQiResult \| null` | `qiAccurate2` | `getPrevJieQi` |
| `getNextJieQi(target)` | `getNextJieQiFromJd(jd)` | `AstroDateTime` / `number` | `JieQiResult \| null` | `qiAccurate2` | `getNextJieQi` |

### 仅"节"

| 函数（AstroDateTime） | 函数（JD） | 参数 | 返回值 | 依赖 | Dart 对应 |
|----------------------|-----------|------|--------|------|-----------|
| `getPrevJie(target)` | `getPrevJieFromJd(jd)` | `AstroDateTime` / `number` | `JieQiResult \| null` | `getPrevJieQi` + `isJie` | `getPrevJie` |
| `getNextJie(target)` | `getNextJieFromJd(jd)` | `AstroDateTime` / `number` | `JieQiResult \| null` | `getNextJieQi` + `isJie` | `getNextJie` |

### 仅"气"/中气

| 函数（AstroDateTime） | 函数（JD） | 参数 | 返回值 | 依赖 | Dart 对应 |
|----------------------|-----------|------|--------|------|-----------|
| `getPrevQi(target)` | `getPrevQiFromJd(jd)` | `AstroDateTime` / `number` | `JieQiResult \| null` | `getPrevJieQi` + `isQi` | `getPrevQi` |
| `getNextQi(target)` | `getNextQiFromJd(jd)` | `AstroDateTime` / `number` | `JieQiResult \| null` | `getNextJieQi` + `isQi` | `getNextQi` |

---

## 距离查询

| 函数（AstroDateTime） | 函数（JD） | 参数 | 返回值 | 依赖 | Dart 对应 |
|----------------------|-----------|------|--------|------|-----------|
| `getJieQiDistance(target)` | `getJieQiDistanceFromJd(jd)` | `AstroDateTime` / `number` | `JieDistance \| null` | `getPrevJieQi` + `getNextJieQi` | `getJieQiDistance` |
| `getJieDistance(target)` | `getJieDistanceFromJd(jd)` | `AstroDateTime` / `number` | `JieDistance \| null` | `getPrevJie` + `getNextJie` | `getJieDistance` |
| `getQiDistance(target)` | `getQiDistanceFromJd(jd)` | `AstroDateTime` / `number` | `QiDistance \| null` | `getPrevQi` + `getNextQi` | `getQiDistance` |

---

## 综合信息

| 函数 | 参数 | 返回值 | 说明 | 依赖 | Dart 对应 |
|------|------|--------|------|------|-----------|
| `getJieQiInfo(target)` | `AstroDateTime` | `JieQiInfo \| null` | 聚合当前时刻的前后节气、节、气的完整信息 | 所有前后搜 | `getJieQiInfo` |

---

## Julian Day 便捷接口

以下函数为 AstroDateTime 输入 → 仅返回 JD 数值的快捷方式：

| 函数 | 参数 | 返回值 | 依赖 |
|------|------|--------|------|
| `getPrevJieQiJd(target)` | `AstroDateTime` | `number \| null` | `getPrevJieQi` |
| `getNextJieQiJd(target)` | `AstroDateTime` | `number \| null` | `getNextJieQi` |
| `getPrevJieJd(target)` | `AstroDateTime` | `number \| null` | `getPrevJie` |
| `getNextJieJd(target)` | `AstroDateTime` | `number \| null` | `getNextJie` |
| `getPrevQiJd(target)` | `AstroDateTime` | `number \| null` | `getPrevQi` |
| `getNextQiJd(target)` | `AstroDateTime` | `number \| null` | `getNextQi` |

---

## 实现路线图（建议顺序）

```
Layer 0: 底层就绪（searchSolarTerm + sunEclipticLongitude）
    ↓
Layer 1: isJie / isQi — 2分钟
    ↓
Layer 2: qiAccurate(w) — 核心枢纽，调用 searchSolarTerm
    ↓
Layer 3: qiAccurate2(jd) / getSpecificJieQi — 基于 qiAccurate 包装
    ↓
Layer 4: getYearJieQi / getYearJieQiJd — 批量生成 25 个节气
    ↓
Layer 5: getPrevJieQi / getNextJieQi — 单点前后搜索
    ↓
Layer 6: getPrevJie / getNextJie / getPrevQi / getNextQi — 过滤版
    ↓
Layer 7: 距离查询 + JieQiInfo — 纯组合逻辑
    ↓
Layer 8: JD 便捷接口 — 一行代理
```

---

## 关键注意事项

1. **UT 时区**：所有 `jd` 字段均为 **UT（世界时）**，不含任何时区偏移。`AstroDateTime` 也由 UT JD 解析而来。
2. **累计弧度 `w`**：`qiAccurate` 的 `w` 不是 [0, 2π) 的归一化值，而是历史累计值。0=1999年春分，2π=2000年春分，4π=2001年春分，以此类推。需通过 `w / (2π) + 1999` 估算年份。
3. **25 个节气**：`getYearJieQi` 返回从 **上年冬至** 到 **当年冬至** 共 25 个节气（含两个冬至），用于农历月判定和干支年柱分界。
4. **精度**：底层搜索默认使用 **两阶段策略**（Low 粗搜 → High 精修），最终精度可达秒级。
