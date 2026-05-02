import { searchLunarPhase } from '../dist/ephemeris/adapters/search';
import { Precision } from '../dist/ephemeris/adapters/precision';

const suoDates: number[] = JSON.parse(
  require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', '..', '..', 'sxwnl_dart', 'suo_dates_merged.json'),
    'utf8'
  )
);

// 从 sxwnl 输出数据自动推导索引参数，不硬编码 sxwnl 内部拟合常数
const FIRST_SUO_JD = suoDates[0]!;
const LAST_SUO_JD = suoDates[suoDates.length - 1]!;
const SUO_PERIOD = (LAST_SUO_JD - FIRST_SUO_JD) / (suoDates.length - 1);

console.log(`Derived from data: FIRST_SUO_JD=${FIRST_SUO_JD}, SUO_PERIOD=${SUO_PERIOD.toFixed(6)}`);

const corrections: number[] = [];
const dist = new Map<number, number>();

for (let i = 0; i < suoDates.length; i++) {
  const sxwnlDate = suoDates[i]!;
  const jdApprox = FIRST_SUO_JD + i * SUO_PERIOD;
  const ourDate = searchLunarPhase(0, jdApprox - 10, 20, Precision.Low);

  if (ourDate === null) {
    console.error(`Failed at index ${i}: sxwnlDate=${sxwnlDate}, jdApprox=${jdApprox}`);
    process.exit(1);
  }

  const diff = Math.round(sxwnlDate - ourDate);
  corrections.push(diff);
  dist.set(diff, (dist.get(diff) ?? 0) + 1);

  if (i % 2000 === 0) {
    console.log(`Index ${i}: sxwnl=${sxwnlDate}, our=${ourDate.toFixed(4)}, diff=${diff}`);
  }
}

console.log('\nCorrection distribution:');
const sorted = Array.from(dist.entries()).sort((a, b) => a[0] - b[0]);
for (const [k, v] of sorted) {
  console.log(`  ${k}: ${v}`);
}

// Save corrections for next step
require('fs').writeFileSync(
  require('path').join(__dirname, 'suo_corrections.json'),
  JSON.stringify(corrections)
);
console.log(`\nSaved ${corrections.length} corrections to suo_corrections.json`);
