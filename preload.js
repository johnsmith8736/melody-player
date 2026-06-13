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

  // Debug
  debugReadFile: (filePath) => ipcRenderer.invoke('debug-read-file', filePath),

  // State file I/O (persisted via main process to avoid localStorage null-byte bug)
  saveStateFile: (jsonStr) => ipcRenderer.invoke('save-state-file', jsonStr),
  loadStateFile: () => ipcRenderer.invoke('load-state-file'),

  // Playlist file I/O (playlist/ directory)
  savePlaylist: (fileName, playlistData) => ipcRenderer.invoke('save-playlist', fileName, playlistData),
  loadPlaylist: (fileName) => ipcRenderer.invoke('load-playlist', fileName),
  listPlaylists: () => ipcRenderer.invoke('list-playlists'),
  deletePlaylist: (fileName) => ipcRenderer.invoke('delete-playlist', fileName),
});
