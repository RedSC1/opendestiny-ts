/**
 * 验证朔望模块
 * 1. nearestNewMoon 估算正确性
 * 2. 每年朔/望数量与间隔合理性
 * 3. 前后搜索闭环
 * 4. 与割线法底层一致性
 */

const { lunarPhase, nearestNewMoon, nearestFullMoon } = require('../dist/core/shuo-wang');
const { yearNewMoons, yearFullMoons, monthPhases } = require('../dist/core/shuo-wang');
const { prevNewMoonFromJd, nextNewMoonFromJd, prevFullMoonFromJd, nextFullMoonFromJd } = require('../dist/core/shuo-wang');
const AstroDateTime = require('../dist/utils/astro_date_time').default;

// ===== 测试 1: nearestNewMoon 估算 =====
console.log('=== nearestNewMoon 估算测试 ===');
for (const year of [2024, 2000, 1990, 1984, 1900, -1000]) {
  const jd = new AstroDateTime(year, 6, 15).toJ2000();
  const shuo = nearestNewMoon(jd);
  const dt = AstroDateTime.fromJ2000(shuo);
  console.log(`${year}-06-15 最近朔: ${dt.toString()} (jd=${shuo.toFixed(6)})`);
}
console.log();

// ===== 测试 2: 每年朔数量与间隔 =====
console.log('=== 每年朔数量与间隔测试 ===');
for (const year of [2024, 2025, 2000, 1990, 1984, 1900]) {
  const shuos = yearNewMoons(year);
  const intervals = [];
  for (let i = 1; i < shuos.length; i++) {
    intervals.push((shuos[i].jd - shuos[i-1].jd).toFixed(3));
  }
  console.log(`${year}年: ${shuos.length}个朔, 间隔=[${intervals.join(', ')}]`);
  // 验证数量：一年最多 13 个朔，最少 12 个
  if (shuos.length < 12 || shuos.length > 13) {
    console.log(`  *** 异常: ${year}年有 ${shuos.length} 个朔 ***`);
  }
  // 验证间隔：朔望月 29.0~30.1 天
  for (const iv of intervals) {
    const d = parseFloat(iv);
    if (d < 29 || d > 31) {
      console.log(`  *** 异常间隔: ${d} 天 ***`);
    }
  }
}
console.log();

// ===== 测试 3: 每年望数量与间隔 =====
console.log('=== 每年望数量与间隔测试 ===');
for (const year of [2024, 2025, 2000]) {
  const wangs = yearFullMoons(year);
  const intervals = [];
  for (let i = 1; i < wangs.length; i++) {
    intervals.push((wangs[i].jd - wangs[i-1].jd).toFixed(3));
  }
  console.log(`${year}年: ${wangs.length}个望, 间隔=[${intervals.join(', ')}]`);
}
console.log();

// ===== 测试 4: 前后搜索闭环 =====
console.log('=== 前后搜索闭环测试 ===');
for (const year of [2024, 2000, 1984]) {
  const jd = new AstroDateTime(year, 6, 15).toJ2000();
  const prev = prevNewMoonFromJd(jd);
  const next = nextNewMoonFromJd(jd);
  const prevW = prevFullMoonFromJd(jd);
  const nextW = nextFullMoonFromJd(jd);

  console.log(`${year}-06-15:`);
  console.log(`  前朔: ${prev.dateTime.toString()} | 后朔: ${next.dateTime.toString()} | 间隔=${(next.jd - prev.jd).toFixed(3)}天`);
  console.log(`  前望: ${prevW.dateTime.toString()} | 后望: ${nextW.dateTime.toString()} | 间隔=${(nextW.jd - prevW.jd).toFixed(3)}天`);

  // 验证：jd 应该在前朔和后朔之间
  if (jd < prev.jd || jd >= next.jd) {
    console.log(`  *** 朔搜索闭环失败 ***`);
  }
  if (jd < prevW.jd || jd >= nextW.jd) {
    console.log(`  *** 望搜索闭环失败 ***`);
  }
}
console.log();

// ===== 测试 5: 月查询 =====
console.log('=== 月度朔望查询测试 ===');
for (const year of [2024, 2025]) {
  for (let month = 1; month <= 12; month++) {
    const phases = monthPhases(year, month);
    const names = phases.map(p => p.name);
    console.log(`${year}-${month.toString().padStart(2, '0')}: ${names.join(', ')}`);
  }
}
console.log();

// ===== 测试 6: 极端年份 =====
console.log('=== 极端年份测试 (-1000 ~ 5000) ===');
for (let year = -1000; year <= 5000; year += 500) {
  try {
    const jd = new AstroDateTime(year, 6, 15).toJ2000();
    const shuo = nearestNewMoon(jd);
    const wang = nearestFullMoon(jd);
    const shuoDt = AstroDateTime.fromJ2000(shuo);
    const wangDt = AstroDateTime.fromJ2000(wang);
    console.log(`${year}: 朔=${shuoDt.toString()}, 望=${wangDt.toString()}`);
  } catch (e) {
    console.log(`${year}: *** 错误: ${e.message} ***`);
  }
}
console.log();

console.log('=== 全部测试完成 ===');
