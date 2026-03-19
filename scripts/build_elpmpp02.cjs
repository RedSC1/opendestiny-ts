#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CPI = Math.PI;
const RAD = 648000 / CPI;
const DEG = CPI / 180;
const PIS2 = CPI / 2;
const DPI = 2 * CPI;
const A405 = 384747.9613701725;
const AELP = 384747.980674318;
const MAX1 = 2645;
const MAX2 = 33256;
const TRUNC_5E4_THRESHOLD = 5e-4;

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data', 'elpmpp02');
const OUT_DIR = path.join(ROOT_DIR, 'packages', 'astro-wnl', 'src', 'ephemeris', 'astronomy');
const OUT_FILE_FULL = path.join(OUT_DIR, 'elpmpp02_data.js');
const OUT_FILE_TRUNC_5E4 = path.join(OUT_DIR, 'elpmpp02_data_5e4.js');

function dms(degValue, minValue, secValue) {
  return (degValue + minValue / 60 + secValue / 3600) * DEG;
}

function parseFortranFloat(text) {
  return Number(text.trim().replace(/[dD]/g, 'E'));
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n');
}

function parseMainHeader(line) {
  const match = line.match(/(-?\d+)\s*$/);
  if (!match) {
    throw new Error(`无法解析主问题文件头: ${line}`);
  }
  return Number(match[1]);
}

function parsePertHeader(line) {
  const match = line.match(/(-?\d+)\s+(-?\d+)\s*$/);
  if (!match) {
    throw new Error(`无法解析摄动文件头: ${line}`);
  }
  return {
    count: Number(match[1]),
    power: Number(match[2]),
  };
}

function parseMainLine(line) {
  const ilu = [
    Number(line.slice(0, 3)),
    Number(line.slice(3, 6)),
    Number(line.slice(6, 9)),
    Number(line.slice(9, 12)),
  ];
  const amplitude = Number(line.slice(14, 27));
  const coeffs = [];
  for (let offset = 27; offset + 12 <= line.length; offset += 12) {
    coeffs.push(Number(line.slice(offset, offset + 12)));
  }
  if (coeffs.length < 5) {
    throw new Error(`主问题行系数不足: ${line}`);
  }
  return {
    ilu,
    amplitude,
    b: coeffs.slice(0, 5),
  };
}

function parsePertLine(line) {
  const icount = Number(line.slice(0, 5));
  const s = parseFortranFloat(line.slice(5, 25));
  const c = parseFortranFloat(line.slice(25, 45));
  const ifi = [];
  for (let i = 0; i < 16; ++i) {
    const offset = 45 + i * 3;
    ifi.push(Number(line.slice(offset, offset + 3)));
  }
  return { icount, s, c, ifi };
}

