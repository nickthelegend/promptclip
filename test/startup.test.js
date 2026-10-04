const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const mainSource = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');

async function launch({ background = false, primary = true, login = false } = {}) {
  const app = new EventEmitter();
  const windows = [];
  const handlers = new Map();
  const files = new Map();
  let copied = '';
  let shortcut;
  Object.assign(app, {
    setName() {}, requestSingleInstanceLock: () => primary,
    quit() { this.quitting = true; }, whenReady: () => Promise.resolve(),
    isReady: () => true, getPath: () => '/test-data', setLoginItemSettings() {},
    getLoginItemSettings: () => ({ wasOpenedAtLogin: login })
  });
  class Window extends EventEmitter {
    constructor() {
      super(); this.visible = false; this.focused = false;
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, { send() {}, isDevToolsOpened: () => false });
      windows.push(this);
    }
    loadFile() { return Promise.resolve(); }
    isDestroyed() { return false; }
    setPosition(x, y) { this.position = [x, y]; }
    isMinimized() { return false; }
    setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {}
    show() { this.visible = true; } focus() { this.focused = true; }
    hide() { this.visible = false; this.focused = false; }
    isVisible() { return this.visible; } isFocused() { return this.focused; }
  }
  const electron = {
    app, BrowserWindow: Window, Tray: class extends EventEmitter { setToolTip() {} setContextMenu() {} },
    Menu: { buildFromTemplate: () => ({ popup() {} }) },
    globalShortcut: { register: (_key, callback) => { shortcut = callback; return true; }, unregisterAll() {} },
    ipcMain: { handle: (name, callback) => handlers.set(name, callback), on() {} },
    clipboard: { writeText: (value) => { copied = value; } },
    nativeImage: { createFromPath: () => ({ resize() { return this; } }) },
    screen: { getPrimaryDisplay: () => ({ workArea: { x: 100, y: 30 } }) }
  };
  const memoryFs = {
    mkdirSync() {}, existsSync: (file) => files.has(file),
    readFileSync: (file) => { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file); },
    writeFileSync: (file, data) => files.set(file, data),
    renameSync: (from, to) => { files.set(to, files.get(from)); files.delete(from); },
    appendFileSync() {}
  };
  vm.runInNewContext(mainSource, {
    require: (name) => name === 'electron' ? electron : name === 'fs' ? memoryFs
      : name === './default-prompts.json' ? [{ id: 'one', title: 'One', body: 'Copy me' }]
      : name === './prompt-cleaner' ? { cleanPromptText: (value) => value.trim() } : require(name),
    process: { platform: 'darwin', argv: background ? ['app', '--background'] : ['app'] },
    __dirname: path.join(__dirname, '../src'), console
  });
  await Promise.resolve();
  return { app, windows, files, handlers, copy: () => copied, toggle: () => shortcut() };
}

test('normal launch waits for the renderer, then opens a focused picker on screen', async () => {
  const state = await launch();
  const win = state.windows[0];
  assert.equal(win.visible, false);
  win.webContents.emit('did-finish-load');
  assert.equal(win.visible, true);
  assert.equal(win.focused, true);
  assert.deepEqual(win.position, [118, 48]);
  state.toggle(); assert.equal(win.visible, false);
  state.toggle(); assert.equal(win.visible, true);
  win.emit('blur'); assert.equal(win.visible, false);
  state.app.emit('second-instance'); assert.equal(win.visible, true);
  state.app.emit('before-quit'); assert.equal(state.app.isQuitting, true);
});

test('login launches stay in the background until opened', async () => {
  for (const options of [{ background: true }, { login: true }]) {
    const state = await launch(options);
    const win = state.windows[0];
    win.webContents.emit('did-finish-load');
    assert.equal(win.visible, false);
    state.app.emit('activate'); assert.equal(win.visible, true);
  }
});

test('another process exits without creating a competing picker', async () => {
  const state = await launch({ primary: false });
  assert.equal(state.app.quitting, true);
  assert.equal(state.windows.length, 0);
});

test('copying persists history atomically and preserves the prompt', async () => {
  const state = await launch();
  state.windows[0].webContents.emit('did-finish-load');
  state.handlers.get('prompts:copy')({}, { id: 'one', body: 'Copy me' });
  assert.equal(state.copy(), 'Copy me');
  const dataPath = path.join('/test-data', 'prompts.json');
  const stored = JSON.parse(state.files.get(dataPath));
  assert.equal(stored[0].body, 'Copy me');
  assert.equal(stored[0].copyCount, 1);
  assert.ok(stored[0].lastCopiedAt > 0);
  assert.equal(state.files.has(`${dataPath}.tmp`), false);
});
