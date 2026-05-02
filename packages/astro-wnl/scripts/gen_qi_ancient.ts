import * as fs from 'fs';
import * as path from 'path';

const qiDates: number[] = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', '..', '..', 'sxwnl_dart', 'qi_dates_merged.json'),
    'utf8'
  )
);

const ANCIENT_COUNT = 44781; // -221 ~ 1645
const ancient = qiDates.slice(0, ANCIENT_COUNT);

const FIRST_QI_JD = ancient[0]!;
const LAST_QI_JD = ancient[ancient.length - 1]!;
const QI_PERIOD = (LAST_QI_JD - FIRST_QI_JD) / (ancient.length - 1);

console.log(`Ancient qi: ${ancient.length}, FIRST=${FIRST_QI_JD}, PERIOD=${QI_PERIOD.toFixed(6)}`);

const corrections: number[] = [];
const dist = new Map<number, number>();

for (let i = 0; i < ancient.length; i++) {
  const sxwnlDate = ancient[i]!;
  const approx = FIRST_QI_JD + i * QI_PERIOD;
  const diff = Math.round(sxwnlDate - approx);
  corrections.push(diff);
  dist.set(diff, (dist.get(diff) ?? 0) + 1);
}

console.log('\nCorrection distribution:');
for (const [k, v] of [...dist.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${k}: ${v}`);
}

fs.writeFileSync(path.join(__dirname, 'qi_ancient_corrections.json'), JSON.stringify(corrections));
console.log(`Saved ${corrections.length} ancient corrections`);
