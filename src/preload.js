const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('duckApp', {
  area: ipcRenderer.sendSync('get-area'),
  config: ipcRenderer.sendSync('get-config'),
  setHome: (x, bottom) => ipcRenderer.send('set-home', x, bottom),
  saveSize: (size) => ipcRenderer.send('save-size', size),
  openMenu: () => ipcRenderer.send('open-menu'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', x, y),
  setIgnoreMouse: (ignore) => ipcRenderer.send('ignore-mouse', ignore),
  // „Auf Fenster setzen“: Fensterkante unter den Füßen suchen / wieder loslassen
  findPerch: (x, y) => ipcRenderer.sendSync('perch-find', x, y),
  releasePerch: () => ipcRenderer.send('perch-release'),
  onPerch: (cb) => ipcRenderer.on('perch', (_e, rect) => cb(rect)),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  onKey: (cb) => ipcRenderer.on('key', () => cb()),
  onPower: (cb) => ipcRenderer.on('power', (_e, battery) => cb(battery)),
  onWeather: (cb) => ipcRenderer.on('weather', (_e, w) => cb(w)),
  onClaude: (cb) => ipcRenderer.on('claude', (_e, active) => cb(active)),
  onCursor: (cb) => ipcRenderer.on('cursor', (_e, pos) => cb(pos)),
  onWindow: (cb) => ipcRenderer.on('window', (_e, rect) => cb(rect)),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, s) => cb(s)),
  onCommand: (cb) => ipcRenderer.on('command', (_e, cmd) => {
    if (cmd === 'trim') webFrame.clearCache(); // Energiesparmodus: Bild- und Skript-Zwischenspeicher leeren
    cb(cmd);
  }),
});
