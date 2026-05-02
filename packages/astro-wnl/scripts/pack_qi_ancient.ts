import * as fs from 'fs';
import * as path from 'path';

const corrections: number[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'qi_ancient_corrections.json'), 'utf8')
);

const qiDates: number[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'sxwnl_dart', 'qi_dates_merged.json'), 'utf8')
);

const ancient = qiDates.slice(0, 44781);
const FIRST_QI_JD = ancient[0]!;
const LAST_QI_JD = ancient[ancient.length - 1]!;
const QI_PERIOD = (LAST_QI_JD - FIRST_QI_JD) / (ancient.length - 1);

console.log(`Loaded ${corrections.length} ancient corrections`);
console.log(`Derived FIRST_QI_JD=${FIRST_QI_JD}, QI_PERIOD=${QI_PERIOD.toFixed(6)}`);

function pack3Bit(data: number[]): Uint8Array {
  const bytes = Math.ceil((data.length * 3) / 8);
  const packed = new Uint8Array(bytes);
  let bitPos = 0;
  for (let i = 0; i < data.length; i++) {
    let bits: number;
    if (data[i] === 0) bits = 0;
    else if (data[i] === 1) bits = 1;
    else if (data[i] === -1) bits = 2;
    else if (data[i] === 2) bits = 3;
    else if (data[i] === -2) bits = 4;
    else if (data[i] === 3) bits = 5;
    else if (data[i] === 4) bits = 6;
    else {
      console.warn(`Warning: unsupported correction ${data[i]} at index ${i}, clamping to 0`);
      bits = 0;
    }

    const byteIdx = Math.floor(bitPos / 8);
    const shift = 5 - (bitPos % 8);
    if (shift >= 0) {
      packed[byteIdx]! |= bits << shift;
    } else {
      packed[byteIdx]! |= bits >> (-shift);
      if (byteIdx + 1 < packed.length) {
        packed[byteIdx + 1]! |= (bits & ((1 << (-shift)) - 1)) << (8 + shift);
      }
    }
    bitPos += 3;
  }
  return packed;
}

const packed = pack3Bit(corrections);

// Verify
function unpack3Bit(data: Uint8Array, index: number): number {
  const bitPos = index * 3;
  const byteIdx = Math.floor(bitPos / 8);
  const shift = 5 - (bitPos % 8);
  if (shift >= 0) {
    return (data[byteIdx]! >> shift) & 0x7;
  } else {
    const lowBits = (data[byteIdx]! & ((1 << (8 - (bitPos % 8))) - 1)) << (-shift);
    const highBits = data[byteIdx + 1]! >> (8 + shift);
    return (lowBits | highBits) & 0x7;
  }
}

const QI_CORRECTION_MAP = [0, 1, -1, 2, -2, 3, 4, 0];
for (let i = 0; i < corrections.length; i++) {
  const packedVal = unpack3Bit(packed, i);
  const decoded = QI_CORRECTION_MAP[packedVal]!;
  if (decoded !== corrections[i]) {
    throw new Error(`Verify failed at ${i}: expected ${corrections[i]}, got ${decoded} (packed=${packedVal})`);
  }
}

console.log(`Verified ${corrections.length} entries`);

const hexBytes = Array.from(packed).map(b => '0x' + b.toString(16).padStart(2, '0'));
const lines: string[] = [];
for (let i = 0; i < hexBytes.length; i += 16) {
  lines.push('  ' + hexBytes.slice(i, i + 16).join(', ') + ',');
}

const tsCode = `// Auto-generated ancient qi correction table (3-bit per entry)
// Total entries: ${corrections.length}
// Range: -221 BC ~ 1645 AD (pingqi / 平气 era)
// 3-bit encoding: 0=000, +1=001, -1=010, +2=011, -2=100, +3=101, +4=110
//
// Index parameters derived from sxwnl output data:
//   FIRST_QI_JD = ${FIRST_QI_JD}
//   QI_PERIOD   = ${QI_PERIOD.toFixed(6)}
export const QI_ANCIENT_CORRECTION_COUNT = ${corrections.length};
export const QI_ANCIENT_FIRST_JD = ${FIRST_QI_JD};
export const QI_ANCIENT_PERIOD = ${QI_PERIOD};
export const QI_ANCIENT_DATA = new Uint8Array([
${lines.join('\n')}
]);

export const QI_ANCIENT_MAP: Record<number, number> = {
  0b000: 0,
  0b001: 1,
  0b010: -1,
  0b011: 2,
  0b100: -2,
  0b101: 3,
  0b110: 4,
  0b111: 0,
};
`;

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'historical', 'qi_ancient_correction_table.ts'),
  tsCode
);
console.log(`Saved qi_ancient_correction_table.ts (${packed.length} bytes)`);
