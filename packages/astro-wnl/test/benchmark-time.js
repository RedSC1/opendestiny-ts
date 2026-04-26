/**
 * 测量搜索的实际耗时（wall clock time）
 */

const { AstroTime, MakeTime, Search } = require('../dist/ephemeris/astronomy/astronomy');
const { Precision } = require('../dist/ephemeris/adapters/precision');
const { sunEclipticLongitude } = require('../dist/ephemeris/adapters/sun');
const { moonEclipticPosition } = require('../dist/ephemeris/adapters/moon');

function longitudeOffset(diff) {
  let offset = diff;
  while (offset <= -180) offset += 360;
  while (offset > 180) offset -= 360;
  return offset;
}

function timeIt(fn, runs = 1) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6 / runs; // ms per call
}

// ============ 节气搜索 ============

function benchSolarTerm() {
  console.log('===== 节气搜索耗时测试 =====\n');

  const startDate = new AstroTime(new Date('2024-01-01T00:00:00Z'));
  const targets = [0, 90, 180, 270];

  let totalSingleMs = 0;
  let totalTwoPhaseMs = 0;
  let totalLowMs = 0;
  let totalHighFineMs = 0;

  for (const targetLon of targets) {
    const t1 = MakeTime(startDate);
    const t2 = t1.AddDays(400);

    // --- 单阶段 High ---
    const singleFn = () => Search(
      (t) => longitudeOffset(sunEclipticLongitude(t, Precision.High) - targetLon),
      t1, t2, { dt_tolerance_seconds: 0.01 }
    );
    const singleMs = timeIt(singleFn, 10);

    // --- 两阶段 ---
    const twoPhaseFn = () => {
      const coarse = Search(
        (t) => longitudeOffset(sunEclipticLongitude(t, Precision.Low) - targetLon),
        t1, t2, { dt_tolerance_seconds: 60 }
      );
      if (!coarse) return null;
      return Search(
        (t) => longitudeOffset(sunEclipticLongitude(t, Precision.High) - targetLon),
        coarse.AddDays(-1), coarse.AddDays(1), { dt_tolerance_seconds: 0.01 }
      );
    };
    const twoPhaseMs = timeIt(twoPhaseFn, 10);

    // --- 只算 Low ---
    const lowFn = () => Search(
      (t) => longitudeOffset(sunEclipticLongitude(t, Precision.Low) - targetLon),
      t1, t2, { dt_tolerance_seconds: 60 }
    );
    const lowMs = timeIt(lowFn, 10);

    // --- 只算 High 精修（窄区间） ---
    const coarseRef = Search(
      (t) => longitudeOffset(sunEclipticLongitude(t, Precision.Low) - targetLon),
      t1, t2, { dt_tolerance_seconds: 60 }
    );
    let highFineMs = 0;
    if (coarseRef) {
      const highFineFn = () => Search(
        (t) => longitudeOffset(sunEclipticLongitude(t, Precision.High) - targetLon),
        coarseRef.AddDays(-1), coarseRef.AddDays(1), { dt_tolerance_seconds: 0.01 }
      );
      highFineMs = timeIt(highFineFn, 10);
    }

    console.log(`target=${targetLon}°:`);
    console.log(`  单阶段 High: ${singleMs.toFixed(3)} ms`);
    console.log(`  两阶段总计:  ${twoPhaseMs.toFixed(3)} ms (Low粗搜=${lowMs.toFixed(3)}, High精修=${highFineMs.toFixed(3)})`);
    console.log(`  比例: 两阶段/单阶段 = ${(twoPhaseMs / singleMs * 100).toFixed(1)}%`);
    console.log();

    totalSingleMs += singleMs;
    totalTwoPhaseMs += twoPhaseMs;
    totalLowMs += lowMs;
    totalHighFineMs += highFineMs;
  }

  console.log('===== 节气搜索汇总 =====');
  console.log(`单阶段 High 平均: ${(totalSingleMs / targets.length).toFixed(3)} ms`);
  console.log(`两阶段平均:       ${(totalTwoPhaseMs / targets.length).toFixed(3)} ms (Low=${(totalLowMs / targets.length).toFixed(3)}, High精修=${(totalHighFineMs / targets.length).toFixed(3)})`);
  console.log(`两阶段 vs 单阶段: ${(totalTwoPhaseMs / totalSingleMs * 100).toFixed(1)}%`);
  console.log();
}

// ============ 朔望搜索 ============

