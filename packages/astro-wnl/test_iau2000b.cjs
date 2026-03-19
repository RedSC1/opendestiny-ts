/**
 * 验证 iau2000b 改造后的正确性。
 *
 * 对比 ERFA eranut00b 参考值（由 ERFA C 库计算）。
 *
 * 用法: node test_iau2000b.cjs
 */

// ---- 内联必要常量 ----
const ASEC2RAD = 4.848136811095359935899141e-6;
const ASEC180 = 180 * 60 * 60;
const ASEC360 = 2 * ASEC180;

// ---- 内联 NUT2000B 数据 ----
const { NUT2000B } = require('./src/ephemeris/astronomy/nut2000b_data.js');

// ---- iau2000b 实现（与 astronomy.js 一致） ----
function iau2000b(tt) {
    function mod(x) {
        return (x % ASEC360) * ASEC2RAD;
    }
    const t = tt / 36525;
    const fa = [
        mod(485868.249036 + t * 1717915923.2178),
        mod(1287104.79305 + t * 129596581.0481),
        mod(335779.526232 + t * 1739527262.8478),
        mod(1072260.70369 + t * 1602961601.2090),
        mod(450160.398036 - t * 6962890.5431)
    ];
    let dp = 0;
    let de = 0;
    for (let i = NUT2000B.length - 1; i >= 0; i--) {
        const row = NUT2000B[i];
        const arg = row[0]*fa[0] + row[1]*fa[1] + row[2]*fa[2] + row[3]*fa[3] + row[4]*fa[4];
        const sarg = Math.sin(arg);
        const carg = Math.cos(arg);
        dp += (row[5] + row[6] * t) * sarg + row[7] * carg;
        de += (row[8] + row[9] * t) * carg + row[10] * sarg;
    }
    return {
        dpsi: -0.000135 + (dp * 1.0e-7),
        deps: +0.000388 + (de * 1.0e-7)
    };
}

// ---- 旧版 5 项实现（用于对比前 5 项贡献） ----
function iau2000b_old(tt) {
    function mod(x) {
        return (x % ASEC360) * ASEC2RAD;
    }
    const t = tt / 36525;
    const elp = mod(1287104.79305 + t * 129596581.0481);
    const f = mod(335779.526232 + t * 1739527262.8478);
    const d = mod(1072260.70369 + t * 1602961601.2090);
    const om = mod(450160.398036 - t * 6962890.5431);
    let sarg = Math.sin(om);
    let carg = Math.cos(om);
    let dp = (-172064161.0 - 174666.0 * t) * sarg + 33386.0 * carg;
    let de = (92052331.0 + 9086.0 * t) * carg + 15377.0 * sarg;
    let arg = 2.0 * (f - d + om);
    sarg = Math.sin(arg);
    carg = Math.cos(arg);
    dp += (-13170906.0 - 1675.0 * t) * sarg - 13696.0 * carg;
    de += (5730336.0 - 3015.0 * t) * carg - 4587.0 * sarg;
    arg = 2.0 * (f + om);
    sarg = Math.sin(arg);
    carg = Math.cos(arg);
    dp += (-2276413.0 - 234.0 * t) * sarg + 2796.0 * carg;
    de += (978459.0 - 485.0 * t) * carg + 1374.0 * sarg;
    arg = 2.0 * om;
    sarg = Math.sin(arg);
    carg = Math.cos(arg);
    dp += (2074554.0 + 207.0 * t) * sarg - 698.0 * carg;
    de += (-897492.0 + 470.0 * t) * carg - 291.0 * sarg;
    sarg = Math.sin(elp);
    carg = Math.cos(elp);
    dp += (1475877.0 - 3633.0 * t) * sarg + 11817.0 * carg;
    de += (73871.0 - 184.0 * t) * carg - 1924.0 * sarg;
    return {
        dpsi: -0.000135 + (dp * 1.0e-7),
        deps: +0.000388 + (de * 1.0e-7)
    };
}

// ---- ERFA 参考值 ----
// 由 ERFA eranut00b 计算（单位：角秒）
// J2000.0: TT = 0
// 2024-01-01 12:00 TT: TT = JD 2460310.0 - 2451545.0 = 8765.0
// 由 Python erfa.nut00b 计算，转为角秒
const ERFA_REF = [
    { label: 'J2000.0 (tt=0)', tt: 0, dpsi: -13.931664, deps: -5.769417 },
    { label: '2024-01-01 (tt=8765)', tt: 8765, dpsi: -5.353389, deps: 8.043293 },
];

// ---- 测试 ----
console.log('=== IAU 2000B 章动验证 ===\n');

// 测试 1: 新旧实现在 tt=0 时的差异（前 5 项贡献应接近）
console.log('--- 测试 1: 新旧实现对比 (tt=0) ---');
const newResult = iau2000b(0);
const oldResult = iau2000b_old(0);
console.log(`旧版 (5项):  dpsi=${oldResult.dpsi.toFixed(6)}"  deps=${oldResult.deps.toFixed(6)}"`);
console.log(`新版 (77项): dpsi=${newResult.dpsi.toFixed(6)}"  deps=${newResult.deps.toFixed(6)}"`);
console.log(`差值:        Δdpsi=${(newResult.dpsi - oldResult.dpsi).toFixed(6)}"  Δdeps=${(newResult.deps - oldResult.deps).toFixed(6)}"`);
console.log(`  (差值来自第 6~77 项的贡献，量级应在 ~0.5" 以内)\n`);

// 测试 2: 与 ERFA 参考值对比
console.log('--- 测试 2: 与 ERFA 参考值对比 ---');
let allPass = true;
for (const ref of ERFA_REF) {
    const r = iau2000b(ref.tt);
    const errPsi = Math.abs(r.dpsi - ref.dpsi);
    const errEps = Math.abs(r.deps - ref.deps);
    // IAU 2000B 精度约 1 毫角秒 = 0.001"
    const threshold = 0.001;
    const passPsi = errPsi < threshold;
    const passEps = errEps < threshold;
    const status = (passPsi && passEps) ? 'PASS' : 'FAIL';
    if (status === 'FAIL') allPass = false;
    console.log(`[${status}] ${ref.label}`);
    console.log(`  计算: dpsi=${r.dpsi.toFixed(6)}"  deps=${r.deps.toFixed(6)}"`);
    console.log(`  参考: dpsi=${ref.dpsi.toFixed(6)}"  deps=${ref.deps.toFixed(6)}"`);
    console.log(`  误差: |Δdpsi|=${errPsi.toFixed(6)}"  |Δdeps|=${errEps.toFixed(6)}"`);
}

console.log(`\n=== 总结: ${allPass ? '全部通过 ✓' : '存在失败 ✗'} ===`);
process.exit(allPass ? 0 : 1);
