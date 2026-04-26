/**
 * 对比 astro-wnl 和 sxwnl_dart 的春分时间差异
 * 读取两个 CSV 输出，计算 UT 差异（秒）
 */

const fs = require('fs');

// 解析 CSV
function parseCsv(path) {
  const lines = fs.readFileSync(path, 'utf-8').trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace('\r', ''));
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace('\r', ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.replace(/^"|"$/g, '') || cols[idx];
    });
    data.push(row);
  }
  return data;
}

// sxwnl_dart 数据（需要提取 UT_JD）
const sxwnlData = parseCsv('J:\\ziwei_core_v2\\sxwnl_dart\\bin\\compare_spring_equinox_output.csv');
// astro-wnl 数据
const astroData = parseCsv('J:\\ziwei_core_v2\\opendestiny-ts\\packages\\astro-wnl\\test\\compare-spring-equinox-output.csv');

console.log('=== 春分时间差异对比 (astro-wnl - sxwnl_dart) ===');
console.log('year | astro-wnl UT JD      | sxwnl_dart UT JD     | diff (days) | diff (seconds)');
console.log('-'.repeat(95));

let maxDiffSec = 0;
let maxDiffYear = 0;

for (let i = 0; i < astroData.length; i++) {
  const year = astroData[i].year;
  const astroJd = parseFloat(astroData[i].ut_jd);
  const sxwnlJd = parseFloat(sxwnlData[i]?.ut_jd || '0');

  if (isNaN(astroJd) || isNaN(sxwnlJd)) {
    console.log(`${year} | 数据缺失`);
    continue;
  }

  const diffDays = astroJd - sxwnlJd;
  const diffSec = diffDays * 86400;

  if (Math.abs(diffSec) > Math.abs(maxDiffSec)) {
    maxDiffSec = diffSec;
    maxDiffYear = year;
  }

  const marker = Math.abs(diffSec) > 10 ? ' ***' : '';
  console.log(
    `${year.toString().padStart(4)} | ` +
    `${astroJd.toFixed(6).padStart(20)} | ` +
    `${sxwnlJd.toFixed(6).padStart(20)} | ` +
    `${diffDays.toFixed(6).padStart(11)} | ` +
    `${diffSec.toFixed(3).padStart(14)}${marker}`
  );
}

console.log('-'.repeat(95));
console.log(`最大差异: ${maxDiffYear}年, ${maxDiffSec.toFixed(3)}秒`);
console.log(`\n说明: astro-wnl 使用真黄道(Astronomy Engine), sxwnl_dart 使用动力学黄道(VSOP87)`);
console.log(`差异来源: 岁差模型 + 黄道坐标系定义 + 章动处理`);
