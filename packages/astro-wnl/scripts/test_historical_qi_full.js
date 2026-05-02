const { getChineseHistoricalSolarTerm } = require('../dist/historical/chinese-historical');
const {
  QI_ANCIENT_CORRECTION_COUNT,
  QI_ANCIENT_FIRST_JD,
  QI_ANCIENT_PERIOD,
} = require('../dist/historical/qi_ancient_correction_table');
const {
  QI_CORRECTION_COUNT,
  FIRST_QI_JD,
  QI_PERIOD,
} = require('../dist/historical/qi_correction_table');

const qiDates = JSON.parse(
  require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', '..', '..', 'sxwnl_dart', 'qi_dates_merged.json'),
    'utf8'
  )
);

const { sunEclipticLongitude } = require('../dist/ephemeris/adapters/sun');
const { Precision } = require('../dist/ephemeris/adapters/precision');

let pass = 0;
let fail = 0;

for (let i = 0; i < qiDates.length; i++) {
  const sxwnlDate = qiDates[i];

  let jdApprox;
  if (i < QI_ANCIENT_CORRECTION_COUNT) {
    jdApprox = QI_ANCIENT_FIRST_JD + i * QI_ANCIENT_PERIOD + QI_ANCIENT_PERIOD / 2;
  } else {
    const modernIdx = i - QI_ANCIENT_CORRECTION_COUNT;
    jdApprox = FIRST_QI_JD + modernIdx * QI_PERIOD + QI_PERIOD / 2;
  }

  const lon = sunEclipticLongitude(sxwnlDate, Precision.VeryLow);
  const targetLon = Math.round(lon / 15) * 15 % 360;

  const result = getChineseHistoricalSolarTerm(targetLon, jdApprox);
  const diff = Math.round(sxwnlDate - result);

  if (diff === 0) {
    pass++;
  } else {
    fail++;
    if (fail <= 5) {
      console.log(`FAIL index ${i}: sxwnl=${sxwnlDate}, our=${result.toFixed(4)}, targetLon=${targetLon}, diff=${diff}`);
    }
  }

  if (i > 0 && i % 5000 === 0) {
    console.log(`Progress: ${i}/${qiDates.length}, pass=${pass}, fail=${fail}`);
  }
}

console.log(`\nFinal: ${pass} pass, ${fail} fail out of ${qiDates.length}`);
