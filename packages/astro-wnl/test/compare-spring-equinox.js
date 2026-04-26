/**
 * 输出 astro-wnl 计算的春分时间（UT，-1000 ~ 5000，步长 100）
 * 格式: CSV，便于和 sxwnl_dart 对比
 */

const { searchSolarTermNewtonWithEstimate } = require('../dist/ephemeris/adapters');
const AstroDateTime = require('../dist/utils/astro_date_time').default;

console.log('year,ut_datetime,ut_jd');

for (let year = -1000; year <= 5000; year += 100) {
  try {
    const jdApprox = new AstroDateTime(year, 3, 15).toJ2000();
    const jdUt = searchSolarTermNewtonWithEstimate(0, jdApprox);
    const dtUt = AstroDateTime.fromJ2000(jdUt);
    console.log(`${year},"${dtUt.toString()}",${jdUt.toFixed(6)}`);
  } catch (e) {
    console.log(`${year},ERROR,ERROR`);
  }
}
