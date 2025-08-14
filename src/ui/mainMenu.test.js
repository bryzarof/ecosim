/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

let initMainMenu;

beforeAll(() => {
  const code = fs.readFileSync(path.join(__dirname, 'mainMenu.js'), 'utf8');
  const transformed = code.replace('export function initMainMenu', 'function initMainMenu');
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'require', `${transformed}\nmodule.exports = { initMainMenu };`);
  fn(module, module.exports, require);
  initMainMenu = module.exports.initMainMenu;
  global.requestAnimationFrame = (cb) => cb();
});

test('initMainMenu pauses until play is clicked', () => {
  document.body.innerHTML = '<div id="mainMenu"></div>';
  const state = { paused: false };
  initMainMenu(state);

  const root = document.getElementById('mainMenu');
  expect(root.classList.contains('show')).toBe(true);
  expect(state.paused).toBe(true);

   const logo = root.querySelector('#mainMenuLogo');
  expect(logo).not.toBeNull();

  const playBtn = root.querySelector('button[data-action="play"]');
  playBtn.click();

  expect(root.classList.contains('hide')).toBe(true);
  expect(state.paused).toBe(false);
});
