const { performance } = require('node:perf_hooks');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let step;
beforeAll(() => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'physics.js'), 'utf8');
  const transformed = code.replace('export function step', 'function step');
  const moduleCode = `${transformed}\nmodule.exports = { step };`;
  const module = { exports: {} };
  vm.runInNewContext(moduleCode, { module, exports: module.exports, require });
  step = module.exports.step;
});

function createTestState(count = 300) {
  const WORLD_W = 100;
  const WORLD_H = 60;
  const total = WORLD_W * WORLD_H;
  const plant = new Float32Array(total).fill(0.5);
  const soilMoisture = new Float32Array(total).fill(0.5);
  const terrain = new Uint8Array(total);
  const animals = [];
  const speciesConfig = {
    HERB: { hungerRate: 0, vision: 5, size: 'medium', reproThreshold: 2, reproCost: 1, reproCooldown: 1 },
    CARN: { hungerRate: 0, vision: 5, size: 'medium', reproThreshold: 2, reproCost: 1, reproCooldown: 1 },
    RODENT: { hungerRate: 0, vision: 5, size: 'small', reproThreshold: 2, reproCost: 1, reproCooldown: 1 },
    WOLF: { hungerRate: 0, vision: 5, size: 'medium', reproThreshold: 2, reproCost: 1, reproCooldown: 1 },
    POLLINATOR: { hungerRate: 0, vision: 5, size: 'small', reproThreshold: 2, reproCost: 1, reproCooldown: 1 },
  };
  const species = Object.keys(speciesConfig);
  for (let i = 0; i < count; i++) {
    const sp = species[i % species.length];
    animals.push({
      sp,
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      dir: 0,
      r: 0.32,
      speed: 1,
      energy: 1,
      genes: { lifespan: 1000, speedMul: 1, metabolismMul: 0, visionMul: 1 },
      cooldown: 0,
      age: 0,
      wobble: 0.5,
    });
  }
  const GRID_SIZE = 10;
  const GRID_W = Math.ceil(WORLD_W / GRID_SIZE);
  const GRID_H = Math.ceil(WORLD_H / GRID_SIZE);
  const grid = Array.from({ length: GRID_W * GRID_H }, () => []);
  const idx = (x, y) => y * WORLD_W + x;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const state = {
    TILE: 10,
    WORLD_W,
    WORLD_H,
    animals,
    plant,
    terrain,
    soilMoisture,
    speciesConfig,
    spawnEnabled: Object.fromEntries(species.map(s => [s, false])),
    hiddenSpecies: Object.fromEntries(species.map(s => [s, false])),
    spawnRate: Object.fromEntries(species.map(s => [s, 0])),
    reproThresholdMul: Object.fromEntries(species.map(s => [s, 1])),
    mortalityMul: Object.fromEntries(species.map(s => [s, 1])),
    CROWD_DECAY: 0.6,
    SMALL_LIMIT: 0.3,
    LARGE_LIMIT: 0.36,
    CROWD_THRESH: { small: 6, medium: 4, large: 2 },
    crowdSmall: new Float32Array(total),
    crowdMedium: new Float32Array(total),
    crowdLarge: new Float32Array(total),
    GRID_SIZE,
    GRID_W,
    GRID_H,
    grid,
    cellIndex: (gx, gy) => gy * GRID_W + gx,
    idx,
    clamp,
    nearestOfSpecies: () => null,
    moveCreature: (a, dt, speed) => { a.x += Math.cos(a.dir) * speed * dt; a.y += Math.sin(a.dir) * speed * dt; },
    clampInside: (a) => { a.x = clamp(a.x, 0, WORLD_W - 1e-3); a.y = clamp(a.y, 0, WORLD_H - 1e-3); },
    eatPlant: () => {},
    reproduce: () => {},
    dist2: (a, b) => { const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy; },
    isNight: () => false,
    growPlants: () => {
      for (let i = 0; i < total; i++) {
        plant[i] = clamp(plant[i] + 0.001, 0, 1);
        soilMoisture[i] = clamp(soilMoisture[i] + 0.001, 0, 1);
      }
    },
    advanceWeather: () => {},
    simTime: 0,
    worldTime: 0,
    weatherTimer: 0,
    weatherState: 0,
    accPlant: 0,
    fire: null,
  };
  return state;
}

function simulateMinutes(state, minutes) {
  const dt = 1; // seconds per step
  const steps = minutes * 60;
  for (let i = 0; i < steps; i++) {
    step(state, dt);
  }
}

test('soilMoisture and plant arrays share dimensions and stay within [0,1]', () => {
  const state = createTestState();
  simulateMinutes(state, 5);
  const total = state.WORLD_W * state.WORLD_H;
  expect(state.plant.length).toBe(total);
  expect(state.soilMoisture.length).toBe(total);
  for (let i = 0; i < total; i++) {
    expect(state.plant[i]).toBeGreaterThanOrEqual(0);
    expect(state.plant[i]).toBeLessThanOrEqual(1);
    expect(state.soilMoisture[i]).toBeGreaterThanOrEqual(0);
    expect(state.soilMoisture[i]).toBeLessThanOrEqual(1);
  }
});

test('population counts remain within reasonable bounds', () => {
  const state = createTestState();
  const species = Object.keys(state.speciesConfig);
  const initial = Object.fromEntries(species.map(s => [s, state.animals.filter(a => a.sp === s).length]));
  simulateMinutes(state, 5);
  const finalCounts = Object.fromEntries(species.map(s => [s, state.animals.filter(a => a.sp === s).length]));
  for (const sp of species) {
    const min = initial[sp] * 0.5;
    const max = initial[sp] * 1.5;
    expect(finalCounts[sp]).toBeGreaterThanOrEqual(min);
    expect(finalCounts[sp]).toBeLessThanOrEqual(max);
  }
});

test('simulation performance with ~300 individuals is >=55 FPS', () => {
  const state = createTestState(300);
  const frames = 120;
  const dt = 1 / 60;
  const start = performance.now();
  for (let i = 0; i < frames; i++) {
    step(state, dt);
  }
  const elapsed = (performance.now() - start) / 1000;
  const fps = frames / elapsed;
  expect(fps).toBeGreaterThanOrEqual(55);
});
