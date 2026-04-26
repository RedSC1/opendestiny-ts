/**
 * 对比 astronomy-engine 的 ΔT 与我们自己的 delta-t.ts
 */

const { AstroTime } = require('../dist/ephemeris/astronomy/astronomy');
const { deltaT } = require('../dist/ephemeris/delta-t');

function testDeltaT(year) {
  const date = new Date(year, 0, 1, 12, 0, 0);
  const at = new AstroTime(date);

  // astronomy-engine: tt - ut = ΔT (days)
  const aeDeltaTS = (at.tt - at.ut) * 86400;

  // 我们自己的
  const ourDeltaTS = deltaT(year);

  console.log(
    `Year ${year}: astronomy-engine ΔT = ${aeDeltaTS.toFixed(3)}s, ` +
    `ours = ${ourDeltaTS.toFixed(3)}s, ` +
    `diff = ${(aeDeltaTS - ourDeltaTS).toFixed(3)}s`
  );
}

console.log('=== 现代 ===');
testDeltaT(2000);
testDeltaT(2024);
testDeltaT(1950);

console.log('\n=== 近代 ===');
testDeltaT(1900);
testDeltaT(1800);
testDeltaT(1600);

console.log('\n=== 古代 ===');
testDeltaT(1000);
testDeltaT(0);
testDeltaT(-500);
testDeltaT(-720);
