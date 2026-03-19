import { A405, AELP, CMPB, CPER, FMPB, FPER, NMPB, NPER, PREC_P, PREC_Q, W1 } from './elpmpp02_data.js';
'use strict';

const PI = Math.PI;
const RAD = 648000 / PI;
const SC = 36525;

/**
 * 计算 ELP/MPP02 (DE405 常数集, icor=1) 的月球地心 J2000 平黄道直角坐标。
 *
 * @param {number} tjDays
 *      TT 标度下，自 J2000 起算的日数，即 JD(TT) - 2451545.0。
 *
 * @returns {[number, number, number]}
 *      [X, Y, Z]，单位 km，坐标系为 J2000 平黄道平春分。
 */
export function elpmpp02(tjDays) {
    const t1 = tjDays / SC;
    const t2 = t1 * t1;
    const t3 = t2 * t1;
    const t4 = t3 * t1;

    const v = [0, 0, 0];
    const tp = [1, t1, t2, t3];

    for (let iv = 0; iv < 3; ++iv) {
        let sum = 0;

        for (let n = NMPB[iv][1]; n <= NMPB[iv][2]; ++n) {
            const i = 5 * n;
            const arg = FMPB[i] + FMPB[i + 1] * t1 + FMPB[i + 2] * t2 + FMPB[i + 3] * t3 + FMPB[i + 4] * t4;
            sum += CMPB[n] * Math.sin(arg);
        }

        for (let it = 0; it <= 3; ++it) {
            const factor = tp[it];
            if (factor === 0) {
                continue;
            }
            for (let n = NPER[iv][it][1]; n <= NPER[iv][it][2]; ++n) {
                const i = 5 * n;
                const arg = FPER[i] + FPER[i + 1] * t1 + FPER[i + 2] * t2 + FPER[i + 3] * t3 + FPER[i + 4] * t4;
                sum += CPER[n] * factor * Math.sin(arg);
            }
        }

        v[iv] = sum;
    }

    const lon = v[0] / RAD + W1[0] + W1[1] * t1 + W1[2] * t2 + W1[3] * t3 + W1[4] * t4;
    const lat = v[1] / RAD;
    const dist = v[2] * A405 / AELP;

    const clamb = Math.cos(lon);
    const slamb = Math.sin(lon);
    const cbeta = Math.cos(lat);
    const sbeta = Math.sin(lat);
    const cw = dist * cbeta;
    const sw = dist * sbeta;

    const x1 = cw * clamb;
    const x2 = cw * slamb;
    const x3 = sw;

    const pw = (PREC_P[0] + PREC_P[1] * t1 + PREC_P[2] * t2 + PREC_P[3] * t3 + PREC_P[4] * t4) * t1;
    const qw = (PREC_Q[0] + PREC_Q[1] * t1 + PREC_Q[2] * t2 + PREC_Q[3] * t3 + PREC_Q[4] * t4) * t1;
    const ra = 2 * Math.sqrt(1 - pw * pw - qw * qw);
    const pwqw = 2 * pw * qw;
    const pw2 = 1 - 2 * pw * pw;
    const qw2 = 1 - 2 * qw * qw;
    const pwra = pw * ra;
    const qwra = qw * ra;

    const X = pw2 * x1 + pwqw * x2 + pwra * x3;
    const Y = pwqw * x1 + qw2 * x2 - qwra * x3;
    const Z = -pwra * x1 + qwra * x2 + (pw2 + qw2 - 1) * x3;

    return [X, Y, Z];
}
