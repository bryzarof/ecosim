/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let loadSettings;
let saveSettings;

beforeAll(() => {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'state', 'persistence.js'),
    'utf8'
  );
  const transformed = code
    .replace('export function loadSettings', 'function loadSettings')
    .replace('export function saveSettings', 'function saveSettings');
  const moduleCode = `${transformed}\nmodule.exports = { loadSettings, saveSettings };`;
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require, console, localStorage };
  vm.runInNewContext(moduleCode, sandbox);
  ({ loadSettings, saveSettings } = sandbox.module.exports);
});

describe('persistence', () => {
  const KEY = 'ecosim-settings';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loadSettings retrieves and parses stored settings', () => {
    const data = { theme: 'dark', volume: 0.5 };
    jest
      .spyOn(Object.getPrototypeOf(window.localStorage), 'getItem')
      .mockReturnValueOnce(JSON.stringify(data));

    const result = loadSettings();

    expect(result).toEqual(data);
    expect(localStorage.getItem).toHaveBeenCalledWith(KEY);
  });

  test('loadSettings returns default and warns when storage throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest
      .spyOn(Object.getPrototypeOf(window.localStorage), 'getItem')
      .mockImplementation(() => {
        throw new Error('failure');
      });

    const result = loadSettings();

    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith('Failed to load settings', expect.any(Error));
  });

  test('loadSettings returns default and warns when JSON is invalid', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest
      .spyOn(Object.getPrototypeOf(window.localStorage), 'getItem')
      .mockReturnValueOnce('{invalid');

    const result = loadSettings();

    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [msg, err] = warnSpy.mock.calls[0];
    expect(msg).toBe('Failed to load settings');
    expect(typeof err.message).toBe('string');
  });

  test('saveSettings writes stringified settings to storage', () => {
    const setSpy = jest
      .spyOn(Object.getPrototypeOf(window.localStorage), 'setItem')
      .mockImplementation(() => {});
    const settings = { quality: 'high' };

    saveSettings(settings);

    expect(setSpy).toHaveBeenCalledWith(KEY, JSON.stringify(settings));
  });

  test('saveSettings warns when storage throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest
      .spyOn(Object.getPrototypeOf(window.localStorage), 'setItem')
      .mockImplementation(() => {
        throw new Error('failure');
      });

    saveSettings({ a: 1 });

    expect(warnSpy).toHaveBeenCalledWith('Failed to save settings', expect.any(Error));
  });
});

