/**
 * 验证割线法朔望搜索 + ELPMPP02 三档差异
 * 范围: -1000 ~ 5000 年，每年 1 月 1 日
 */

const { moonEclipticPosition } = require('../dist/ephemeris/adapters/moon');
const { sunEclipticLongitude } = require('../dist/ephemeris/adapters/sun');
const { searchLunarPhaseSecantWithFallback, searchLunarPhase } = require('../dist/ephemeris/adapters/search');
const { Precision } = require('../dist/ephemeris/adapters/precision');
const AstroDateTime = require('../dist/utils/astro_date_time').default;

function toDeg(rad) {
  return rad * 180 / Math.PI;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d <= -180) d += 360;
  while (d > 180) d -= 360;
  return d;
}

console.log('=== ELPMPP02 三档差异验证 (-1000 ~ 5000, 每年 1月1日) ===');
console.log('year | Low-High 黄经(\") | Med-High 黄经(\") | Low-High 黄纬(\") | Med-High 黄纬(\") | Low-High 距离(μAU) | Med-High 距离(μAU)');
console.log('-'.repeat(140));

let maxLowHighLon = 0, maxMedHighLon = 0;
let maxLowHighLat = 0, maxMedHighLat = 0;
let maxLowHighDist = 0, maxMedHighDist = 0;
let maxLowHighYear = 0, maxMedHighYear = 0;

for (let year = -1000; year <= 5000; year += 100) {
  const jd = new AstroDateTime(year, 1, 1).toJ2000();

  const low = moonEclipticPosition(jd, Precision.Low);
  const med = moonEclipticPosition(jd, Precision.Medium);
  const high = moonEclipticPosition(jd, Precision.High);

  const dLonLow = angleDiff(low.elon, high.elon) * 3600;
  const dLonMed = angleDiff(med.elon, high.elon) * 3600;
  const dLatLow = (low.elat - high.elat) * 3600;
  const dLatMed = (med.elat - high.elat) * 3600;
  const dDistLow = (low.dist - high.dist) * 1e6;
  const dDistMed = (med.dist - high.dist) * 1e6;

  if (Math.abs(dLonLow) > Math.abs(maxLowHighLon)) { maxLowHighLon = dLonLow; maxLowHighYear = year; }
  if (Math.abs(dLonMed) > Math.abs(maxMedHighLon)) { maxMedHighLon = dLonMed; maxMedHighYear = year; }
  if (Math.abs(dLatLow) > Math.abs(maxLowHighLat)) maxLowHighLat = dLatLow;
  if (Math.abs(dLatMed) > Math.abs(maxMedHighLat)) maxMedHighLat = dLatMed;
  if (Math.abs(dDistLow) > Math.abs(maxLowHighDist)) maxLowHighDist = dDistLow;
  if (Math.abs(dDistMed) > Math.abs(maxMedHighDist)) maxMedHighDist = dDistMed;

  const marker = Math.abs(dLonLow) > 1 || Math.abs(dLonMed) > 1 ? ' ***' : '';
  console.log(
    `${year.toString().padStart(5)} | ` +
    `${dLonLow.toFixed(6).padStart(16)} | ` +
    `${dLonMed.toFixed(6).padStart(16)} | ` +
    `${dLatLow.toFixed(6).padStart(16)} | ` +
    `${dLatMed.toFixed(6).padStart(16)} | ` +
    `${dDistLow.toFixed(3).padStart(17)} | ` +
    `${dDistMed.toFixed(3).padStart(17)}${marker}`
  );
}

console.log('-'.repeat(140));
console.log(`黄经最大差异: Low-High=${maxLowHighLon.toFixed(6)}\" (${maxLowHighYear}年), Med-High=${maxMedHighLon.toFixed(6)}\" (${maxMedHighYear}年)`);
console.log(`黄纬最大差异: Low-High=${maxLowHighLat.toFixed(6)}\", Med-High=${maxMedHighLat.toFixed(6)}\"`);
console.log(`距离最大差异: Low-High=${maxLowHighDist.toFixed(3)}μAU, Med-High=${maxMedHighDist.toFixed(3)}μAU`);
console.log('');

// ========== 割线法朔望搜索验证 ==========

console.log('=== 割线法朔望搜索验证 (-1000 ~ 5000, 每年 1月1日附近找朔) ===');
console.log('year | 割线法 UT              | 二分搜索 UT            | 差异(秒) | 割线残差(\") | 迭代次数');
console.log('-'.repeat(120));

let maxDiffSec = 0;
let maxDiffYear = 0;
let totalIterations = 0;
let count = 0;

for (let year = -1000; year <= 5000; year += 100) {
  const jd = new AstroDateTime(year, 1, 1).toJ2000();

  // 割线法
  const jdSecant = searchLunarPhaseSecantWithFallback(0, jd);

  // 二分搜索对照
  const jdBinary = searchLunarPhase(0, jd - 15, 30, Precision.High);

  if (jdBinary === null) {
    console.log(`${year.toString().padStart(5)} | 二分搜索失败`);
    continue;
  }

  const diffSec = (jdSecant - jdBinary) * 86400;

  // 割线法残差
  const sunLon = sunEclipticLongitude(jdSecant, Precision.High);
  const moon = moonEclipticPosition(jdSecant, Precision.High);
  const residual = angleDiff(moon.elon - sunLon, 0) * 3600;

  if (Math.abs(diffSec) > Math.abs(maxDiffSec)) {
    maxDiffSec = diffSec;
    maxDiffYear = year;
  }

  const marker = Math.abs(diffSec) > 1 ? ' ***' : '';
  console.log(
    `${year.toString().padStart(5)} | ` +
    `${AstroDateTime.fromJ2000(jdSecant).toString().padStart(22)} | ` +
    `${AstroDateTime.fromJ2000(jdBinary).toString().padStart(22)} | ` +
    `${diffSec.toFixed(6).padStart(10)} | ` +
    `${residual.toFixed(6).padStart(12)} |${marker}`
  );

  count++;
}

console.log('-'.repeat(120));
console.log(`割线法 vs 二分搜索最大差异: ${maxDiffYear}年, ${maxDiffSec.toFixed(6)}秒`);
console.log(`说明: 割线法不需要解析导数，用差商近似，收敛速度约1.618阶`);
