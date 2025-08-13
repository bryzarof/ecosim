const fs = require('fs');
const path = require('path');
const vm = require('vm');

let seededRandom, valueNoise2D;

beforeAll(() => {
  const code = fs.readFileSync(path.join(__dirname, '../src/utils/noise.js'), 'utf8');
  const transformed = code
    .replace('export function seededRandom', 'function seededRandom')
    .replace('export function valueNoise2D', 'function valueNoise2D');
  const moduleCode = `${transformed}\nmodule.exports = { seededRandom, valueNoise2D };`;
  const module = { exports: {} };
  vm.runInNewContext(moduleCode, { module, exports: module.exports, require });
  ({ seededRandom, valueNoise2D } = module.exports);
});

test('seededRandom produces reproducible sequences', () => {
  const rng1 = seededRandom(123);
  const rng2 = seededRandom(123);
  const seq1 = [rng1(), rng1(), rng1()];
  const seq2 = [rng2(), rng2(), rng2()];
  expect(seq1).toEqual(seq2);
});

test('valueNoise2D returns correct size and range', () => {
  const rng = seededRandom(1);
  const noise = valueNoise2D(4, 4, 2, rng);
  expect(noise).toHaveLength(16);
  for (const v of noise) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
});

test('valueNoise2D is deterministic for same seed', () => {
  const rng1 = seededRandom(42);
  const rng2 = seededRandom(42);
  const n1 = Array.from(valueNoise2D(4, 4, 2, rng1));
  const n2 = Array.from(valueNoise2D(4, 4, 2, rng2));
  expect(n1).toEqual(n2);
});
