#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const TXT_FILE = path.join(__dirname, '..', '..', 'data', 'elpmpp02', 'ELPMPP02.TXT');
const MODULE_FILE = path.join(__dirname, 'src', 'ephemeris', 'astronomy', 'elpmpp02.js');
const TOLERANCE_KM = 0.1;
const J2000_JD = 2451545.0;

function parseReferencePoints() {
  const text = fs.readFileSync(TXT_FILE, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n').filter(Boolean);
  const points = [];

  for (let i = 0; i < lines.length; ) {
    const jdMatch = lines[i].match(/^\s*JD\s+(-?\d+(?:\.\d+)?)\s*$/);
    if (!jdMatch) {
      throw new Error(`无法解析 JD 行: ${lines[i]}`);
    }
    const xyzMatch = lines[i + 1].match(/^\s*X\s*=\s*([+-]?\d+(?:\.\d+)?)\s+Y\s*=\s*([+-]?\d+(?:\.\d+)?)\s+Z\s*=\s*([+-]?\d+(?:\.\d+)?)\s+km\s*$/);
    if (!xyzMatch) {
      throw new Error(`无法解析 XYZ 行: ${lines[i + 1]}`);
    }
    points.push({
      jd: Number(jdMatch[1]),
      x: Number(xyzMatch[1]),
      y: Number(xyzMatch[2]),
      z: Number(xyzMatch[3]),
    });
    i += 3;
  }

  return points.slice(-15);
}

(async function main() {
  const { elpmpp02 } = await import(pathToFileURL(MODULE_FILE).href);
  const refs = parseReferencePoints();
  let allPass = true;
  let maxAxisError = 0;

  console.log('=== ELPMPP02 DE405 验证 ===\n');

  for (const ref of refs) {
    const [x, y, z] = elpmpp02(ref.jd - J2000_JD);
    const dx = Math.abs(x - ref.x);
    const dy = Math.abs(y - ref.y);
    const dz = Math.abs(z - ref.z);
    const pass = dx <= TOLERANCE_KM && dy <= TOLERANCE_KM && dz <= TOLERANCE_KM;

    maxAxisError = Math.max(maxAxisError, dx, dy, dz);
    if (!pass) {
      allPass = false;
    }

    console.log(`[${pass ? 'PASS' : 'FAIL'}] JD ${ref.jd.toFixed(1)}`);
    console.log(`  calc: X=${x.toFixed(7)}  Y=${y.toFixed(7)}  Z=${z.toFixed(7)}`);
    console.log(`  ref : X=${ref.x.toFixed(7)}  Y=${ref.y.toFixed(7)}  Z=${ref.z.toFixed(7)}`);
    console.log(`  err : |dX|=${dx.toFixed(7)}  |dY|=${dy.toFixed(7)}  |dZ|=${dz.toFixed(7)}`);
  }

  console.log(`\nmax axis error = ${maxAxisError.toFixed(7)} km`);
  console.log(`=== 总结: ${allPass ? '全部通过' : '存在失败'} ===`);
  process.exit(allPass ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
