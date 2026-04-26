/**
 * 验证牛顿迭代节气搜索 vs 二分搜索
 */

const {
  searchSolarTerm,
  searchSolarTermNewtonWithEstimate,
  sunEclipticLongitude,
} = require('../dist/ephemeris/adapters');
const AstroDateTime = require('../dist/utils/astro_date_time').default;

const SECONDS_PER_DAY = 86400;

function longitudeOffset(diff) {
  while (diff <= -180) diff += 360;
  while (diff > 180) diff -= 360;
  return diff;
}

/**
 * 用平太阳黄经公式估算目标黄经对应的 JD
 */
function estimateJd(targetLon, jdApprox) {
  const meanLon = (280.46646 + 0.98564736 * jdApprox) % 360;
  const diff = longitudeOffset(targetLon - meanLon);
  return jdApprox + diff / 0.98564736;
}

/**
 * 对比单个节气的两种算法
 */
function compareSingle(targetLon, year, month, day, label) {
  const jdApprox = new AstroDateTime(year, month, day).toJ2000();

  // 二分搜索（两阶段 High 精度，搜索范围 40 天确保找到）
  const t0Binary = Date.now();
  const jdBinary = searchSolarTerm(targetLon, jdApprox - 20, 40);
  const tBinary = Date.now() - t0Binary;

  if (jdBinary === null) {
    console.log(`${label}: 二分搜索失败`);
    return false;
  }

  // 牛顿迭代
  const t0Newton = Date.now();
  const jdNewton = searchSolarTermNewtonWithEstimate(targetLon, jdApprox);
  const tNewton = Date.now() - t0Newton;

  // 验证牛顿迭代结果
  const lonNewton = sunEclipticLongitude(jdNewton, 2); // High = 2
  const lonBinary = sunEclipticLongitude(jdBinary, 2);

  const diffDeg = longitudeOffset(lonNewton - lonBinary);
  const diffSeconds = (jdNewton - jdBinary) * SECONDS_PER_DAY;
  const diffDegNewton = longitudeOffset(lonNewton - targetLon);

  const dtBinary = AstroDateTime.fromJ2000(jdBinary);
  const dtNewton = AstroDateTime.fromJ2000(jdNewton);

  console.log(
    `${label}: ` +
    `二分=${dtBinary.toString()}(${tBinary}ms)  ` +
    `牛顿=${dtNewton.toString()}(${tNewton}ms)  ` +
    `JD差=${(diffSeconds * 1000).toFixed(3)}ms  ` +
    `黄经差=${(diffDeg * 3600).toFixed(4)}″  ` +
    `牛顿残差=${(diffDegNewton * 3600).toFixed(6)}″`
  );

  return Math.abs(diffSeconds) < 1;
}

console.log('=== 现代年份 ===');
let pass = 0, total = 0;

[
  [0,   2024, 3,  15, '2024春分'],
  [90,  2024, 6,  15, '2024夏至'],
  [180, 2024, 9,  15, '2024秋分'],
  [270, 2024, 12, 15, '2024冬至'],
].forEach(([lon, y, m, d, label]) => {
  total++;
  if (compareSingle(lon, y, m, d, label)) pass++;
});

console.log('\n=== 历史年份 ===');
[
  [0, 1900, 3, 15, '1900春分'],
  [0, 1800, 3, 15, '1800春分'],
  [0, 1000, 3, 15, '1000春分'],
  [0, 0,    3, 15, '公元0春分'],
  [0, -500,  3, 15, '前500春分'],
  [0, -1000, 3, 15, '前1000春分'],
  [0, -2000, 3, 15, '前2000春分'],
].forEach(([lon, y, m, d, label]) => {
  total++;
  if (compareSingle(lon, y, m, d, label)) pass++;
});

console.log('\n=== 远期年份 ===');
[
  [0, 3000, 3, 15, '3000春分'],
  [0, 4000, 3, 15, '4000春分'],
].forEach(([lon, y, m, d, label]) => {
  total++;
  if (compareSingle(lon, y, m, d, label)) pass++;
});

console.log('\n=== 全部24节气（2024年）===');
const jdJan1 = new AstroDateTime(2024, 1, 1).toJ2000();
for (let n = 0; n < 24; n++) {
  const targetLon = ((n * 15) % 360 + 360) % 360;

  // 用平太阳公式估算每个节气的初值
  const jdApprox = estimateJd(targetLon, jdJan1 + n * 15.2);

  const t0Binary = Date.now();
  const jdBinary = searchSolarTerm(targetLon, jdApprox - 5, 10);
  const tBinary = Date.now() - t0Binary;

  if (jdBinary === null) {
    console.log(`  节气${n.toString().padStart(2)}(${targetLon.toString().padStart(3)}°): 二分搜索失败`);
    total++;
    return;
  }

  const t0Newton = Date.now();
  const jdNewton = searchSolarTermNewtonWithEstimate(targetLon, jdApprox);
  const tNewton = Date.now() - t0Newton;

  const diffMs = (jdNewton - jdBinary) * SECONDS_PER_DAY * 1000;
  const passed = Math.abs(diffMs) < 1000;

  console.log(
    `  节气${n.toString().padStart(2)}(${targetLon.toString().padStart(3)}°): ` +
    `二分${tBinary.toString().padStart(3)}ms 牛顿${tNewton.toString().padStart(3)}ms  ` +
    `差=${diffMs.toFixed(3)}ms ${passed ? '✓' : '✗'}`
  );
  total++;
  if (passed) pass++;
}

console.log(`\n=== 总结: ${pass}/${total} 通过 ===`);
