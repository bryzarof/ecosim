const fs = require('fs');
const path = require('path');
const vm = require('vm');

let seededRandom;
let valueNoise2D;

beforeAll(() => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'noise.js'), 'utf8');
  const transformed = code
    .replace('export function seededRandom', 'function seededRandom')
    .replace('export function valueNoise2D', 'function valueNoise2D');
  const moduleCode = `${transformed}\nmodule.exports = { seededRandom, valueNoise2D };`;
  const module = { exports: {} };
  vm.runInNewContext(moduleCode, { module, exports: module.exports, require });
  ({ seededRandom, valueNoise2D } = module.exports);
});

describe('seededRandom', () => {
  test('generates deterministic sequence within [0,1)', () => {
    const rng1 = seededRandom(123);
    const rng2 = seededRandom(123);
    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];
    expect(seq1).toEqual(seq2);
    for (const n of seq1) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('valueNoise2D', () => {
  test('produces reproducible 2D noise values between 0 and 1', () => {
    const rng1 = seededRandom(1);
    const out1 = valueNoise2D(4, 4, 2, rng1);
    expect(ArrayBuffer.isView(out1)).toBe(true);
    expect(out1).toHaveLength(16);
    for (const v of out1) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    const rng2 = seededRandom(1);
    const out2 = valueNoise2D(4, 4, 2, rng2);
    expect(Array.from(out1)).toEqual(Array.from(out2));
  });
});