function benchLunarPhase() {
  console.log('===== 朔望搜索耗时测试 =====\n');

  const startDate = new AstroTime(new Date('2024-01-01T00:00:00Z'));
  const phases = [
    { name: '朔', target: 0 },
    { name: '上弦', target: 90 },
    { name: '望', target: 180 },
    { name: '下弦', target: 270 },
  ];

  let totalSingleMs = 0;
  let totalTwoPhaseMs = 0;

  for (const phase of phases) {
    const t1 = MakeTime(startDate);
    const t2 = t1.AddDays(40);

    // 单阶段 High
    const singleFn = () => Search(
      (t) => {
        const sunLon = sunEclipticLongitude(t, Precision.High);
        const moon = moonEclipticPosition(t, Precision.High);
        return longitudeOffset(longitudeOffset(moon.elon - sunLon) - phase.target);
      },
      t1, t2, { dt_tolerance_seconds: 0.01 }
    );
    const singleMs = timeIt(singleFn, 10);

    // 两阶段
    const twoPhaseFn = () => {
      const coarse = Search(
        (t) => {
          const sunLon = sunEclipticLongitude(t, Precision.Low);
          const moon = moonEclipticPosition(t, Precision.Low);
          return longitudeOffset(longitudeOffset(moon.elon - sunLon) - phase.target);
        },
        t1, t2, { dt_tolerance_seconds: 60 }
      );
      if (!coarse) return null;
      return Search(
        (t) => {
          const sunLon = sunEclipticLongitude(t, Precision.High);
          const moon = moonEclipticPosition(t, Precision.High);
          return longitudeOffset(longitudeOffset(moon.elon - sunLon) - phase.target);
        },
        coarse.AddDays(-1), coarse.AddDays(1), { dt_tolerance_seconds: 0.01 }
      );
    };
    const twoPhaseMs = timeIt(twoPhaseFn, 10);

    console.log(`${phase.name}:`);
    console.log(`  单阶段 High: ${singleMs.toFixed(3)} ms`);
    console.log(`  两阶段总计:  ${twoPhaseMs.toFixed(3)} ms`);
    console.log(`  比例: 两阶段/单阶段 = ${(twoPhaseMs / singleMs * 100).toFixed(1)}%`);
    console.log();

    totalSingleMs += singleMs;
    totalTwoPhaseMs += twoPhaseMs;
  }

  console.log('===== 朔望搜索汇总 =====');
  console.log(`单阶段 High 平均: ${(totalSingleMs / phases.length).toFixed(3)} ms`);
  console.log(`两阶段平均:       ${(totalTwoPhaseMs / phases.length).toFixed(3)} ms`);
  console.log(`两阶段 vs 单阶段: ${(totalTwoPhaseMs / totalSingleMs * 100).toFixed(1)}%`);
  console.log();
}

// ============ 批量场景（算一年 24 节气） ============

function benchYearSolarTerms() {
  console.log('===== 批量：2024 年 24 节气 =====\n');

  let singleTotalMs = 0;
  let twoPhaseTotalMs = 0;

  // 单阶段 High
  const singleFn = () => {
    let start = MakeTime(new AstroTime(new Date('2024-01-01T00:00:00Z')));
    for (let i = 0; i < 24; i++) {
      const targetLon = (i * 15) % 360;
      const result = Search(
        (t) => longitudeOffset(sunEclipticLongitude(t, Precision.High) - targetLon),
        start, start.AddDays(30), { dt_tolerance_seconds: 0.01 }
      );
      if (result) start = result;
    }
  };
  singleTotalMs = timeIt(singleFn, 5);

  // 两阶段
  const twoPhaseFn = () => {
    let start = MakeTime(new AstroTime(new Date('2024-01-01T00:00:00Z')));
    for (let i = 0; i < 24; i++) {
      const targetLon = (i * 15) % 360;
      const coarse = Search(
        (t) => longitudeOffset(sunEclipticLongitude(t, Precision.Low) - targetLon),
        start, start.AddDays(30), { dt_tolerance_seconds: 60 }
      );
      if (!coarse) continue;
      const result = Search(
        (t) => longitudeOffset(sunEclipticLongitude(t, Precision.High) - targetLon),
        coarse.AddDays(-1), coarse.AddDays(1), { dt_tolerance_seconds: 0.01 }
      );
      if (result) start = result;
    }
  };
  twoPhaseTotalMs = timeIt(twoPhaseFn, 5);

  console.log(`单阶段 High: ${singleTotalMs.toFixed(3)} ms`);
  console.log(`两阶段:      ${twoPhaseTotalMs.toFixed(3)} ms`);
  console.log(`比例:        ${(twoPhaseTotalMs / singleTotalMs * 100).toFixed(1)}%`);
  console.log();
}

// 跑测试
benchSolarTerm();
benchLunarPhase();
benchYearSolarTerms();
