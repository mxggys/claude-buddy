const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eingabe', {
  onAsk: (cb) => ipcRenderer.on('prompt:ask', (_e, opts) => cb(opts)),
  answer: (value) => ipcRenderer.send('prompt:answer', value),
});
