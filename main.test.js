const fs = require('fs');
const path = require('path');
const vm = require('vm');

let applyActionAt;

beforeAll(() => {
  const code = fs.readFileSync(path.join(__dirname, 'ui.js'), 'utf8');
  const transformed = code
    .replace("import { initRadialMenu } from './src/ui/radialMenu.js';", '')
    .replace("import { saveSettings } from './src/state/persistence.js';", '')
    .replace(
      "import { TOOL } from './main.js';",
      "const TOOL = { INSPECT:'inspect', ADD_HERB:'add_herb', ADD_CARN:'add_carn', ADD_RODENT:'add_rodent', ADD_WOLF:'add_wolf', ADD_POLLINATOR:'add_pollinator', ERASER:'eraser', FOOD:'food', WATER:'water', BARRIER:'barrier' };"
    )
    .replace('export function setTool', 'function setTool')
    .replace('export function applyActionAt', 'function applyActionAt')
    .replace('export function setupUI', 'function setupUI');
  const moduleCode = `${transformed}\nmodule.exports = { applyActionAt };`;
  const module = { exports: {} };
  vm.runInNewContext(moduleCode, { module, exports: module.exports, require });
  applyActionAt = module.exports.applyActionAt;
});

function createState() {
  return {
    idx: () => 0,
    terrain: new Uint8Array([2]),
    plant: new Float32Array([0]),
    BIOME: { GRASS: 2, WATER: 0, BARRIER: 3 },
    animals: [],
    speciesConfig: {
      RODENT: { baseSpeed: 1, radius: 0.3, initEnergy: 1 },
      WOLF: { baseSpeed: 1, radius: 0.38, initEnergy: 1 },
      POLLINATOR: { baseSpeed: 1, radius: 0.28, initEnergy: 1 },
    },
    defaultGenes: () => ({}),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  };
}

test('applyActionAt spawns a rodent', () => {
  const state = createState();
  applyActionAt(state, 0, 0, 'add_rodent');
  expect(state.animals).toHaveLength(1);
  expect(state.animals[0].sp).toBe('RODENT');
});

test('applyActionAt spawns wolf and pollinator', () => {
  const state = createState();
  applyActionAt(state, 0, 0, 'add_wolf');
  applyActionAt(state, 0, 0, 'add_pollinator');
  expect(state.animals.map(a => a.sp)).toEqual(['WOLF', 'POLLINATOR']);
});
