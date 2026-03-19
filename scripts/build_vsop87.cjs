#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data', 'vsop87');
const OUT_FILE = path.join(ROOT_DIR, 'packages', 'astro-wnl', 'src', 'ephemeris', 'astronomy', 'vsop87_data.js');

// Planet files in the order astronomy-engine expects
const PLANETS = [
  { name: 'Mercury', file: 'VSOP87B.mer' },
  { name: 'Venus',   file: 'VSOP87B.ven' },
  { name: 'Earth',   file: 'VSOP87B.ear' },
  { name: 'Mars',    file: 'VSOP87B.mar' },
  { name: 'Jupiter', file: 'VSOP87B.jup' },
  { name: 'Saturn',  file: 'VSOP87B.sat' },
  { name: 'Uranus',  file: 'VSOP87B.ura' },
  { name: 'Neptune', file: 'VSOP87B.nep' },
];

/**
 * Parse a VSOP87B file into structured data.
 * Returns: [ L, B, R ]
 *   where each is: [ T^0_terms, T^1_terms, ... ]
 *     where each term is: [A, B, C]
 *
 * Header line format (fixed width):
 *   col 0-16:  " VSOP87 VERSION B2"
 *   col 41: VARIABLE number (1=L, 2=B, 3=R)
 *   col 59: power of T (0,1,2,...)
 *   col 60-66: term count
 *
 * Data line format:
 *   The last three floats are A (amplitude), B (phase), C (frequency).
 *   A: col 79-96
 *   B: col 97-110
 *   C: col 111-130 (approx)
 */
function parseVSOP87B(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
  const lines = text.split('\n');

  // result[variable 0..2][power] = [[A,B,C], ...]
  const result = [[], [], []]; // L, B, R

  let currentVar = -1;
  let currentPower = -1;
  let currentTerms = [];
  let expectedCount = 0;

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Detect header line
    if (line.indexOf('VSOP87') >= 0 && line.indexOf('VARIABLE') >= 0) {
      // Save previous block
      if (currentVar >= 0 && currentTerms.length > 0) {
        result[currentVar].push(currentTerms);
        if (currentTerms.length !== expectedCount) {
          throw new Error(`项数不匹配: 期望 ${expectedCount}, 实际 ${currentTerms.length}, var=${currentVar+1}, power=${currentPower}`);
        }
      }

      // Parse header
      const varMatch = line.match(/VARIABLE\s+(\d)/);
      const powerMatch = line.match(/\*T\*\*(\d+)/);
      const countMatch = line.match(/(\d+)\s+TERMS/);

      if (!varMatch || !powerMatch || !countMatch) {
        throw new Error(`无法解析头行: ${line}`);
      }

      currentVar = parseInt(varMatch[1]) - 1; // 0=L, 1=B, 2=R
      currentPower = parseInt(powerMatch[1]);
      expectedCount = parseInt(countMatch[1]);
      currentTerms = [];
      continue;
    }

    // Data line: 5 floats per line: S, K, A, B, C
    // We need the last 3: A (amplitude), B (phase), C (frequency)
    const floats = line.match(/[+-]?\d+\.\d+/g);
    if (!floats || floats.length < 5) {
      throw new Error(`无法解析数据行 (期望5个浮点数, 实际${floats ? floats.length : 0}): ${line}`);
    }
    const A = parseFloat(floats[2]);
    const B = parseFloat(floats[3]);
    const C = parseFloat(floats[4]);

    currentTerms.push([A, B, C]);
  }

  // Save last block
  if (currentVar >= 0 && currentTerms.length > 0) {
    result[currentVar].push(currentTerms);
    if (currentTerms.length !== expectedCount) {
      throw new Error(`项数不匹配: 期望 ${expectedCount}, 实际 ${currentTerms.length}, var=${currentVar+1}, power=${currentPower}`);
    }
  }

  return result;
}

function formatNumber(v) {
  if (!Number.isFinite(v)) throw new Error(`非法数值: ${v}`);
  // Use enough precision to match astronomy-engine's existing data
  // VSOP87 original data has ~11 decimal digits
  // Strip trailing zeros in mantissa, but preserve exponent part
  const s = v.toPrecision(14);
  const [mantissa, exp] = s.split('e');
  const trimmed = mantissa.replace(/\.?0+$/, '').replace(/^(-?)\./, '$10.');
  return exp ? trimmed + 'e' + exp : trimmed;
}

function formatTriplet(abc) {
  return `[${formatNumber(abc[0])}, ${formatNumber(abc[1])}, ${formatNumber(abc[2])}]`;
}

function generateOutput(allPlanets) {
  const parts = [];
  parts.push('/**');
  parts.push(' * VSOP87B 行星星历数据。');
  parts.push(' * 由 scripts/build_vsop87.cjs 从原始 VSOP87B 文件自动生成。');
  parts.push(' * 坐标: 日心 J2000 动力学黄道球坐标 (L, B, R)');
  parts.push(' * 时间变量: 千儒略年 t = (JD_TT - 2451545.0) / 365250');
  parts.push(' */');
  parts.push('');
  parts.push('export const vsop = {');

  for (let pi = 0; pi < allPlanets.length; ++pi) {
    const { name, data } = allPlanets[pi];
    parts.push(`    ${name}: [`);

    // L, B, R
    for (let vi = 0; vi < data.length; ++vi) {
      const varData = data[vi];
      if (varData.length === 0) {
        parts.push('        [],');
        continue;
      }
      parts.push('        [');
      for (let ti = 0; ti < varData.length; ++ti) {
        const terms = varData[ti];
        parts.push('            [');
        for (let i = 0; i < terms.length; ++i) {
          const comma = i < terms.length - 1 ? ',' : '';
          parts.push(`                ${formatTriplet(terms[i])}${comma}`);
        }
        const tComma = ti < varData.length - 1 ? ',' : '';
        parts.push(`            ]${tComma}`);
      }
      const vComma = vi < data.length - 1 ? ',' : '';
      parts.push(`        ]${vComma}`);
    }

    const pComma = pi < allPlanets.length - 1 ? ',' : '';
    parts.push(`    ]${pComma}`);
  }

  parts.push('};');
  parts.push('');
  return parts.join('\n');
}

function main() {
  const allPlanets = [];
  let totalTerms = 0;

  for (const planet of PLANETS) {
    const filePath = path.join(DATA_DIR, planet.file);
    const data = parseVSOP87B(filePath);
    allPlanets.push({ name: planet.name, data });

    let planetTerms = 0;
    for (const varData of data) {
      for (const terms of varData) {
        planetTerms += terms.length;
      }
    }
    console.log(`${planet.name}: ${planetTerms} 项`);
    totalTerms += planetTerms;
  }

  const output = generateOutput(allPlanets);
  fs.writeFileSync(OUT_FILE, output, 'utf8');

  console.log(`\n总计: ${totalTerms} 项`);
  console.log(`已生成: ${path.relative(ROOT_DIR, OUT_FILE)}`);
  console.log(`文件大小: ${(Buffer.byteLength(output) / 1024).toFixed(1)} KB`);
}

main();