function initializeConstants(icor = 1) {
  const am = 0.074801329;
  const alpha = 0.002571881;
  const dtasm = (2 * alpha) / (3 * am);
  const xa = (2 * alpha) / 3;
  const dPrec = -0.29965;

  const bp = [
    [0.311079095, -0.103837907],
    [-0.4482398e-2, 0.6682870e-3],
    [-0.110248500e-2, -0.129807200e-2],
    [0.1056062e-2, -0.1780280e-3],
    [0.50928e-4, -0.37342e-4],
  ];

  const k = icor === 1 ? 1 : 0;

  let Dw1_0;
  let Dw2_0;
  let Dw3_0;
  let Deart_0;
  let Dperi;
  let Dw1_1;
  let Dgam;
  let De;
  let Deart_1;
  let Dep;
  let Dw2_1;
  let Dw3_1;
  let Dw1_2;

  if (k === 0) {
    Dw1_0 = -0.10525;
    Dw2_0 = 0.16826;
    Dw3_0 = -0.10760;
    Deart_0 = -0.04012;
    Dperi = -0.04854;
    Dw1_1 = -0.32311;
    Dgam = 0.00069;
    De = 0.00005;
    Deart_1 = 0.01442;
    Dep = 0.00226;
    Dw2_1 = 0.08017;
    Dw3_1 = -0.04317;
    Dw1_2 = -0.03794;
  } else {
    Dw1_0 = -0.07008;
    Dw2_0 = 0.20794;
    Dw3_0 = -0.07215;
    Deart_0 = -0.00033;
    Dperi = -0.00749;
    Dw1_1 = -0.35106;
    Dgam = 0.00085;
    De = -0.00006;
    Deart_1 = 0.00732;
    Dep = 0.00224;
    Dw2_1 = 0.08017;
    Dw3_1 = -0.04317;
    Dw1_2 = -0.03743;
  }

  const w = [
    [
      dms(218, 18, 59.95571 + Dw1_0),
      (1732559343.73604 + Dw1_1) / RAD,
      (-6.8084 + Dw1_2) / RAD,
      0.66040e-2 / RAD,
      -0.31690e-4 / RAD,
    ],
    [
      dms(83, 21, 11.67475 + Dw2_0),
      (14643420.3171 + Dw2_1) / RAD,
      -38.2631 / RAD,
      -0.45047e-1 / RAD,
      0.21301e-3 / RAD,
    ],
    [
      dms(125, 2, 40.39816 + Dw3_0),
      (-6967919.5383 + Dw3_1) / RAD,
      6.3590 / RAD,
      0.76250e-2 / RAD,
      -0.35860e-4 / RAD,
    ],
  ];

  const eart = [
    dms(100, 27, 59.13885 + Deart_0),
    (129597742.29300 + Deart_1) / RAD,
    -0.020200 / RAD,
    0.90000e-5 / RAD,
    0.15000e-6 / RAD,
  ];

  const peri = [
    dms(102, 56, 14.45766 + Dperi),
    1161.24342 / RAD,
    0.529265 / RAD,
    -0.11814e-3 / RAD,
    0.11379e-4 / RAD,
  ];

  if (icor === 1) {
    w[0][3] -= 0.00018865 / RAD;
    w[0][4] -= 0.00001024 / RAD;
    w[1][2] += 0.00470602 / RAD;
    w[1][3] -= 0.00025213 / RAD;
    w[2][2] -= 0.00261070 / RAD;
    w[2][3] -= 0.00010712 / RAD;
  }

  const x2 = w[1][1] / w[0][1];
  const x3 = w[2][1] / w[0][1];
  const y2 = am * bp[0][0] + xa * bp[4][0];
  const y3 = am * bp[0][1] + xa * bp[4][1];

  const d21 = x2 - y2;
  const d22 = w[0][1] * bp[1][0];
  const d23 = w[0][1] * bp[2][0];
  const d24 = w[0][1] * bp[3][0];
  const d25 = y2 / am;

  const d31 = x3 - y3;
  const d32 = w[0][1] * bp[1][1];
  const d33 = w[0][1] * bp[2][1];
  const d34 = w[0][1] * bp[3][1];
  const d35 = y3 / am;

  const Cw2_1 = d21 * Dw1_1 + d25 * Deart_1 + d22 * Dgam + d23 * De + d24 * Dep;
  const Cw3_1 = d31 * Dw1_1 + d35 * Deart_1 + d32 * Dgam + d33 * De + d34 * Dep;

  w[1][1] += Cw2_1 / RAD;
  w[2][1] += Cw3_1 / RAD;

  const del = [
    Array.from({ length: 5 }, (_, i) => w[0][i] - eart[i]),
    Array.from({ length: 5 }, (_, i) => w[0][i] - w[2][i]),
    Array.from({ length: 5 }, (_, i) => w[0][i] - w[1][i]),
    Array.from({ length: 5 }, (_, i) => eart[i] - peri[i]),
  ];
  del[0][0] += CPI;

  const p = [
    [dms(252, 15, 3.216919), 538101628.66888 / RAD, 0, 0, 0],
    [dms(181, 58, 44.758419), 210664136.45777 / RAD, 0, 0, 0],
    [dms(100, 27, 59.138850), 129597742.29300 / RAD, 0, 0, 0],
    [dms(355, 26, 3.642778), 68905077.65936 / RAD, 0, 0, 0],
    [dms(34, 21, 5.379392), 10925660.57335 / RAD, 0, 0, 0],
    [dms(50, 4, 38.902495), 4399609.33632 / RAD, 0, 0, 0],
    [dms(314, 3, 4.354234), 1542482.57845 / RAD, 0, 0, 0],
    [dms(304, 20, 56.808371), 786547.89700 / RAD, 0, 0, 0],
  ];

  const zeta = [...w[0]];
  zeta[1] += (5029.0966 + dPrec) / RAD;

  const delnu = (0.55604 + Dw1_1) / RAD / w[0][1];
  const dele = (0.01789 + De) / RAD;
  const delg = (-0.08066 + Dgam) / RAD;
  const delnp = (-0.06424 + Deart_1) / RAD / w[0][1];
  const delep = (-0.12879 + Dep) / RAD;

  const precP = [0.10180391e-4, 0.47020439e-6, -0.5417367e-9, -0.2507948e-11, 0.463486e-14];
  const precQ = [-0.113469002e-3, 0.12372674e-6, 0.1265417e-8, -0.1371808e-11, -0.320334e-14];

  return {
    w,
    del,
    p,
    zeta,
    delnu,
    dele,
    delg,
    delnp,
    delep,
    dtasm,
    am,
    precP,
    precQ,
  };
}

