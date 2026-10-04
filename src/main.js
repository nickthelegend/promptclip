const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const bundledPrompts = require('./default-prompts.json');
const { cleanPromptText } = require('./prompt-cleaner');

const execFileAsync = promisify(execFile);
app.setName('PromptClip');
let picker;
let tray;
let pickerReady = false;
let showWhenReady = false;
let contextMenuOpen = false;

// Finder, login items and the shortcut must all reach the same running app.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) app.quit();
app.on('second-instance', () => showPicker());
app.on('activate', () => showPicker());
app.on('before-quit', () => { app.isQuitting = true; });

function logError(context, error) {
  console.error(context, error);
  try {
    const directory = app.getPath('userData');
    fs.mkdirSync(directory, { recursive: true });
    fs.appendFileSync(path.join(directory, 'startup.log'), `${new Date().toISOString()} ${context}: ${error?.stack || error}\n`);
  } catch { /* Logging must never prevent the picker from opening. */ }
}

const starterPrompts = bundledPrompts.length ? bundledPrompts : [
  { id: 'welcome', title: 'Welcome', body: 'Add a prompt from the + button.', source: 'PromptClip' }
];

function storePath() { return path.join(app.getPath('userData'), 'prompts.json'); }
function sortByRecent(prompts) {
  return prompts
    .map((prompt, index) => ({ prompt, index }))
    .sort((a, b) => (b.prompt.lastCopiedAt || 0) - (a.prompt.lastCopiedAt || 0) || a.index - b.index)
    .map(({ prompt }) => prompt);
}
function readPrompts() {
  try { return sortByRecent(JSON.parse(fs.readFileSync(storePath(), 'utf8'))); }
  catch { return sortByRecent(starterPrompts); }
}
function writePrompts(prompts) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  const temporaryPath = `${storePath()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(prompts, null, 2));
  fs.renameSync(temporaryPath, storePath());
  return prompts;
}
function sendPrompts() { picker?.webContents.send('prompts:changed', readPrompts()); }

function createPicker() {
  picker = new BrowserWindow({
    width: 430, height: 560, x: 18, y: 38, show: false, frame: false,
    transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  picker.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pickerReady = false;
  picker.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((error) => logError('Loading picker', error));
  picker.on('close', (event) => { if (!app.isQuitting) { event.preventDefault(); picker.hide(); } });
  picker.on('closed', () => { picker = null; pickerReady = false; });
  picker.on('blur', () => { if (!contextMenuOpen && !picker.webContents.isDevToolsOpened()) picker.hide(); });
  picker.webContents.on('render-process-gone', (_event, details) => {
    logError('Picker renderer stopped', details.reason);
    if (!app.isQuitting) { pickerReady = false; showWhenReady = true; picker.reload(); }
  });
  picker.webContents.on('did-finish-load', () => {
    pickerReady = true;
    sendPrompts();
    if (showWhenReady) showPicker();
  });
}
function showPicker() {
  showWhenReady = true;
  if (!app.isReady()) return;
  if (!picker || picker.isDestroyed()) createPicker();
  if (!pickerReady) return;
  showWhenReady = false;
  const { workArea } = screen.getPrimaryDisplay();
  picker.setPosition(workArea.x + 18, workArea.y + 18);
  if (picker.isMinimized()) picker.restore();
  picker.setAlwaysOnTop(true, 'floating');
  picker.show();
  picker.focus();
  picker.webContents.send('prompts:changed', readPrompts());
  picker.webContents.send('picker:shown');
}
function togglePicker() { if (picker?.isVisible() && picker.isFocused()) picker.hide(); else showPicker(); }

async function importAppleNotes() {
  if (process.platform !== 'darwin') return { error: 'Apple Notes import is available on macOS only.' };
  const existing = readPrompts();
  const copyHistory = new Map(existing.map((prompt) => [prompt.id, { lastCopiedAt: prompt.lastCopiedAt, copyCount: prompt.copyCount }]));
  const withHistory = (prompt) => {
    const history = copyHistory.get(prompt.id);
    return history?.lastCopiedAt ? { ...prompt, ...history } : prompt;
  };
  const rs = String.fromCharCode(30), us = String.fromCharCode(31);
  const script = `tell application "Notes"
