/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let initRadialMenu;
beforeAll(() => {
  jest.useFakeTimers();
  const code = fs.readFileSync(path.join(__dirname, 'src/ui/radialMenu.js'), 'utf8');
  const transformed = code.replace('export function initRadialMenu', 'function initRadialMenu');
  const moduleCode = `${transformed}\nmodule.exports = { initRadialMenu };`;
  const module = { exports: {} };
  vm.runInNewContext(moduleCode, { module, exports: module.exports, require, document: window.document, setTimeout, clearTimeout });
  initRadialMenu = module.exports.initRadialMenu;
});

afterAll(() => {
  jest.useRealTimers();
});

test('destroy removes event listeners from radial menu', () => {
  document.body.innerHTML = '<div id="root"></div>';
  const onSelect = jest.fn();
  const destroy = initRadialMenu('#root', [{ label: 'A', onSelect }], 0);

  const center = document.querySelector('#root .radial-btn');
  const menu = document.querySelector('#root .radial-options');
  const option = menu.querySelector('button');

  center.dispatchEvent(new MouseEvent('mousedown'));
  jest.runAllTimers();
  expect(menu.classList.contains('open')).toBe(true);
  option.dispatchEvent(new MouseEvent('click'));
  expect(onSelect).toHaveBeenCalledTimes(1);

  destroy();

  menu.classList.remove('open');
  center.dispatchEvent(new MouseEvent('mousedown'));
  jest.runAllTimers();
  expect(menu.classList.contains('open')).toBe(false);
  option.dispatchEvent(new MouseEvent('click'));
  expect(onSelect).toHaveBeenCalledTimes(1);
});