function buildMainSeries(constants) {
  const files = ['ELP_MAIN.S1', 'ELP_MAIN.S2', 'ELP_MAIN.S3'];
  const NMPB = [];
  const CMPB = [];
  const FMPB = [];
  let index = 0;

  for (let iv = 0; iv < files.length; ++iv) {
    const lines = readLines(path.join(DATA_DIR, files[iv]));
    const count = parseMainHeader(lines[0]);
    const start = index;
    const end = count > 0 ? start + count - 1 : start - 1;
    NMPB.push([count, start, end]);

    if (lines.length !== count + 1) {
      throw new Error(`${files[iv]} 项数不匹配: header=${count}, lines=${lines.length - 1}`);
    }

    for (let n = 0; n < count; ++n) {
      const { ilu, amplitude, b } = parseMainLine(lines[n + 1]);
      let a = amplitude;
      const tgv = b[0] + constants.dtasm * b[4];
      if (iv === 2) {
        a -= (2 * a * constants.delnu) / 3;
      }
      const cmpb = a
        + tgv * (constants.delnp - constants.am * constants.delnu)
        + b[1] * constants.delg
        + b[2] * constants.dele
        + b[3] * constants.delep;
      CMPB.push(cmpb);

      for (let k = 0; k <= 4; ++k) {
        let phase = 0;
        for (let i = 0; i < 4; ++i) {
          phase += ilu[i] * constants.del[i][k];
        }
        if (iv === 2 && k === 0) {
          phase += PIS2;
        }
        FMPB.push(phase);
      }
      ++index;
    }
  }

  if (CMPB.length !== MAX1 || FMPB.length !== MAX1 * 5) {
    throw new Error(`主问题总项数错误: cmpb=${CMPB.length}, fmpb=${FMPB.length}`);
  }

  return { NMPB, CMPB, FMPB };
}

function buildPertSeries(constants) {
  const files = ['ELP_PERT.S1', 'ELP_PERT.S2', 'ELP_PERT.S3'];
  const NPER = [];
  const CPER = [];
  const FPER = [];
  let index = 0;

  for (let iv = 0; iv < files.length; ++iv) {
    const lines = readLines(path.join(DATA_DIR, files[iv]));
    let lineIndex = 0;
    const ivSeries = [];

    for (let it = 0; it <= 3; ++it) {
      const { count, power } = parsePertHeader(lines[lineIndex++]);
      if (power !== it) {
        throw new Error(`${files[iv]} 幂次不匹配: 期望 ${it}, 实际 ${power}`);
      }
      const start = index;
      const end = count > 0 ? start + count - 1 : start - 1;
      ivSeries.push([count, start, end]);

      for (let n = 0; n < count; ++n) {
        const { s, c, ifi } = parsePertLine(lines[lineIndex++]);
        const cper = Math.hypot(s, c);
        let pha = Math.atan2(c, s);
        if (pha < 0) {
          pha += DPI;
        }
        CPER.push(cper);

        for (let k = 0; k <= 4; ++k) {
          let phase = k === 0 ? pha : 0;
          for (let i = 0; i < 4; ++i) {
            phase += ifi[i] * constants.del[i][k];
          }
          for (let i = 0; i < 8; ++i) {
            phase += ifi[i + 4] * constants.p[i][k];
          }
          phase += ifi[12] * constants.zeta[k];
          FPER.push(phase);
        }
        ++index;
      }
    }

    if (lineIndex !== lines.length) {
      throw new Error(`${files[iv]} 存在未消费行: ${lines.length - lineIndex}`);
    }

    NPER.push(ivSeries);
  }

  if (CPER.length !== MAX2 || FPER.length !== MAX2 * 5) {
    throw new Error(`摄动总项数错误: cper=${CPER.length}, fper=${FPER.length}`);
  }

  return { NPER, CPER, FPER };
}

function copyPertTerm(source, index, targetCPER, targetFPER) {
  targetCPER.push(source.CPER[index]);
  const offset = 5 * index;
  for (let k = 0; k < 5; ++k) {
    targetFPER.push(source.FPER[offset + k]);
  }
}

