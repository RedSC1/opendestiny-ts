/**
 * 验证 Med 精度定朔 vs High 精度
 * 1. 差异分布（秒）
 * 2. 跨日误判统计
 * 3. Med 精度性能
 */

const { nearestNewMoon } = require('../dist/core/shuo-wang');
const { Precision } = require('../dist/ephemeris/adapters/precision');
const AstroDateTime = require('../dist/utils/astro_date_time').default;

const START_YEAR = 1900;
const END_YEAR = 2100;

console.log(`对比 ${START_YEAR}~${END_YEAR} 年 Med vs High 精度定朔...\n`);

let maxDiffSec = 0;
let maxDiffYear = 0;
let totalDiffSec = 0;
let count = 0;
let crossDayErrors = 0; // Med 和 High 导致不同日期的数量

const t0 = Date.now();

for (let year = START_YEAR; year <= END_YEAR; year++) {
  for (let month = 1; month <= 12; month++) {
    // 每个月找一个朔来对比
    const jd = new AstroDateTime(year, month, 15).toJ2000();
    const jdMed = nearestNewMoon(jd, Precision.Medium);
    const jdHigh = nearestNewMoon(jd, Precision.High);

    const diffSec = Math.abs(jdMed - jdHigh) * 86400;
    totalDiffSec += diffSec;
    count++;

    if (diffSec > maxDiffSec) {
      maxDiffSec = diffSec;
      maxDiffYear = year;
    }

    // 检查是否跨日：UTC 日期是否不同
    const dtMed = AstroDateTime.fromJ2000(jdMed);
    const dtHigh = AstroDateTime.fromJ2000(jdHigh);
    if (dtMed.day !== dtHigh.day || dtMed.month !== dtHigh.month) {
      crossDayErrors++;
      console.log(`  跨日误判: ${year}-${month.toString().padStart(2, '0')}`);
      console.log(`    Med : ${dtMed.toString()}`);
      console.log(`    High: ${dtHigh.toString()}`);
    }
  }
}

const elapsed = Date.now() - t0;

console.log(`\n=== 统计结果 (${START_YEAR}~${END_YEAR}, ${count} 个朔) ===`);
console.log(`平均差异: ${(totalDiffSec / count).toFixed(4)} 秒`);
console.log(`最大差异: ${maxDiffSec.toFixed(4)} 秒 (${maxDiffYear}年)`);
console.log(`跨日误判: ${crossDayErrors} 次`);
console.log(`计算耗时: ${(elapsed / 1000).toFixed(2)} 秒`);
console.log(`平均每个朔: ${(elapsed / count).toFixed(2)} ms`);

// ===== 性能基准 =====
console.log('\n=== 性能基准 ===');

console.time('Med  x100');
for (let i = 0; i < 100; i++) {
  nearestNewMoon(i * 30, Precision.Medium);
}
console.timeEnd('Med  x100');

console.time('High x100');
for (let i = 0; i < 100; i++) {
  nearestNewMoon(i * 30, Precision.High);
}
console.timeEnd('High x100');

// ===== 全量 Med 速度测试 =====
console.log('\n=== 全量 Med yearNewMoons ===');
const { yearNewMoons } = require('../dist/core/shuo-wang');

console.time('yearNewMoons Med 2024');
yearNewMoons(2024, Precision.Medium);
console.timeEnd('yearNewMoons Med 2024');

console.time('yearNewMoons High 2024');
yearNewMoons(2024, Precision.High);
console.timeEnd('yearNewMoons High 2024');
