/**
 * 计算 -1000~5000 年每年所有朔的时刻（UT），输出 JSON 并计时。
 */

const fs = require('fs');
const { yearNewMoons } = require('../dist/core/shuo-wang');
const AstroDateTime = require('../dist/utils/astro_date_time').default;

const START_YEAR = -1000;
const END_YEAR = 5000;

console.log(`开始计算 ${START_YEAR}~${END_YEAR} 年所有朔...`);
const t0 = Date.now();

const allShuos = [];
let totalCount = 0;

for (let year = START_YEAR; year <= END_YEAR; year++) {
  const shuos = yearNewMoons(year);
  const jds = shuos.map(s => s.jd);
  allShuos.push(jds);
  totalCount += jds.length;

  if ((year - START_YEAR) % 500 === 0) {
    const elapsed = (Date.now() - t0) / 1000;
    const avg = elapsed / (year - START_YEAR + 1);
    const remaining = avg * (END_YEAR - year);
    console.log(
      `  ${year}: ${jds.length}个朔, ` +
      `累计${totalCount}个, ` +
      `已用${elapsed.toFixed(1)}s, ` +
      `预计还需${remaining.toFixed(1)}s`
    );
  }
}

const elapsed = (Date.now() - t0) / 1000;
console.log(`\n完成！总计 ${totalCount} 个朔, 耗时 ${elapsed.toFixed(2)} 秒`);
console.log(`平均每个朔 ${(elapsed / totalCount * 1000).toFixed(2)} ms`);

const output = {
  source: 'astro-wnl',
  startYear: START_YEAR,
  endYear: END_YEAR,
  shuos: allShuos,
};

fs.writeFileSync('test/all_shuo_astro_wnl.json', JSON.stringify(output));
console.log('结果已保存到 test/all_shuo_astro_wnl.json');
