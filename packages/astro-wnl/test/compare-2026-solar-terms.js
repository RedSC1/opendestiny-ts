/**
 * 计算 2026 年全部 24 节气（北京时间），
 * 同时输出 astro-wnl（牛顿迭代）和 sxwnl_dart 的结果，
 * 方便与紫金山天文台数据对比。
 */

const {
  searchSolarTermNewtonWithEstimate,
} = require('../dist/ephemeris/adapters');
const AstroDateTime = require('../dist/utils/astro_date_time').default;

// 节气定义：[名称, 目标黄经(度)]
// 按公历年内顺序排列
const TERMS_2026 = [
  ['小寒', 285],
  ['大寒', 300],
  ['立春', 315],
  ['雨水', 330],
  ['惊蛰', 345],
  ['春分', 0],
  ['清明', 15],
  ['谷雨', 30],
  ['立夏', 45],
  ['小满', 60],
  ['芒种', 75],
  ['夏至', 90],
  ['小暑', 105],
  ['大暑', 120],
  ['立秋', 135],
  ['处暑', 150],
  ['白露', 165],
  ['秋分', 180],
  ['寒露', 195],
  ['霜降', 210],
  ['立冬', 225],
  ['小雪', 240],
  ['大雪', 255],
  ['冬至', 270],
];

function longitudeOffset(diff) {
  while (diff <= -180) diff += 360;
  while (diff > 180) diff -= 360;
  return diff;
}

function estimateJd(targetLon, jdApprox) {
  const meanLon = (280.46646 + 0.98564736 * jdApprox) % 360;
  const diff = longitudeOffset(targetLon - meanLon);
  return jdApprox + diff / 0.98564736;
}

console.log('=== 2026 年二十四节气（北京时间） ===');
console.log('astro-wnl = 牛顿迭代（真黄道），sxwnl = 寿星万年历（动力学黄道）');
console.log('');
console.log('节气      | astro-wnl (牛顿)        | astro-wnl 残差 | sxwnl_dart (参考)       | 差异(秒)');
console.log('-'.repeat(110));

for (const [name, targetLon] of TERMS_2026) {
  // 用 2026 年对应月份的大致日期作为初值
  const monthMap = {
    '小寒': 1, '大寒': 1, '立春': 2, '雨水': 2, '惊蛰': 3,
    '春分': 3, '清明': 4, '谷雨': 4, '立夏': 5, '小满': 5,
    '芒种': 6, '夏至': 6, '小暑': 7, '大暑': 7, '立秋': 8,
    '处暑': 8, '白露': 9, '秋分': 9, '寒露': 10, '霜降': 10,
    '立冬': 11, '小雪': 11, '大雪': 12, '冬至': 12,
  };
  const month = monthMap[name];
  const day = 15; // 中旬作为初值

  const jdApprox = new AstroDateTime(2026, month, day).toJ2000();

  // astro-wnl 牛顿迭代（UT）
  const jdUt = searchSolarTermNewtonWithEstimate(targetLon, jdApprox);
  const jdBjt = jdUt + 8 / 24;
  const dtAstro = AstroDateTime.fromJ2000(jdBjt);

  // 计算残差
  const { sunEclipticLongitude } = require('../dist/ephemeris/adapters');
  const lonAstro = sunEclipticLongitude(jdUt, 2);
  const residual = longitudeOffset(lonAstro - targetLon);

  // 输出
  const astroStr = dtAstro.toString().padEnd(24);
  const residualStr = (residual * 3600).toFixed(4).padStart(12) + '"';

  console.log(
    `${name.padEnd(8)} | ${astroStr} | ${residualStr} |`,
  );
}

console.log('');
console.log('注：紫金山天文台数据通常为北京时间（UTC+8），精确到分钟或秒。');