function truncatePertSeries(source, threshold) {
  const NPER = [];
  const CPER = [];
  const FPER = [];

  for (let iv = 0; iv < source.NPER.length; ++iv) {
    const ivSeries = [];

    for (let it = 0; it <= 3; ++it) {
      const [, sourceStart, sourceEnd] = source.NPER[iv][it];
      const start = CPER.length;
      let count = 0;

      for (let n = sourceStart; n <= sourceEnd; ++n) {
        if (it === 0 && source.CPER[n] < threshold) {
          continue;
        }
        copyPertTerm(source, n, CPER, FPER);
        ++count;
      }

      const end = count > 0 ? start + count - 1 : start - 1;
      ivSeries.push([count, start, end]);
    }

    NPER.push(ivSeries);
  }

  return { NPER, CPER, FPER };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error(`非法数值: ${value}`);
  }
  if (Object.is(value, -0)) {
    return '-0';
  }
  return value.toString();
}

function formatArrayLiteral(values) {
  return `[${values.map(formatNumber).join(', ')}]`;
}

function formatNestedArray(values) {
  return JSON.stringify(values);
}

function formatFloat64Array(name, values, itemsPerLine) {
  const lines = [];
  for (let i = 0; i < values.length; i += itemsPerLine) {
    const chunk = values.slice(i, i + itemsPerLine).map(formatNumber).join(', ');
    lines.push(`  ${chunk}`);
  }
  return `export const ${name} = new Float64Array([\n${lines.join(',\n')}\n]);\n`;
}

function generateDataModule(constants, mainSeries, pertSeries, datasetNote) {
  return `/**\n * 本文件由 scripts/build_elpmpp02.cjs 自动生成。\n * 数据来源: data/elpmpp02/ELP_MAIN.S1..S3, ELP_PERT.S1..S3\n * 常数模式: DE405 (icor=1)\n * 数据集: ${datasetNote}\n */\n\nexport const W1 = ${formatArrayLiteral(constants.w[0])};\nexport const PREC_P = ${formatArrayLiteral(constants.precP)};\nexport const PREC_Q = ${formatArrayLiteral(constants.precQ)};\nexport const A405 = ${formatNumber(A405)};\nexport const AELP = ${formatNumber(AELP)};\n\nexport const NMPB = ${formatNestedArray(mainSeries.NMPB)};\n${formatFloat64Array('CMPB', mainSeries.CMPB, 6)}\n${formatFloat64Array('FMPB', mainSeries.FMPB, 5)}\nexport const NPER = ${formatNestedArray(pertSeries.NPER)};\n${formatFloat64Array('CPER', pertSeries.CPER, 6)}\n${formatFloat64Array('FPER', pertSeries.FPER, 5)}`;
}

function countPertTerms(series, power) {
  return series.NPER.reduce((sum, ivSeries) => sum + ivSeries[power][0], 0);
}

function main() {
  const constants = initializeConstants(1);
  const mainSeries = buildMainSeries(constants);
  const fullPertSeries = buildPertSeries(constants);
  const truncPertSeries = truncatePertSeries(fullPertSeries, TRUNC_5E4_THRESHOLD);

  const outputFull = generateDataModule(constants, mainSeries, fullPertSeries, '完整 DE405 表');
  const outputTrunc5e4 = generateDataModule(
    constants,
    mainSeries,
    truncPertSeries,
    `5e-4 截断表（仅保留 t^0 摄动中 |A| >= ${formatNumber(TRUNC_5E4_THRESHOLD)} 的项；t^1/t^2/t^3 全保留）`,
  );

  fs.writeFileSync(OUT_FILE_FULL, outputFull, 'utf8');
  fs.writeFileSync(OUT_FILE_TRUNC_5E4, outputTrunc5e4, 'utf8');

  const fullT0 = countPertTerms(fullPertSeries, 0);
  const truncT0 = countPertTerms(truncPertSeries, 0);
  const higherOrder = countPertTerms(fullPertSeries, 1) + countPertTerms(fullPertSeries, 2) + countPertTerms(fullPertSeries, 3);

  console.log(`已生成: ${path.relative(ROOT_DIR, OUT_FILE_FULL)}`);
  console.log(`已生成: ${path.relative(ROOT_DIR, OUT_FILE_TRUNC_5E4)}`);
  console.log(`主问题: ${mainSeries.CMPB.length} 项`);
  console.log(`完整版摄动: ${fullPertSeries.CPER.length} 项`);
  console.log(
    `5e-4 截断摄动: ${truncPertSeries.CPER.length} 项 (t^0 保留 ${truncT0}/${fullT0}, t^1/t^2/t^3 保留 ${higherOrder} 项)`,
  );
}

main();
