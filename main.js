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

app.whenReady().then(() => {
  // Ensure playlist/ directory exists on startup
  try {
    const dir = path.join(__dirname, 'playlist');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    console.log('Playlist directory:', dir);
  } catch (e) { console.warn('Failed to create playlist dir:', e); }
  createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Forward renderer logs to terminal (for debugging)
ipcMain.on('renderer-log', (event, level, message) => {
  const prefix = '[renderer]';
  if (level === 'warn') console.warn(prefix, message);
  else if (level === 'error') console.error(prefix, message);
  else console.log(prefix, message);
});

// Debug: test file read
ipcMain.handle('debug-read-file', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    console.log('DEBUG file:', filePath, 'size:', stat.size, 'isFile:', stat.isFile());
    const buf = fs.readFileSync(filePath);
    console.log('DEBUG read:', buf.length, 'bytes');
    return { size: buf.length, ok: true };
  } catch (e) {
    console.error('DEBUG read failed:', filePath, e.message);
    return { ok: false, error: e.message };
  }
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
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePaths;
});

// Recursively walk a directory and collect audio files (handles permission errors)
async function walkDir(dir, audioExts) {
  const results = [];
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn('Cannot read dir:', dir, err.message);
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden dirs and common non-music dirs
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      results.push(...await walkDir(fullPath, audioExts));
    } else if (entry.isFile()) {
      if (audioExts.includes(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// Open folder dialog and return all audio files inside
ipcMain.handle('select-music-folder', async (event) => {
  console.log('[main] select-music-folder handler invoked');
  const win = BrowserWindow.fromWebContents(event.sender);
  console.log('[main] sender window:', !!win);
  let result;
  try {
    result = await dialog.showOpenDialog(win || mainWindow, {
      properties: ['openDirectory']
    });
    console.log('[main] dialog result:', JSON.stringify(result));
  } catch (e) {
    console.error('[main] dialog.showOpenDialog failed:', e.message);
    return [];
  }
  if (result.canceled || result.filePaths.length === 0) {
    console.log('[main] dialog canceled or no selection');
    return [];
  }
  const folderPath = result.filePaths[0];
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus'];
  console.log('[main] Scanning folder:', folderPath);
  let files;
  try {
    files = await walkDir(folderPath, audioExts);
  } catch (e) {
    console.error('[main] walkDir failed:', e.message);
    return [];
  }
  console.log('[main] Folder scan result:', files.length, 'files');
  return files;
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

// Batch add: parse metadata for multiple files in one IPC call (much faster)
ipcMain.handle('batch-parse-metadata', async (event, filePaths) => {
  const results = [];
  for (const filePath of filePaths) {
    try {
      const mm = require('music-metadata');
      const meta = await mm.parseFile(filePath);
      const picture = meta.common.picture?.[0];
      let coverDataUrl = null;
      if (picture) {
        const base64 = picture.data.toString('base64');
        coverDataUrl = `data:${picture.format};base64,${base64}`;
      }
      results.push({
        ok: true,
        filePath,
        title: meta.common.title || path.basename(filePath, path.extname(filePath)),
        artist: meta.common.artist || 'Unknown Artist',
        album: meta.common.album || 'Unknown Album',
        duration: meta.format.duration || 0,
        cover: coverDataUrl,
      });
    } catch (err) {
      results.push({ ok: false, filePath, error: err.message });
    }
  }
  return results;
});

// Get the playlist storage directory (next to the app)
function getPlaylistDir() {
  const appDir = app.getAppPath ? app.getAppPath() : __dirname;
  return path.join(appDir, 'playlist');
}

// Ensure playlist directory exists
function ensurePlaylistDir() {
  const dir = getPlaylistDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Save a playlist JSON file to playlist/ directory
ipcMain.handle('save-playlist', async (event, fileName, playlistData) => {
  try {
    const dir = ensurePlaylistDir();
    const filePath = path.join(dir, fileName);
    // playlistData may be a JSON string or object
    const data = typeof playlistData === 'string' ? playlistData : JSON.stringify(playlistData, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    console.log('Playlist saved:', filePath);
    return { success: true };
  } catch (err) {
    console.error('Failed to save playlist:', fileName, err.message);
    return { success: false, error: err.message };
  }
});

// Load a playlist JSON file from playlist/ directory
ipcMain.handle('load-playlist', async (event, fileName) => {
  try {
    const dir = ensurePlaylistDir();
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load playlist:', fileName, err.message);
    return null;
  }
});

// List all playlist files in playlist/ directory
ipcMain.handle('list-playlists', async () => {
  try {
    const dir = ensurePlaylistDir();
    const files = await fs.promises.readdir(dir);
    return files.filter(f => f.endsWith('.json'));
  } catch (err) {
    console.error('Failed to list playlists:', err.message);
    return [];
  }
});

// Delete a playlist file from playlist/ directory
ipcMain.handle('delete-playlist', async (event, fileName) => {
  try {
    const dir = ensurePlaylistDir();
    const filePath = path.join(dir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    console.error('Failed to delete playlist:', fileName, err.message);
    return { success: false, error: err.message };
  }
});

// Get the state file path (next to the app, in a writable location)
function getStateFilePath() {
  const appDir = app.getAppPath ? app.getAppPath() : __dirname;
  return path.join(appDir, 'state.json');
}

// Save state JSON to file (avoids Electron localStorage null-byte corruption)
ipcMain.handle('save-state-file', async (event, jsonStr) => {
  try {
    const filePath = getStateFilePath();
    fs.writeFileSync(filePath, jsonStr, 'utf-8');
    console.log('[main] State saved to:', filePath, 'size:', jsonStr.length);
    return { success: true };
  } catch (err) {
    console.error('[main] Failed to save state file:', err.message);
    return { success: false, error: err.message };
  }
});

// Load state JSON from file
ipcMain.handle('load-state-file', async () => {
  try {
    const filePath = getStateFilePath();
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    console.log('[main] State loaded from:', filePath, 'size:', raw.length);
    return JSON.parse(raw);
  } catch (err) {
    console.error('[main] Failed to load state file:', err.message);
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
