const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('promptclip', {
  list: () => ipcRenderer.invoke('prompts:list'), copy: (body) => ipcRenderer.invoke('prompts:copy', body),
  save: (prompt) => ipcRenderer.invoke('prompts:save', prompt), remove: (id) => ipcRenderer.invoke('prompts:delete', id),
  importNotes: () => ipcRenderer.invoke('prompts:import-notes'), menu: (prompt) => ipcRenderer.send('prompts:menu', prompt), pickerMenu: () => ipcRenderer.send('picker:menu'),
  onPrompts: (callback) => ipcRenderer.on('prompts:changed', (_e, prompts) => callback(prompts)),
  onEdit: (callback) => ipcRenderer.on('prompt:edit', (_e, prompt) => callback(prompt)),
  onNew: (callback) => ipcRenderer.on('prompt:new', callback),
  onDeleteRequest: (callback) => ipcRenderer.on('prompt:delete-request', (_e, id) => callback(id)),
  onNotesImported: (callback) => ipcRenderer.on('notes:imported', (_e, result) => callback(result))
});
