const { getChineseHistoricalMonth } = require('../dist/historical/chinese-historical');

const suoDates = JSON.parse(
  require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', '..', '..', 'sxwnl_dart', 'suo_dates_merged.json'),
    'utf8'
  )
);

let pass = 0;
let fail = 0;
const failDetails = [];

for (let i = 0; i < suoDates.length; i++) {
  const monthStart = suoDates[i];
  const jd = monthStart + 15;
  const result = getChineseHistoricalMonth(jd);
  const diff = Math.round(monthStart - result);

  if (diff === 0) {
    pass++;
  } else {
    fail++;
    failDetails.push({ index: i, expected: monthStart, actual: result, diff });
    if (fail <= 5) {
      console.log(`FAIL index ${i}: expected=${monthStart}, actual=${result.toFixed(4)}, diff=${diff}`);
    }
  }

  if (i > 0 && i % 5000 === 0) {
    console.log(`Progress: ${i}/${suoDates.length}, pass=${pass}, fail=${fail}`);
  }
}

console.log(`\nFinal: ${pass} pass, ${fail} fail out of ${suoDates.length}`);
if (fail > 0) {
  console.log(`\nFirst 10 failures:`);
  for (const f of failDetails.slice(0, 10)) {
    console.log(`  Index ${f.index}: expected=${f.expected}, actual=${f.actual.toFixed(4)}, diff=${f.diff}`);
  }
}
