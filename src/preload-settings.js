// Brücke für das Einstellungsfenster: nur lesen, einzelne Werte setzen und ein paar Aktionen
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddySettings', {
  get: () => ipcRenderer.invoke('cfg:get'),
  set: (key, value) => ipcRenderer.invoke('cfg:set', key, value),
  action: (name) => ipcRenderer.send('cfg:action', name),
  onState: (cb) => ipcRenderer.on('cfg:state', (_e, state) => cb(state)),
  onGoto: (cb) => ipcRenderer.on('cfg:goto', (_e, page) => cb(page)),
});
