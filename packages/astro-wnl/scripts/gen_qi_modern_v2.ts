import * as fs from 'fs';
import * as path from 'path';
import { searchSolarTermNewtonWithEstimate } from '../dist/ephemeris/adapters/search';
import { sunEclipticLongitude } from '../dist/ephemeris/adapters/sun';
import { Precision } from '../dist/ephemeris/adapters/precision';

const qiDates: number[] = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', '..', '..', 'sxwnl_dart', 'qi_dates_v2.json'),
    'utf8'
  )
);

const FIRST_QI_JD = qiDates[0]!;
const LAST_QI_JD = qiDates[qiDates.length - 1]!;
const QI_PERIOD = (LAST_QI_JD - FIRST_QI_JD) / (qiDates.length - 1);

console.log(`Loaded ${qiDates.length} modern qi dates`);
console.log(`Derived FIRST_QI_JD=${FIRST_QI_JD}, QI_PERIOD=${QI_PERIOD.toFixed(6)}`);

const corrections: number[] = [];
const total = qiDates.length;

for (let i = 0; i < total; i++) {
  const sxwnlDate = qiDates[i]!;
  const jdApprox = FIRST_QI_JD + i * QI_PERIOD + QI_PERIOD / 2;

  const lon = sunEclipticLongitude(sxwnlDate, Precision.VeryLow);
  const targetLon = Math.round(lon / 15) * 15 % 360;

  const ourDate = searchSolarTermNewtonWithEstimate(targetLon, jdApprox, Precision.VeryLow);
  const diff = Math.round(sxwnlDate - ourDate);
  corrections.push(diff);

  if (i % 500 === 0) {
    console.log(`Progress: ${i}/${total}, sxwnl=${sxwnlDate}, our=${ourDate.toFixed(4)}, diff=${diff}`);
  }
}

const allStats: Map<number, number> = new Map();
for (const d of corrections) {
  allStats.set(d, (allStats.get(d) || 0) + 1);
}
console.log('\nFull correction distribution:');
for (const [k, v] of [...allStats.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${k}: ${v}`);
}

fs.writeFileSync(path.join(__dirname, 'qi_corrections_modern_v2.json'), JSON.stringify(corrections));
console.log(`Saved ${corrections.length} corrections to qi_corrections_modern_v2.json`);
