/**
 * 测试搜索函数的迭代次数和函数调用次数
 */

const { AstroTime, MakeTime, Search } = require('../dist/ephemeris/astronomy/astronomy');
const { Precision } = require('../dist/ephemeris/adapters/precision');
const { sunEclipticLongitude } = require('../dist/ephemeris/adapters/sun');
const { moonEclipticPosition } = require('../dist/ephemeris/adapters/moon');

// ============ 工具函数 ============

function longitudeOffset(diff) {
  let offset = diff;
  while (offset <= -180) offset += 360;
  while (offset > 180) offset -= 360;
  return offset;
}

// 统计函数调用次数的包装器
function wrapCounter(fn, name) {
  let count = 0;
  return {
    call: function(...args) {
      count++;
      return fn(...args);
    },
    reset: function() { count = 0; },
    getCount: function() { return count; },
    name,
  };
}

// ============ 测试场景 ============

function benchmarkSolarTerm() {
  console.log('===== 节气搜索性能测试 =====\n');

  // 测试 2024 年 24 个节气
  const startDate = new AstroTime(new Date('2024-01-01T00:00:00Z'));
  const termNames = ['春分', '夏至', '秋分', '冬至'];
  const termLons = [0, 90, 180, 270];

  let totalLowCalls = 0;
  let totalHighCallsCoarse = 0;
  let totalSingleHighCalls = 0;

  for (let idx = 0; idx < termLons.length; idx++) {
    const targetLon = termLons[idx];
    const name = termNames[idx];

    // --- 阶段 1: Low 精度粗搜 ---
    const lowCounter = wrapCounter((t) => {
      const lon = sunEclipticLongitude(t, Precision.Low);
      return longitudeOffset(lon - targetLon);
    }, 'low');

    const t1 = MakeTime(startDate);
    const t2 = t1.AddDays(400);

    const coarse = Search(lowCounter.call, t1, t2, { dt_tolerance_seconds: 60 });
    const lowCalls = lowCounter.getCount();

    // --- 阶段 2: High 精度精修 ---
    let highFineCalls = 0;
    if (coarse) {
      const highCounter = wrapCounter((t) => {
        const lon = sunEclipticLongitude(t, Precision.High);
        return longitudeOffset(lon - targetLon);
      }, 'high-fine');

      const fine = Search(highCounter.call, coarse.AddDays(-1), coarse.AddDays(1), { dt_tolerance_seconds: 0.01 });
      highFineCalls = highCounter.getCount();
    }

    // --- 单精度 High（不用两阶段）---
    const singleHighCounter = wrapCounter((t) => {
      const lon = sunEclipticLongitude(t, Precision.High);
      return longitudeOffset(lon - targetLon);
    }, 'single-high');

    const singleResult = Search(singleHighCounter.call, t1, t2, { dt_tolerance_seconds: 0.01 });
    const singleHighCalls = singleHighCounter.getCount();

    console.log(`${name} (target=${targetLon}°):`);
    console.log(`  两阶段: Low=${lowCalls}次, High(精修)=${highFineCalls}次, 总计=${lowCalls + highFineCalls}次`);
    console.log(`  单阶段 High: ${singleHighCalls}次`);
    console.log(`  节省: ${singleHighCalls - (lowCalls + highFineCalls)}次 (${((1 - (lowCalls + highFineCalls) / singleHighCalls) * 100).toFixed(1)}%)`);
    console.log('');

    totalLowCalls += lowCalls;
    totalHighCallsFine += highFineCalls;
    totalSingleHighCalls += singleHighCalls;
  }

  console.log('===== 节气搜索汇总 =====');
  console.log(`两阶段总计: Low=${totalLowCalls}次 + High=${totalHighCallsFine}次 = ${totalLowCalls + totalHighCallsFine}次`);
  console.log(`单阶段 High 总计: ${totalSingleHighCalls}次`);
  console.log(`平均每次搜索节省: ${(totalSingleHighCalls - (totalLowCalls + totalHighCallsFine)) / termLons.length}次`);
  console.log('');
}

function benchmarkLunarPhase() {
  console.log('===== 朔望搜索性能测试 =====\n');

  const startDate = new AstroTime(new Date('2024-01-01T00:00:00Z'));
  const phases = [
    { name: '朔', target: 0 },
    { name: '上弦', target: 90 },
    { name: '望', target: 180 },
    { name: '下弦', target: 270 },
  ];

  let totalLowCalls = 0;
  let totalHighCallsFine = 0;
  let totalSingleHighCalls = 0;

  for (const phase of phases) {
    // --- 阶段 1: Low 精度粗搜 ---
    const lowCounter = wrapCounter((t) => {
      const sunLon = sunEclipticLongitude(t, Precision.Low);
      const moon = moonEclipticPosition(t, Precision.Low);
      const diff = longitudeOffset(moon.elon - sunLon);
      return longitudeOffset(diff - phase.target);
    }, 'low');

    const t1 = MakeTime(startDate);
    const t2 = t1.AddDays(40);

    const coarse = Search(lowCounter.call, t1, t2, { dt_tolerance_seconds: 60 });
    const lowCalls = lowCounter.getCount();

    // --- 阶段 2: High 精度精修 ---
    let highFineCalls = 0;
    if (coarse) {
      const highCounter = wrapCounter((t) => {
        const sunLon = sunEclipticLongitude(t, Precision.High);
        const moon = moonEclipticPosition(t, Precision.High);
        const diff = longitudeOffset(moon.elon - sunLon);
        return longitudeOffset(diff - phase.target);
      }, 'high-fine');

      const fine = Search(highCounter.call, coarse.AddDays(-1), coarse.AddDays(1), { dt_tolerance_seconds: 0.01 });
      highFineCalls = highCounter.getCount();
    }

    // --- 单精度 High ---
    const singleHighCounter = wrapCounter((t) => {
      const sunLon = sunEclipticLongitude(t, Precision.High);
      const moon = moonEclipticPosition(t, Precision.High);
      const diff = longitudeOffset(moon.elon - sunLon);
      return longitudeOffset(diff - phase.target);
    }, 'single-high');

    const singleResult = Search(singleHighCounter.call, t1, t2, { dt_tolerance_seconds: 0.01 });
    const singleHighCalls = singleHighCounter.getCount();

    console.log(`${phase.name} (target=${phase.target}°):`);
    console.log(`  两阶段: Low=${lowCalls}次, High(精修)=${highFineCalls}次, 总计=${lowCalls + highFineCalls}次`);
    console.log(`  单阶段 High: ${singleHighCalls}次`);
    console.log(`  节省: ${singleHighCalls - (lowCalls + highFineCalls)}次 (${((1 - (lowCalls + highFineCalls) / singleHighCalls) * 100).toFixed(1)}%)`);
    console.log('');

    totalLowCalls += lowCalls;
    totalHighCallsFine += highFineCalls;
    totalSingleHighCalls += singleHighCalls;
  }

  console.log('===== 朔望搜索汇总 =====');
  console.log(`两阶段总计: Low=${totalLowCalls}次 + High=${totalHighCallsFine}次 = ${totalLowCalls + totalHighCallsFine}次`);
  console.log(`单阶段 High 总计: ${totalSingleHighCalls}次`);
  console.log(`平均每次搜索节省: ${(totalSingleHighCalls - (totalLowCalls + totalHighCallsFine)) / phases.length}次`);
  console.log('');
}

// ============ 执行 ============
benchmarkSolarTerm();
benchmarkLunarPhase();