set output to {}
repeat with n in every note
  set noteTitle to name of n
  set noteBody to body of n
  set end of output to noteTitle & (ASCII character 31) & noteBody
end repeat
set AppleScript's text item delimiters to (ASCII character 30)
return output as text
end tell`;
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { maxBuffer: 15 * 1024 * 1024, timeout: 30000 });
    const imported = stdout.trim().split(rs).map((row, index) => {
      const [title, ...body] = row.split(us);
      return { id: `notes-${Date.now()}-${index}`, title: title?.trim() || `Untitled note ${index + 1}`, body: body.join(us).replace(/<[^>]*>/g, '').trim(), source: 'Apple Notes' };
    }).filter((prompt) => prompt.body);
    const manual = existing.filter((prompt) => prompt.source === 'Manual');
    writePrompts([...imported, ...manual]);
    sendPrompts();
    return { count: imported.length };
  } catch {
    const manual = existing.filter((prompt) => prompt.source === 'Manual');
    writePrompts([...bundledPrompts.map(withHistory), ...manual]);
    sendPrompts();
    return { count: bundledPrompts.length, fallback: true };
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'promptclip-icon.png')).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('PromptClip');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show PromptClip', click: showPicker },
    { label: 'Import Apple Notes', visible: process.platform === 'darwin', click: importAppleNotes },
    { type: 'separator' }, { label: 'Quit PromptClip', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', showPicker);
}

ipcMain.handle('prompts:list', () => readPrompts());
ipcMain.on('picker:hide', () => picker?.hide());
ipcMain.handle('prompts:copy', (_event, prompt) => {
  clipboard.writeText(cleanPromptText(prompt.body));
  const copiedAt = Date.now();
  const prompts = readPrompts().map((item) => item.id === prompt.id
    ? { ...item, lastCopiedAt: copiedAt, copyCount: (item.copyCount || 0) + 1 }
    : item);
  writePrompts(sortByRecent(prompts));
  sendPrompts();
  picker.hide();
  return { copiedAt };
});
ipcMain.handle('prompts:save', (_event, prompt) => {
  const current = readPrompts().find((item) => item.id === prompt.id);
  const prompts = readPrompts().filter((item) => item.id !== prompt.id && item.id !== 'welcome');
  const next = { id: prompt.id || `manual-${Date.now()}`, title: prompt.title.trim(), body: prompt.body.trim(), source: 'Manual', ...(current?.lastCopiedAt ? { lastCopiedAt: current.lastCopiedAt, copyCount: current.copyCount || 1 } : {}) };
  writePrompts([next, ...prompts]); sendPrompts(); return next;
});
ipcMain.handle('prompts:delete', (_event, id) => { writePrompts(readPrompts().filter((item) => item.id !== id)); sendPrompts(); });
ipcMain.handle('prompts:import-notes', importAppleNotes);
ipcMain.on('prompts:menu', (event, prompt) => {
  contextMenuOpen = true;
  Menu.buildFromTemplate([
    { label: 'Edit', click: () => event.sender.send('prompt:edit', prompt) },
    { label: 'Delete', click: () => event.sender.send('prompt:delete-request', prompt.id) }
  ]).popup({ window: picker, callback: () => { contextMenuOpen = false; } });
});
ipcMain.on('picker:menu', (event) => {
  contextMenuOpen = true;
  Menu.buildFromTemplate([
    { label: 'New prompt', click: () => event.sender.send('prompt:new') },
    { label: 'Import Apple Notes', visible: process.platform === 'darwin', click: async () => event.sender.send('notes:imported', await importAppleNotes()) }
  ]).popup({ window: picker, callback: () => { contextMenuOpen = false; } });
});

app.whenReady().then(() => {
  if (!isPrimaryInstance) return;
  try { app.setLoginItemSettings({ openAtLogin: true, args: ['--background'] }); }
  catch (error) { logError('Configuring login startup', error); }
  createPicker(); createTray();
  if (!globalShortcut.register('CommandOrControl+Shift+Space', togglePicker)) logError('Registering shortcut', 'Shortcut is already in use. Open from the tray or Dock.');
  const loginLaunch = process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin;
  if (showWhenReady || (!loginLaunch && !process.argv.includes('--background'))) showPicker();
}).catch((error) => logError('Starting PromptClip', error));
app.on('window-all-closed', (event) => event.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
