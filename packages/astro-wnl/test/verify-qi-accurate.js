/**
 * 验证 solarTerm Newton 迭代在不同年份的收敛情况
 */

const { solarTerm, specificSolarTerm } = require('../dist/core/jie-qi');

function testQiAccurate(year, n, expectedMonth, expectedDay) {
  try {
    const jd = specificSolarTerm(year, n);
    const AstroDateTime = require('../dist/utils/astro_date_time').default;
    const dt = AstroDateTime.fromJ2000(jd);
    console.log(
      `Year ${year} n=${n}: ${dt.toString()} (JD=${jd.toFixed(5)})`
    );
    return true;
  } catch (e) {
    console.log(`Year ${year} n=${n}: FAILED - ${e.message}`);
    return false;
  }
}

console.log('=== 现代 ===');
testQiAccurate(2024, 0);   // 春分
testQiAccurate(2024, 6);   // 夏至
testQiAccurate(2024, 12);  // 秋分
testQiAccurate(2024, 18);  // 冬至

console.log('\n=== 近代 ===');
testQiAccurate(1900, 0);
testQiAccurate(1800, 0);

console.log('\n=== 古代 ===');
testQiAccurate(1000, 0);
testQiAccurate(0, 0);
testQiAccurate(-500, 0);
testQiAccurate(-1000, 0);
testQiAccurate(-2000, 0);

console.log('\n=== 远期 ===');
testQiAccurate(3000, 0);

console.log('\n=== 全年25节气（2024）===');
const { yearSolarTerms } = require('../dist/core/jie-qi');
try {
  const results = yearSolarTerms(2024);
  results.forEach((r, i) => {
    console.log(`  ${i}: ${r.name} ${r.dateTime.toString()} (JD=${r.jd.toFixed(5)})`);
  });
} catch (e) {
  console.log(`yearSolarTerms(2024) FAILED: ${e.message}`);
}
