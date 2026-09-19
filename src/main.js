const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
app.setName('PromptClip');
let picker;
let tray;

const starterPrompts = [
  { id: 'welcome', title: 'Welcome', body: 'Add a prompt, or import your Apple Notes from the right-click menu.', source: 'PromptClip' }
];

function storePath() { return path.join(app.getPath('userData'), 'prompts.json'); }
function readPrompts() {
  try { return JSON.parse(fs.readFileSync(storePath(), 'utf8')); }
  catch { return starterPrompts; }
}
function writePrompts(prompts) {
  fs.writeFileSync(storePath(), JSON.stringify(prompts, null, 2));
  return prompts;
}
function sendPrompts() { picker?.webContents.send('prompts:changed', readPrompts()); }

function createPicker() {
  picker = new BrowserWindow({
    width: 430, height: 560, x: 18, y: 38, show: false, frame: false,
    transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  picker.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  picker.on('close', (event) => { if (!app.isQuitting) { event.preventDefault(); picker.hide(); } });
  picker.on('blur', () => { if (!picker.webContents.isDevToolsOpened()) picker.hide(); });
  picker.webContents.once('did-finish-load', async () => {
    sendPrompts();
    if (process.platform === 'darwin' && !fs.existsSync(storePath())) await importAppleNotes();
  });
}
function showPicker() {
  if (!picker) createPicker();
  picker.showInactive();
  picker.setAlwaysOnTop(true, 'floating');
  picker.webContents.send('prompts:changed', readPrompts());
}

async function importAppleNotes() {
  if (process.platform !== 'darwin') return { error: 'Apple Notes import is available on macOS only.' };
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
    const { stdout } = await execFileAsync('osascript', ['-e', script], { maxBuffer: 15 * 1024 * 1024 });
    const imported = stdout.trim().split(rs).map((row, index) => {
      const [title, ...body] = row.split(us);
      return { id: `notes-${Date.now()}-${index}`, title: title?.trim() || `Untitled note ${index + 1}`, body: body.join(us).replace(/<[^>]*>/g, '').trim(), source: 'Apple Notes' };
    }).filter((prompt) => prompt.body);
    const manual = readPrompts().filter((prompt) => prompt.source !== 'Apple Notes' && prompt.id !== 'welcome');
    writePrompts([...imported, ...manual]);
    sendPrompts();
    return { count: imported.length };
  } catch (error) { return { error: error.message || 'Could not read Apple Notes.' }; }
}

function createTray() {
  const icon = nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="4" fill="%237c3aed"/><path d="M4 4h8v2H4zm0 3h8v2H4zm0 3h5v2H4z" fill="white"/></svg>').toString('base64'));
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
ipcMain.handle('prompts:copy', (_event, body) => { clipboard.writeText(body); picker.hide(); return true; });
ipcMain.handle('prompts:save', (_event, prompt) => {
  const prompts = readPrompts().filter((item) => item.id !== prompt.id && item.id !== 'welcome');
  const next = { id: prompt.id || `manual-${Date.now()}`, title: prompt.title.trim(), body: prompt.body.trim(), source: 'Manual' };
  writePrompts([next, ...prompts]); sendPrompts(); return next;
});
ipcMain.handle('prompts:delete', (_event, id) => { writePrompts(readPrompts().filter((item) => item.id !== id)); sendPrompts(); });
ipcMain.handle('prompts:import-notes', importAppleNotes);
ipcMain.on('prompts:menu', (event, prompt) => {
  Menu.buildFromTemplate([
    { label: 'Edit', click: () => event.sender.send('prompt:edit', prompt) },
    { label: 'Delete', click: () => event.sender.send('prompt:delete-request', prompt.id) }
  ]).popup({ window: picker });
});
ipcMain.on('picker:menu', (event) => {
  Menu.buildFromTemplate([
    { label: 'New prompt', click: () => event.sender.send('prompt:new') },
    { label: 'Import Apple Notes', visible: process.platform === 'darwin', click: async () => event.sender.send('notes:imported', await importAppleNotes()) }
  ]).popup({ window: picker });
});

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  createPicker(); createTray();
  globalShortcut.register('CommandOrControl+Shift+Space', showPicker);
  app.on('activate', showPicker);
});
app.on('window-all-closed', (event) => event.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
