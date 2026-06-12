const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close'),

  selectMusicFiles: () => ipcRenderer.invoke('select-music-files'),
  selectMusicFolder: () => ipcRenderer.invoke('select-music-folder'),
  readFileAsArrayBuffer: (filePath) => ipcRenderer.invoke('read-file-as-array-buffer', filePath),
  readFileAsDataUrl: (filePath) => ipcRenderer.invoke('read-file-as-data-url', filePath),
  parseMetadata: (filePath) => ipcRenderer.invoke('parse-metadata', filePath),
  onAppClosing: (callback) => ipcRenderer.on('app-closing', callback),
});
