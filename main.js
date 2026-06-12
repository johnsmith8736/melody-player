const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#121212',
      symbolColor: '#b3b3b3',
      height: 32
    },
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => mainWindow = null);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('minimize', () => mainWindow.minimize());
ipcMain.on('maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('close', () => {
  // Notify renderer to save state before closing
  mainWindow.webContents.send('app-closing');
  setTimeout(() => mainWindow.close(), 300);
});

// Open file dialog to select music files
ipcMain.handle('select-music-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePaths;
});

// Open folder dialog and return all audio files inside
ipcMain.handle('select-music-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  const folderPath = result.filePaths[0];
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus'];
  const files = await fs.promises.readdir(folderPath, { recursive: true });
  return files
    .filter(f => audioExts.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(folderPath, f));
});

// Read file as ArrayBuffer for efficient transfer (no base64 bloat)
ipcMain.handle('read-file-as-array-buffer', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    // Transfer as ArrayBuffer (structured clone, no copy)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch (err) {
    console.error('Failed to read file:', filePath, err.message);
    return null;
  }
});

// Keep base64 for backward compat (small files / cover art)
ipcMain.handle('read-file-as-data-url', async (event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeMap = {
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
      m4a: 'audio/mp4', aac: 'audio/aac', wma: 'audio/x-ms-wma', opus: 'audio/opus'
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.error('Failed to read file:', filePath, err.message);
    return null;
  }
});

// Read music metadata (artist, title, album, duration, cover art)
ipcMain.handle('parse-metadata', async (event, filePath) => {
  try {
    const mm = require('music-metadata');
    const meta = await mm.parseFile(filePath);
    const picture = meta.common.picture?.[0];
    let coverDataUrl = null;
    if (picture) {
      const base64 = picture.data.toString('base64');
      coverDataUrl = `data:${picture.format};base64,${base64}`;
    }
    return {
      title: meta.common.title || path.basename(filePath, path.extname(filePath)),
      artist: meta.common.artist || 'Unknown Artist',
      album: meta.common.album || 'Unknown Album',
      duration: meta.format.duration || 0,
      cover: coverDataUrl
    };
  } catch (err) {
    console.error('Metadata parse failed:', filePath, err.message);
    return {
      title: path.basename(filePath, path.extname(filePath)),
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      duration: 0,
      cover: null
    };
  }
});
