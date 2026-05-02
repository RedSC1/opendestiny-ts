import { searchSolarTermNewtonWithEstimate, searchLunarPhase } from '../ephemeris/adapters/search';
import { Precision } from '../ephemeris/adapters/precision';
import { QI_CORRECTION_COUNT, QI_CORRECTION_DATA, FIRST_QI_JD, QI_PERIOD } from './qi_correction_table';
import {
  QI_ANCIENT_CORRECTION_COUNT,
  QI_ANCIENT_DATA,
  QI_ANCIENT_FIRST_JD,
  QI_ANCIENT_PERIOD,
  QI_ANCIENT_MAP,
} from './qi_ancient_correction_table';
import { SUO_CORRECTION_COUNT, SUO_CORRECTION_DATA, FIRST_SUO_JD, SUO_PERIOD, SUO_CORRECTION_MAP } from './suo_correction_table';

/** 3-bit 解码映射: 0=0, +1=1, -1=2, +2=3, -2=4, +3=5, +4=6 */
const QI_CORRECTION_MAP = [0, 1, -1, 2, -2, 3, 4, 0];

/**
 * 从历史修正表中解包第 index 个 3-bit 修正值
 */
function unpack3Bit(data: Uint8Array, index: number): number {
  const bitPos = index * 3;
  const byteIdx = Math.floor(bitPos / 8);
  const shift = 5 - (bitPos % 8);
  if (shift >= 0) {
    return (data[byteIdx]! >> shift) & 0x7;
  } else {
    const lowBits = (data[byteIdx]! & ((1 << (8 - (bitPos % 8))) - 1)) << (-shift);
    const highBits = data[byteIdx + 1]! >> (8 + shift);
    return (lowBits | highBits) & 0x7;
  }
}

/**
 * 计算节气修正表索引（统一入口）。
 *
 * 远古部分（-221 ~ 1645）：平气时代，用 QI_ANCIENT_FIRST_JD / QI_ANCIENT_PERIOD
 * 现代部分（1645 ~ 1960）：定气时代，用 FIRST_QI_JD / QI_PERIOD
 */
function getQiCorrectionIndex(jdApprox: number): { idx: number; isAncient: boolean } {
  // 远古部分：平气，间隔均匀，用 floor（jdApprox 设计在节气中间偏右）
  const ancientIdx = Math.floor((jdApprox - QI_ANCIENT_FIRST_JD) / QI_ANCIENT_PERIOD);
  if (ancientIdx >= 0 && ancientIdx < QI_ANCIENT_CORRECTION_COUNT) {
    return { idx: ancientIdx, isAncient: true };
  }
  // 现代部分：定气，间隔不均匀，用 floor（jdApprox 设计在节气中间偏右）+ 残差检查
  const modernIdx = Math.floor((jdApprox - FIRST_QI_JD) / QI_PERIOD);
  if (modernIdx >= 0 && modernIdx < QI_CORRECTION_COUNT) {
    const approx = FIRST_QI_JD + modernIdx * QI_PERIOD;
    if (Math.abs(jdApprox - approx) < QI_PERIOD * 0.6) {
      return { idx: modernIdx, isAncient: false };
    }
  }
  return { idx: -1, isAncient: false };
}

/**
 * 获取中国历史上的节气时刻（修正表范围：约 -221 BC ~ 1960 AD）。
 *
 * 策略：
 * - 远古时期（-221 ~ 1645）：平气拟合 + 校正表
 * - 近代（1645 ~ 1960）：VeryLow 定气搜索 + 校正表
 * - 超出修正表范围：直接返回 VeryLow 定气搜索结果
 *
 * @param targetLon 目标黄经（度），如 0=春分, 90=夏至, 180=秋分, 270=冬至
 * @param jdApprox  近似时刻（J2000 相对 UT），允许偏差数天
 * @returns 精确时刻（J2000 相对 UT 儒略日）
 */
export function getChineseHistoricalSolarTerm(
  targetLon: number,
  jdApprox: number,
): number {
  const { idx, isAncient } = getQiCorrectionIndex(jdApprox);

  if (isAncient) {
    // 远古：平气拟合 + 小校正表
    const approx = QI_ANCIENT_FIRST_JD + idx * QI_ANCIENT_PERIOD;
    const packed = unpack3Bit(QI_ANCIENT_DATA, idx);
    const correction = QI_ANCIENT_MAP[packed]!;
    return approx + correction;
  }

  if (idx >= 0) {
    // 近代：定气搜索 + 校正表
    const ourDate = searchSolarTermNewtonWithEstimate(targetLon, jdApprox, Precision.VeryLow);
    const packed = unpack3Bit(QI_CORRECTION_DATA, idx);
    const correction = QI_CORRECTION_MAP[packed]!;
    return ourDate + correction;
  }

  // 超出修正表范围，直接返回定气搜索结果
  return searchSolarTermNewtonWithEstimate(targetLon, jdApprox, Precision.VeryLow);
}

// ============ 朔日搜索 ============

/**
 * 计算朔日修正表索引。
 *
 * 索引参数 FIRST_SUO_JD / SUO_PERIOD 从 sxwnl 输出数据推导而来
 * （见 suo_correction_table.ts），不是硬编码的 sxwnl 内部常数。
 */
function getSuoCorrectionIndex(jdApprox: number): number {
  return Math.floor((jdApprox - FIRST_SUO_JD) / SUO_PERIOD);
}

/**
 * 获取中国历史上的朔日时刻（修正表范围：约 619 ~ 2002 年）。
 *
 * 策略：
 * 1. 用线性公式估算 jd 所在月份的朔日近似值
 * 2. 在 ±3 天窄窗口内用 Low 精度搜索朔日
 * 3. 查历史修正表，应用 ±0/1/2 天修正
 * 4. 超出修正表范围时，直接返回 Low 搜索结果（无校正）
 *
 * @param jd 任意时刻（J2000 相对 UT）
 * @returns 该时刻所在农历月份开始的确切朔日时刻（J2000 相对 UT 儒略日）
 */
export function getChineseHistoricalMonth(jd: number): number {
  // 阶段 1：用线性公式估算朔日
  const idx = getSuoCorrectionIndex(jd);
  const jdApprox = FIRST_SUO_JD + idx * SUO_PERIOD;

  // 阶段 2：Low 精度在窗口内搜索（远古时期误差可达 ±4 天）
  const ourDate = searchLunarPhase(0, jdApprox - 10, 20, Precision.Low);
  if (ourDate === null) {
    throw new Error(
      `getChineseHistoricalMonth: lunar phase search failed for jd=${jd.toFixed(2)}, ` +
        `jdApprox=${jdApprox.toFixed(2)}`,
    );
  }

  // 阶段 3：查历史修正表
  if (idx >= 0 && idx < SUO_CORRECTION_COUNT) {
    const packed = unpack3Bit(SUO_CORRECTION_DATA, idx);
    const correction = SUO_CORRECTION_MAP[packed]!;
    return ourDate + correction;
  }

  // 超出修正表范围，直接返回搜索结果
  return ourDate;
}
