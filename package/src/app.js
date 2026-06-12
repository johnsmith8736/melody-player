// ========================================
// Music Player — Desktop (Electron) with real audio
// ========================================

// State — start empty, load from localStorage if available
let state = {
  currentSong: null,
  isPlaying: false,
  progress: 0,
  volume: 0.7,
  shuffle: false,
  repeat: false,
  liked: new Set(),
  songs: [],
  currentPlaylist: 'Good Morning',
  view: 'home',
};

// Real audio element
const audio = new Audio();
audio.volume = state.volume;

// DOM
const els = {
  songsList: document.getElementById('songsList'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  repeatBtn: document.getElementById('repeatBtn'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  currentTime: document.getElementById('currentTime'),
  totalTime: document.getElementById('totalTime'),
  volumeBar: document.getElementById('volumeBar'),
  volumeFill: document.getElementById('volumeFill'),
  volumeBtn: document.getElementById('volumeBtn'),
  nowPlayingArt: document.getElementById('nowPlayingArt'),
  nowPlayingTitle: document.getElementById('nowPlayingTitle'),
  nowPlayingArtist: document.getElementById('nowPlayingArtist'),
  likeBtn: document.getElementById('likeBtn'),
  heroTitle: document.getElementById('heroTitle'),
  heroArt: document.getElementById('heroArt'),
  sidebar: document.getElementById('sidebar'),
  searchInput: document.getElementById('searchInput'),
  searchClear: document.getElementById('searchClear'),
  playAllBtn: document.getElementById('playAllBtn'),
  contentScroll: document.getElementById('contentScroll'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  themeToggle: document.getElementById('themeToggle'),
  addSongsBtn: document.getElementById('addSongsBtn'),
  addFolderBtn: document.getElementById('addFolderBtn'),
  fileInput: document.getElementById('fileInput'),
  folderInput: document.getElementById('folderInput'),
  addMoreBtn: document.getElementById('addMoreBtn'),
  dropOverlay: document.getElementById('dropOverlay'),
};

// Toast helper
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// Format time
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Render song list — optional onRemoveOverride to customize remove behavior
function renderSongs(songsToRender = null, onRemoveOverride = null) {
  const list = songsToRender || getFilteredSongs();
  els.songsList.innerHTML = '';

  if (list.length === 0) {
    els.songsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-music"></i>
        <h3>No songs yet</h3>
        <p>Click "Add Songs" to import your music files</p>
      </div>`;
    return;
  }

  list.forEach((song, index) => {
    const isPlaying = state.currentSong && state.currentSong.id === song.id && state.isPlaying;
    const isLiked = state.liked.has(song.id);
    const row = document.createElement('div');
    row.className = `song-row${isPlaying ? ' playing' : ''}`;
    row.dataset.id = song.id;
    row.draggable = true;

    const artHtml = song.cover
      ? `<img src="${song.cover}" alt="cover">`
      : `<i class="fas fa-music" style="color: rgba(255,255,255,0.8); font-size: 14px;"></i>`;
    const artBg = song.cover ? 'transparent' : `linear-gradient(135deg, ${song.color}, ${adjustColor(song.color, -40)})`;

    row.innerHTML = `
      <span class="song-number">${index + 1}</span>
      <div class="song-info">
        <div class="song-art" style="background: ${artBg};">${artHtml}</div>
        <div><div class="song-title">${song.title}</div></div>
      </div>
      <span class="song-artist-name">${song.artist}</span>
      <span class="song-album-name">${song.album}</span>
      <span class="song-date">${song.date || ''}</span>
      <span class="song-duration">${formatTime(song.duration)}</span>
      <div class="song-actions">
        <button class="song-action-btn btn-like-song" data-id="${song.id}" title="Like">
          <i class="fa${isLiked ? 's' : 'r'} fa-heart" style="color: ${isLiked ? 'var(--primary)' : 'inherit'};"></i>
        </button>
        <button class="song-action-btn btn-remove-song" data-id="${song.id}" title="Remove">
          <i class="fas fa-trash-alt"></i>
        </button>
        <button class="song-action-btn btn-more" title="More"><i class="fas fa-ellipsis-h"></i></button>
      </div>`;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.song-action-btn')) return;
      playSong(song);
    });
    row.addEventListener('dblclick', () => playSong(song));
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('dragleave', handleDragLeave);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);

    row.querySelector('.btn-like-song').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLike(song.id);
      const icon = e.currentTarget.querySelector('i');
      if (state.liked.has(song.id)) { icon.className = 'fas fa-heart'; icon.style.color = 'var(--primary)'; }
      else { icon.className = 'far fa-heart'; icon.style.color = 'inherit'; }
    });

    row.querySelector('.btn-remove-song').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onRemoveOverride) onRemoveOverride(song.id);
      else removeSong(song.id);
    });

    // Right-click context menu
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, song);
    });

    els.songsList.appendChild(row);
  });
  updateLikedCount();
}

function adjustColor(color, amount) {
  if (!color || !color.startsWith('#')) return '#333';
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  if (isNaN(num)) return '#333';
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

// Remove song from playlist
function removeSong(id) {
  state.songs = state.songs.filter(s => s.id !== id);
  debouncedSave();
  if (state.currentSong && state.currentSong.id === id) {
    audio.pause();
    state.currentSong = null;
    state.isPlaying = false;
    updatePlayButton();
    els.nowPlayingTitle.textContent = 'Select a song';
    els.nowPlayingArtist.textContent = '—';
    els.nowPlayingArt.innerHTML = '<i class="fas fa-music"></i>';
    els.nowPlayingArt.style.background = '';
  }
  renderSongs();
  showToast('Song removed');
}

// Play song
function playSong(song) {
  if (state.currentSong && state.currentSong.id === song.id) { togglePlay(); return; }

  state.currentSong = song;
  state.isPlaying = true;
  state.progress = 0;

  // If song has a data URL (local file), play it
  if (song.src) {
    audio.src = song.src;
    audio.play().catch(err => console.warn('Playback failed:', err.message));
  } else {
    // Demo song without audio — simulate playback
    audio.removeAttribute('src');
    audio.pause();
  }

  els.nowPlayingTitle.textContent = song.title;
  els.nowPlayingArtist.textContent = song.artist;
  if (song.cover) {
    els.nowPlayingArt.innerHTML = `<img src="${song.cover}" alt="cover">`;
    els.nowPlayingArt.style.background = 'transparent';
  } else {
    els.nowPlayingArt.innerHTML = `<i class="fas fa-music" style="color: rgba(255,255,255,0.9); font-size: 24px;"></i>`;
    els.nowPlayingArt.style.background = `linear-gradient(135deg, ${song.color}, ${adjustColor(song.color, -40)})`;
  }

  els.heroTitle.textContent = state.currentPlaylist;
  if (song.cover) {
    els.heroArt.innerHTML = `<img src="${song.cover}" alt="cover">`;
    els.heroArt.style.background = 'transparent';
  } else {
    els.heroArt.innerHTML = `<i class="fas fa-music" style="font-size: 64px; color: rgba(255,255,255,0.9);"></i>`;
    els.heroArt.style.background = `linear-gradient(135deg, ${song.color}, ${adjustColor(song.color, -60)})`;
  }

  updateLikeButton();
  updatePlayButton();
  renderSongs();
  els.totalTime.textContent = formatTime(song.duration);
}

// Toggle play/pause
function togglePlay() {
  if (!state.currentSong) {
    if (state.songs.length > 0) playSong(state.songs[0]);
    return;
  }
  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) {
    if (state.currentSong.src) audio.play().catch(() => {});
  } else {
    audio.pause();
  }
  updatePlayButton();
  renderSongs();
}

function updatePlayButton() {
  const icon = els.playPauseBtn.querySelector('i');
  icon.className = state.isPlaying ? 'fas fa-pause' : 'fas fa-play';
  els.playPauseBtn.classList.toggle('playing', state.isPlaying);
}

// Next / Prev
function nextSong() {
  if (state.songs.length === 0) return;
  if (!state.currentSong) { playSong(state.songs[0]); return; }
  const currentIndex = state.songs.findIndex(s => s.id === state.currentSong.id);
  let nextIndex;
  if (state.shuffle) { nextIndex = Math.floor(Math.random() * state.songs.length); }
  else { nextIndex = (currentIndex + 1) % state.songs.length; }
  playSong(state.songs[nextIndex]);
}

function prevSong() {
  if (state.songs.length === 0) return;
  if (!state.currentSong) return;
  const currentIndex = state.songs.findIndex(s => s.id === state.currentSong.id);
  const prevIndex = (currentIndex - 1 + state.songs.length) % state.songs.length;
  playSong(state.songs[prevIndex]);
}

// Audio events
audio.addEventListener('timeupdate', () => {
  if (!state.currentSong) return;
  state.progress = audio.currentTime;
  updateProgressUI();
});

audio.addEventListener('loadedmetadata', () => {
  if (state.currentSong) {
    state.currentSong.duration = audio.duration;
    els.totalTime.textContent = formatTime(audio.duration);
    renderSongs();
  }
});

audio.addEventListener('ended', () => {
  if (state.repeat) {
    audio.currentTime = 0;
    audio.play();
  } else {
    nextSong();
  }
});

audio.addEventListener('error', () => {
  // Silently handle — demo songs have no real src
});

function updateProgressUI() {
  if (!state.currentSong) return;
  const duration = audio.duration || state.currentSong.duration || 1;
  const percent = (audio.currentTime / duration) * 100;
  els.progressFill.style.width = `${Math.min(100, percent)}%`;
  els.currentTime.textContent = formatTime(audio.currentTime);
}

// Volume
function updateVolumeUI() {
  els.volumeFill.style.width = `${state.volume * 100}%`;
  const icon = els.volumeBtn.querySelector('i');
  if (state.volume === 0) icon.className = 'fas fa-volume-mute';
  else if (state.volume < 0.5) icon.className = 'fas fa-volume-down';
  else icon.className = 'fas fa-volume-up';
}

function toggleLike(songId) {
  if (state.liked.has(songId)) state.liked.delete(songId);
  else state.liked.add(songId);
  debouncedSave();
  if (state.currentSong && state.currentSong.id === songId) updateLikeButton();
  renderSongs();
}

function updateLikeButton() {
  if (!state.currentSong) return;
  const isLiked = state.liked.has(state.currentSong.id);
  els.likeBtn.classList.toggle('liked', isLiked);
  els.likeBtn.querySelector('i').className = isLiked ? 'fas fa-heart' : 'far fa-heart';
  updateLikedCount();
}

function updateLikedCount() {
  const badge = document.getElementById('likedCount');
  if (badge) badge.textContent = state.liked.size;
}

function clearLikedSongs() {
  if (state.liked.size === 0) { showToast('No liked songs to clear'); return; }
  if (confirm(`Remove all ${state.liked.size} liked songs?`)) {
    state.liked.clear();
    updateLikedCount();
    // Check if we're in Liked Songs view and refresh it
    if (state.currentPlaylist === 'Liked Songs') {
      renderLikedView();
    } else {
      renderSongs();
    }
    showToast('Liked songs cleared');
  }
}

function toggleShuffle() { state.shuffle = !state.shuffle; els.shuffleBtn.classList.toggle('active', state.shuffle); debouncedSave(); }
function toggleRepeat() { state.repeat = !state.repeat; els.repeatBtn.classList.toggle('active', state.repeat); debouncedSave(); }

// Drag & Drop reorder
let draggedItem = null;
function handleDragStart(e) { draggedItem = this; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function handleDragOver(e) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  if (this !== draggedItem) this.classList.add('drag-over');
}
function handleDragLeave() { this.classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault(); this.classList.remove('drag-over');
  if (draggedItem && this !== draggedItem) {
    const fromId = parseInt(draggedItem.dataset.id);
    const toId = parseInt(this.dataset.id);
    const fromIndex = state.songs.findIndex(s => s.id === fromId);
    const toIndex = state.songs.findIndex(s => s.id === toId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const [moved] = state.songs.splice(fromIndex, 1);
      state.songs.splice(toIndex, 0, moved);
      renderSongs();
      debouncedSave();
    }
  }
}
function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.song-row').forEach(row => row.classList.remove('drag-over'));
  draggedItem = null;
}

// Search
function getFilteredSongs() {
  const query = els.searchInput.value.toLowerCase().trim();
  if (!query) return state.songs;
  return state.songs.filter(s =>
    s.title.toLowerCase().includes(query) ||
    s.artist.toLowerCase().includes(query) ||
    s.album.toLowerCase().includes(query)
  );
}



// Playlist switch
function switchPlaylist(name) {
  state.currentPlaylist = name;
  els.heroTitle.textContent = name;

  // For Liked Songs, render with clear button in action bar
  if (name === 'Liked Songs') {
    renderLikedView();
  } else if (name === 'Recently Played') {
    renderRecentView();
  } else {
    renderSongs();
  }
}

function renderLikedView() {
  const likedSongs = state.songs.filter(s => state.liked.has(s.id));
  els.contentScroll.innerHTML = `
    <section class="hero-section">
      <div class="hero-content" style="background: linear-gradient(135deg, #4a1a6b 0%, #121212 100%);">
        <div class="hero-art">
          <div class="art-gradient" style="background: linear-gradient(135deg, #450af5, #c4efd9);">
            <i class="fas fa-heart"></i>
          </div>
        </div>
        <div class="hero-info">
          <span class="hero-type">PLAYLIST</span>
          <h1 class="hero-title">Liked Songs</h1>
          <p class="hero-description">${likedSongs.length} songs you love</p>
        </div>
      </div>
    </section>
    <div class="action-bar">
      <button class="btn-play-lg" id="playAllLiked"><i class="fas fa-play"></i></button>
      <button class="btn-icon" id="clearAllLiked" title="Clear all liked songs">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
    <div class="songs-header">
      <span class="col-number">#</span>
      <span class="col-title">Title</span>
      <span class="col-artist">Artist</span>
      <span class="col-album">Album</span>
      <span class="col-date">Date Added</span>
      <span class="col-duration"><i class="far fa-clock"></i></span>
    </div>
    <div class="songs-list" id="songsList"></div>
    <div class="list-end"><p>End of Liked Songs</p></div>
  `;
  els.songsList = document.getElementById('songsList');
  renderSongs(likedSongs);

  document.getElementById('playAllLiked')?.addEventListener('click', () => {
    if (likedSongs.length > 0) playSong(likedSongs[0]);
  });
  document.getElementById('clearAllLiked')?.addEventListener('click', clearLikedSongs);
}

let recentSongs = [];

function renderRecentView() {
  // Show last 10 songs added
  recentSongs = [...state.songs].sort((a, b) => {
    if (a.id === b.id) return 0;
    return a.id > b.id ? -1 : 1;
  }).slice(0, 10);

  const hasSongs = recentSongs.length > 0;

  els.contentScroll.innerHTML = `
    <section class="hero-section">
      <div class="hero-content" style="background: linear-gradient(135deg, #e61e32 0%, #121212 100%);">
        <div class="hero-art">
          <div class="art-gradient" style="background: linear-gradient(135deg, #e61e32, #503750);">
            <i class="fas fa-history"></i>
          </div>
        </div>
        <div class="hero-info">
          <span class="hero-type">PLAYLIST</span>
          <h1 class="hero-title">Recently Played</h1>
          <p class="hero-description">${hasSongs ? 'Your latest listens' : 'No recent songs'}</p>
        </div>
      </div>
    </section>
    ${hasSongs ? `
    <div class="action-bar">
      <button class="btn-play-lg" id="playAllRecent"><i class="fas fa-play"></i></button>
      <button class="btn-icon" id="clearRecent" title="Clear history">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
    <div class="songs-header">
      <span class="col-number">#</span>
      <span class="col-title">Title</span>
      <span class="col-artist">Artist</span>
      <span class="col-album">Album</span>
      <span class="col-date">Date Added</span>
      <span class="col-duration"><i class="far fa-clock"></i></span>
    </div>
    <div class="songs-list" id="songsList"></div>
    <div class="list-end"><p>End of Recently Played</p></div>
    ` : '<div class="empty-state"><i class="fas fa-history"></i><h3>No recent songs</h3><p>Play some songs to see them here</p></div>'}
  `;

  if (hasSongs) {
    els.songsList = document.getElementById('songsList');
    renderSongs(recentSongs, (id) => removeFromRecent(id));
    document.getElementById('playAllRecent')?.addEventListener('click', () => playSong(recentSongs[0]));
    document.getElementById('clearRecent')?.addEventListener('click', () => {
      if (confirm('Clear all playback history?')) {
        recentSongs = [];
        renderRecentView();
        showToast('History cleared');
      }
    });
  }
}

// Remove one song from recent list
function removeFromRecent(songId) {
  recentSongs = recentSongs.filter(s => s.id !== songId);
  renderRecentView();
  showToast('Removed from history');
}

// Theme
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  els.themeToggle.querySelector('i').className = next === 'light' ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('theme', next);
}

function loadTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    els.themeToggle.querySelector('i').className = 'fas fa-sun';
  }
}

// Progress bar click
function handleProgressClick(e) {
  if (!state.currentSong) return;
  if (audio.duration) {
    const rect = els.progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = percent * audio.duration;
  }
}

// Volume bar click
function handleVolumeClick(e) {
  const rect = els.volumeBar.getBoundingClientRect();
  state.volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.volume = state.volume;
  updateVolumeUI();
  debouncedSave();
}

function toggleMute() {
  state.volume = state.volume > 0 ? 0 : 0.7;
  audio.volume = state.volume;
  updateVolumeUI();
  debouncedSave();
}

// Keyboard
function handleKeyboard(e) {
  if (e.target.tagName === 'INPUT') return;
  switch (e.code) {
    case 'Space': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': if (audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); break;
    case 'ArrowLeft': if (audio.duration) audio.currentTime = Math.max(audio.currentTime - 5, 0); break;
    case 'KeyN': nextSong(); break;
    case 'KeyP': prevSong(); break;
    case 'KeyM': toggleMute(); break;
    case 'KeyS': toggleShuffle(); break;
    case 'KeyR': toggleRepeat(); break;
    case 'KeyL': if (state.currentSong) toggleLike(state.currentSong.id); break;
  }
}

// Window controls
function setupWindowControls() {
  document.querySelector('.control-btn.minimize')?.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.minimize(); else console.log('Minimize');
  });
  document.querySelector('.control-btn.maximize')?.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.maximize(); else console.log('Maximize');
  });
  document.querySelector('.control-btn.close')?.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.close(); else window.close();
  });
}

// =============================================
// ADD LOCAL MUSIC FILES
// =============================================
let nextId = 1000;

async function addMusicFiles(filePaths) {
  if (!filePaths || filePaths.length === 0) return;

  // Show loading state
  const btn = els.addSongsBtn;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="nav-text">Adding...</span>';

  let added = 0;
  for (const filePath of filePaths) {
    try {
      // Read file as data URL in main process
      if (window.electronAPI) {
        // In Electron: use IPC to read file
        const dataUrl = await window.electronAPI.readFileAsDataUrl(filePath);
        if (!dataUrl) continue;
        const metadata = await window.electronAPI.parseMetadata(filePath);
        const song = {
          id: nextId++,
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          duration: metadata.duration,
          date: 'Just now',
          color: '#333',
          src: dataUrl,
          cover: metadata.cover,
        };
        state.songs.push(song);
        added++;
      } else {
        // In browser: use FileReader
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(/* need a File object */);
        });
      }
    } catch (err) {
      console.warn('Failed to add:', filePath, err.message);
    }
  }

  btn.innerHTML = originalHtml;
  renderSongs();
  showToast(`Added ${added} song${added === 1 ? '' : 's'}`);
}

// Electron: use IPC — use object URLs to avoid large base64 in memory
async function addMusicFilesElectron(filePaths) {
  if (!filePaths || filePaths.length === 0) return;

  const btn = els.addSongsBtn;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="nav-text">Adding...</span>';

  let added = 0;
  for (const filePath of filePaths) {
    try {
      // Read file as buffer in main process, then create object URL in renderer
      const arrayBuffer = await window.electronAPI.readFileAsArrayBuffer(filePath);
      if (!arrayBuffer) continue;

      // Determine mime type
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const mimeMap = {
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
        m4a: 'audio/mp4', aac: 'audio/aac', wma: 'audio/x-ms-wma', opus: 'audio/opus'
      };
      const mime = mimeMap[ext] || 'application/octet-stream';

      // Create blob URL (lightweight, no base64 bloat)
      const blob = new Blob([arrayBuffer], { type: mime });
      const objectUrl = URL.createObjectURL(blob);

      const metadata = await window.electronAPI.parseMetadata(filePath);
      state.songs.push({
        id: nextId++,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        duration: metadata.duration,
        date: 'Just now',
        color: '#333',
        src: objectUrl,
        filePath: filePath,  // save path for reload
        cover: metadata.cover,
      });
      added++;
    } catch (err) {
      console.warn('Failed to add:', filePath, err.message);
    }
  }

  btn.innerHTML = '<i class="fas fa-plus-circle"></i><span class="nav-text">Add Songs</span>';
  renderSongs();
  debouncedSave();
  showToast(`Added ${added} song${added === 1 ? '' : 's'}`);
}

// Open file dialog (Electron)
async function openFileDialog() {
  if (window.electronAPI) {
    const filePaths = await window.electronAPI.selectMusicFiles();
    if (filePaths && filePaths.length > 0) {
      addMusicFilesElectron(filePaths);
    }
  } else {
    els.fileInput.click();
  }
}

// Open folder dialog and add all audio files inside
async function openFolderDialog() {
  if (window.electronAPI) {
    const btn = els.addFolderBtn;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="nav-text">Scanning...</span>';
    try {
      const filePaths = await window.electronAPI.selectMusicFolder();
      if (filePaths && filePaths.length > 0) {
        addMusicFilesElectron(filePaths);
      } else {
        showToast('No audio files found in folder');
      }
    } catch (err) {
      console.warn('Folder scan failed:', err.message);
      showToast('Failed to read folder');
    }
    btn.innerHTML = originalHtml;
  } else {
    // Browser fallback: use webkitdirectory input
    els.folderInput.click();
  }
}

// Handle folder input in browser (webkitdirectory)
function onFolderInputChange(e) {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('audio/'));
  if (files.length === 0) { showToast('No audio files found'); return; }
  let added = 0, processed = 0;
  files.forEach(file => {
    const objectUrl = URL.createObjectURL(file);
    const tmpAudio = new Audio();
    tmpAudio.addEventListener('loadedmetadata', () => {
      state.songs.push({
        id: nextId++,
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: tmpAudio.duration,
        date: 'Just now',
        color: '#333',
        src: objectUrl,
        cover: null,
      });
      added++;
      processed++;
      if (processed === files.length) {
        renderSongs();
        showToast(`Added ${added} song${added === 1 ? '' : 's'} from folder`);
      }
    });
    tmpAudio.src = objectUrl;
  });
  e.target.value = '';
}

// File input change (browser fallback) — use Object URL for speed
function onFileInputChange(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  let added = 0;
  let processed = 0;

  files.forEach(file => {
    if (!file.type.startsWith('audio/')) { processed++; return; }
    const objectUrl = URL.createObjectURL(file);
    const tmpAudio = new Audio();
    tmpAudio.addEventListener('loadedmetadata', () => {
      state.songs.push({
        id: nextId++,
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: tmpAudio.duration,
        date: 'Just now',
        color: '#333',
        src: objectUrl,
        cover: null,
      });
      added++;
      processed++;
      if (processed === files.length) {
        renderSongs();
        showToast(`Added ${added} song${added === 1 ? '' : 's'}`);
      }
    });
    tmpAudio.src = objectUrl;
  });
  e.target.value = '';
}

// Drag & Drop support
function setupDragDrop() {
  const main = document.querySelector('.main-content');

  main.addEventListener('dragenter', (e) => {
    e.preventDefault();
    els.dropOverlay.classList.add('active');
  });

  main.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  main.addEventListener('dragleave', (e) => {
    // Only hide if leaving the main content area entirely
    if (!main.contains(e.relatedTarget)) {
      els.dropOverlay.classList.remove('active');
    }
  });

  main.addEventListener('drop', async (e) => {
    e.preventDefault();
    els.dropOverlay.classList.remove('active');

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length === 0) return;

    if (window.electronAPI) {
      const paths = files.map(f => f.path).filter(Boolean);
      if (paths.length > 0) addMusicFilesElectron(paths);
      else showToast('Cannot access file paths in this context');
    } else {
      addDroppedFilesBrowser(files);
    }
  });
}

// Browser: read dropped files via FileReader
function addDroppedFilesBrowser(files) {
  let added = 0;
  let processed = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      const tmpAudio = new Audio();
      tmpAudio.addEventListener('loadedmetadata', () => {
        state.songs.push({
          id: nextId++,
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          duration: tmpAudio.duration,
          date: 'Just now',
          color: '#333',
          src: reader.result,
          cover: null,
        });
        added++;
        processed++;
        if (processed === files.length) {
          renderSongs();
          showToast(`Added ${added} song${added === 1 ? '' : 's'}`);
        }
      });
      tmpAudio.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// View switching (Home / Search / Library)
function setupViewNav() {
  document.querySelectorAll('.nav-main .nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const view = item.dataset.view;
      state.view = view;
      switch (view) {
        case 'home': renderHomeView(); break;
        case 'search': renderSearchView(); break;
        case 'library': renderLibraryView(); break;
      }
    });
  });
}

function renderHomeView() {
  // Reset to normal playlist view
  els.contentScroll.innerHTML = `
    <section class="hero-section" id="heroSection">
      <div class="hero-content">
        <div class="hero-art" id="heroArt">
          <div class="art-gradient">
            <i class="fas fa-music"></i>
          </div>
        </div>
        <div class="hero-info">
          <span class="hero-type">PLAYLIST</span>
          <h1 class="hero-title" id="heroTitle">${state.currentPlaylist}</h1>
          <p class="hero-description">The perfect soundtrack to your day.</p>
          <div class="hero-meta">
            <span><i class="fas fa-user"></i> Melody</span>
            <span>• ${state.songs.length} songs</span>
          </div>
        </div>
      </div>
    </section>
    <div class="action-bar">
      <button class="btn-play-lg" id="playAllBtn"><i class="fas fa-play"></i></button>
      <button class="btn-icon" id="homeShuffleBtn" title="Shuffle"><i class="fas fa-random"></i></button>
      <button class="btn-icon" id="homeLikeBtn" title="Like all"><i class="far fa-heart"></i></button>
      <button class="btn-icon" id="homeMoreBtn" title="More options"><i class="fas fa-ellipsis-h"></i></button>
    </div>
    <div class="songs-header">
      <span class="col-number">#</span>
      <span class="col-title">Title</span>
      <span class="col-artist">Artist</span>
      <span class="col-album">Album</span>
      <span class="col-date">Date Added</span>
      <span class="col-duration"><i class="far fa-clock"></i></span>
    </div>
    <div class="songs-list" id="songsList"></div>
    <div class="list-end">
      <p>End of playlist</p>
      <button class="btn-add-more" id="addMoreBtn"><i class="fas fa-plus"></i> Add more songs</button>
    </div>
  `;
  // Re-cache dynamic elements
  els.songsList = document.getElementById('songsList');
  els.heroTitle = document.getElementById('heroTitle');
  els.heroArt = document.getElementById('heroArt');
  els.playAllBtn = document.getElementById('playAllBtn');
  els.addMoreBtn = document.getElementById('addMoreBtn');
  const shuffleBtn = document.getElementById('homeShuffleBtn');
  const likeBtn = document.getElementById('homeLikeBtn');
  const moreBtn = document.getElementById('homeMoreBtn');
  renderSongs();
  // Re-bind buttons
  els.playAllBtn.addEventListener('click', () => { const s = getFilteredSongs()[0]; if (s) playSong(s); });
  els.addMoreBtn.addEventListener('click', openFileDialog);
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    shuffleBtn.style.color = state.shuffle ? 'var(--primary)' : '';
    showToast(state.shuffle ? 'Shuffle: ON' : 'Shuffle: OFF');
  });
  if (likeBtn) likeBtn.addEventListener('click', () => {
    if (state.songs.length === 0) { showToast('No songs to like'); return; }
    state.songs.forEach(s => state.liked.add(s.id));
    renderSongs();
    updateLikedCount();
    showToast(`Liked all ${state.songs.length} songs`);
  });
  if (moreBtn) moreBtn.addEventListener('click', () => {
    showToast('More options — coming soon');
  });
}

function renderSearchView() {
  const genres = [
    { name: 'Pop', color: '#e13300' },
    { name: 'Hip-Hop', color: '#ba5d07' },
    { name: 'Rock', color: '#e61e32' },
    { name: 'Electronic', color: '#00d4e4' },
    { name: 'Jazz', color: '#40a0e0' },
    { name: 'Classical', color: '#503750' },
    { name: 'R&B', color: '#dc148c' },
    { name: 'Country', color: '#a56752' },
    { name: 'Latin', color: '#e13300' },
    { name: 'Indie', color: '#8c67ab' },
    { name: 'Metal', color: '#1e3264' },
    { name: 'Folk', color: '#4a7c9b' },
  ];
  els.contentScroll.innerHTML = `
    <div class="search-view">
      <h2>Browse All</h2>
      <div class="search-genres">
        ${genres.map(g => `
          <div class="genre-card" style="background: linear-gradient(135deg, ${g.color}, ${adjustColor(g.color, -40)});">
            ${g.name}
          </div>
        `).join('')}
      </div>
      <h2 style="margin-top: 32px;">Your Songs</h2>
      <div class="songs-header">
        <span class="col-number">#</span>
        <span class="col-title">Title</span>
        <span class="col-artist">Artist</span>
        <span class="col-album">Album</span>
        <span class="col-date">Date Added</span>
        <span class="col-duration"><i class="far fa-clock"></i></span>
      </div>
      <div class="songs-list" id="songsList"></div>
    </div>
  `;
  els.songsList = document.getElementById('songsList');
  renderSongs();

  // Bind genre card clicks
  document.querySelectorAll('.genre-card').forEach(card => {
    card.addEventListener('click', () => {
      const genre = card.textContent.trim();
      showToast(`Browsing ${genre} — coming soon`);
    });
  });
}

function renderLibraryView() {
  const artists = [...new Set(state.songs.map(s => s.artist))];
  const albums = [...new Set(state.songs.map(s => s.album))];
  els.contentScroll.innerHTML = `
    <div class="library-view">
      <div class="library-header">
        <div>
          <h2>Your Library</h2>
          <p class="library-subtitle">${state.songs.length} songs • ${artists.length} artists • ${albums.length} albums</p>
        </div>
        ${state.songs.length > 0 ? `
        <button class="btn-icon" id="clearLibraryBtn" title="Delete all songs">
          <i class="fas fa-trash-alt"></i>
        </button>` : ''}
      </div>
      <div class="library-grid">
        <div class="library-card" data-playlist="liked">
          <div class="library-card-art" style="background: linear-gradient(135deg, #450af5, #c4efd9);">
            <i class="fas fa-heart"></i>
          </div>
          <div class="library-card-title">Liked Songs</div>
          <div class="library-card-sub">${state.liked.size} songs</div>
        </div>
        <div class="library-card" data-playlist="recent">
          <div class="library-card-art" style="background: linear-gradient(135deg, #e61e32, #503750);">
            <i class="fas fa-history"></i>
          </div>
          <div class="library-card-title">Recently Played</div>
          <div class="library-card-sub">Auto-generated</div>
        </div>
        ${artists.slice(0, 8).map(a => `
          <div class="library-card">
            <div class="library-card-art" style="background: linear-gradient(135deg, #8c67ab, #1e3264);">
              <i class="fas fa-user"></i>
            </div>
            <div class="library-card-title">${a}</div>
            <div class="library-card-sub">${state.songs.filter(s => s.artist === a).length} songs</div>
          </div>
        `).join('')}
        ${albums.slice(0, 8).map(a => `
          <div class="library-card">
            <div class="library-card-art" style="background: linear-gradient(135deg, #00d4e4, #40a0e0);">
              <i class="fas fa-compact-disc"></i>
            </div>
            <div class="library-card-title">${a}</div>
            <div class="library-card-sub">${state.songs.filter(s => s.album === a).length} songs</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  // Re-bind library card clicks
  document.querySelectorAll('.library-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.playlist) {
        const names = { liked: 'Liked Songs', recent: 'Recently Played' };
        switchPlaylist(names[card.dataset.playlist] || 'Playlist');
      }
    });
  });

  // Listen for app closing to save state
  if (window.electronAPI) {
    window.electronAPI.onAppClosing(() => saveState());
  }

  // Clear all songs from library
  document.getElementById('clearLibraryBtn')?.addEventListener('click', () => {
    if (state.songs.length === 0) { showToast('Library is empty'); return; }
    if (confirm(`Delete all ${state.songs.length} songs from your library?`)) {
      state.songs = [];
      state.liked.clear();
      state.currentSong = null;
      audio.pause();
      state.isPlaying = false;
      updatePlayButton();
      renderLibraryView();
      showToast('All songs deleted');
    }
  });
}

// Settings panel
function setupSettings() {
  const panel = document.getElementById('settingsPanel');
  const openBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeSettings');

  if (!panel || !openBtn) return;

  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  // Theme toggle inside settings
  const themeBtn = document.getElementById('settingsTheme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Volume slider
  const volSlider = document.getElementById('settingsVolume');
  const volValue = document.getElementById('volValue');
  if (volSlider) {
    volSlider.addEventListener('input', () => {
      state.volume = volSlider.value / 100;
      audio.volume = state.volume;
      updateVolumeUI();
      if (volValue) volValue.textContent = volSlider.value + '%';
    });
  }

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('open') && !panel.contains(e.target) && !openBtn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      panel.classList.remove('open');
    }
  });
}

// Create playlist modal
function setupCreatePlaylist() {
  const modal = document.getElementById('playlistModal');
  const input = document.getElementById('playlistNameInput');
  const confirmBtn = document.getElementById('confirmPlaylist');
  const cancelBtn = document.getElementById('cancelPlaylist');

  function openModal() {
    modal.classList.add('open');
    input.value = '';
    setTimeout(() => input.focus(), 100);
  }

  function closeModal() {
    modal.classList.remove('open');
  }

  function createPlaylist() {
    const name = input.value.trim();
    if (!name) { showToast('Please enter a name'); return; }
    const item = document.createElement('li');
    item.className = 'nav-item';
    item.dataset.playlist = 'custom-' + Date.now();
    item.innerHTML = `
      <a href="#">
        <i class="fas fa-music"></i>
        <span class="nav-text">${name}</span>
      </a>`;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      switchPlaylist(name);
    });
    document.querySelector('.nav-playlists').appendChild(item);
    closeModal();
    showToast(`Playlist "${name}" created`);
  }

  document.getElementById('createPlaylist')?.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);
  confirmBtn?.addEventListener('click', createPlaylist);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createPlaylist();
    if (e.key === 'Escape') closeModal();
  });
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

// Playlist nav (kept for data-playlist items)
function setupPlaylistNav() {
  document.querySelectorAll('.nav-item[data-playlist]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const names = {
        liked: 'Liked Songs',
        recent: 'Recently Played',
        'playlist-1': 'Chill Vibes',
        'playlist-2': 'Workout Mix',
        'playlist-3': 'Focus Flow',
      };
      switchPlaylist(names[item.dataset.playlist] || 'Playlist');
    });
  });
}

// =============================================
// CONTEXT MENU (right-click)
// =============================================
function showContextMenu(x, y, song) {
  // Remove any existing context menu
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const isLiked = state.liked.has(song.id);

  menu.innerHTML = `
    <div class="ctx-item" data-action="play">
      <i class="fas fa-play"></i> Play
    </div>
    <div class="ctx-item" data-action="like">
      <i class="fa${isLiked ? 's' : 'r'} fa-heart"></i> ${isLiked ? 'Remove from Liked' : 'Add to Liked Songs'}
    </div>
    <div class="ctx-divider"></div>
    <div class="ctx-item" data-action="remove">
      <i class="fas fa-trash-alt"></i> Remove from Playlist
    </div>
    <div class="ctx-item danger" data-action="delete">
      <i class="fas fa-times-circle"></i> Delete Completely
    </div>
  `;

  document.body.appendChild(menu);

  // Adjust if menu goes off-screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

  // Handle clicks
  menu.addEventListener('click', (e) => {
    const action = e.target.closest('.ctx-item')?.dataset.action;
    switch (action) {
      case 'play': playSong(song); break;
      case 'like': toggleLike(song.id); break;
      case 'remove': removeSong(song.id); break;
      case 'delete': deleteSong(song.id); break;
    }
    menu.remove();
  });

  // Close on outside click
  const closeHandler = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('mousedown', closeHandler);
    }
  };
  document.addEventListener('mousedown', closeHandler);
}

// Delete song completely (remove from all playlists)
function deleteSong(id) {
  const song = state.songs.find(s => s.id === id);
  if (!song) return;
  if (confirm(`Delete "${song.title}" from your library?`)) {
    removeSong(id);
    showToast(`Deleted "${song.title}"`);
  }
}

// =============================================
// SIDEBAR RESIZE
// =============================================
function setupSidebarResize() {
  const sidebar = document.getElementById('sidebar');
  const handle = document.getElementById('sidebarResize');
  if (!sidebar || !handle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const newWidth = Math.max(180, Math.min(500, startWidth + delta));
    sidebar.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  // Double-click to reset width
  handle.addEventListener('dblclick', () => {
    sidebar.style.width = 'var(--sidebar-width)';
    // Force reflow
    sidebar.style.getPropertyValue('width');
    requestAnimationFrame(() => {
      sidebar.style.width = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim() || '280px';
    });
  });
}

// =============================================
// PERSISTENCE — save / load state
// =============================================
function saveState() {
  try {
    // Save filePath for reloadable songs, src for browser-added files
    const songsToSave = state.songs.map(s => {
      const saved = {
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        date: s.date,
        color: s.color,
        cover: s.cover,
        filePath: s.filePath || null,
      };
      // Only include src if it's a data URL (browser fallback), skip blob URLs
      if (s.src && s.src.startsWith('data:')) {
        saved.src = s.src;
      }
      return saved;
    });
    localStorage.setItem('melody_state', JSON.stringify({
      songs: songsToSave,
      liked: [...state.liked],
      currentPlaylist: state.currentPlaylist,
      volume: state.volume,
      shuffle: state.shuffle,
      repeat: state.repeat,
    }));
    console.log('State saved:', songsToSave.length, 'songs');
  } catch (e) { console.warn('saveState failed:', e); }
}

async function loadState() {
  try {
    const raw = localStorage.getItem('melody_state');
    if (!raw) { console.log('No saved state'); return; }
    const data = JSON.parse(raw);
    console.log('Loading saved state:', data.songs?.length || 0, 'songs');

    if (Array.isArray(data.liked)) state.liked = new Set(data.liked);
    if (data.currentPlaylist) state.currentPlaylist = data.currentPlaylist;
    if (typeof data.volume === 'number') state.volume = data.volume;
    if (typeof data.shuffle === 'boolean') state.shuffle = data.shuffle;
    if (typeof data.repeat === 'boolean') state.repeat = data.repeat;

    // Reload songs from file paths (Electron only)
    if (Array.isArray(data.songs) && data.songs.length > 0) {
      if (window.electronAPI) {
        const loaded = [];
        for (const s of data.songs) {
          try {
            const filePath = s.filePath;
            if (!filePath) { console.log('No filePath for:', s.title); continue; }
            const dataUrl = await window.electronAPI.readFileAsDataUrl(filePath);
            if (!dataUrl) { console.log('Failed to read:', filePath); continue; }
            const meta = await window.electronAPI.parseMetadata(filePath);
            loaded.push({
              id: s.id,
              title: meta.title || s.title,
              artist: meta.artist || s.artist,
              album: meta.album || s.album,
              duration: meta.duration || s.duration,
              date: s.date || 'Just now',
              color: s.color || '#333',
              cover: meta.cover || s.cover || null,
              filePath: filePath,
              src: dataUrl,
            });
          } catch (e) { console.warn('Failed to reload:', s.title, e.message); }
        }
        console.log('Reloaded:', loaded.length, 'songs');
        if (loaded.length > 0) state.songs = loaded;
      } else {
        // Browser: no filePath support, songs lost on reload
        console.log('Browser mode: cannot reload songs from paths');
      }
    }
    // Update nextId to avoid collisions
    const maxId = state.songs.reduce((m, s) => Math.max(m, s.id), 0);
    nextId = maxId + 1;
    console.log('State loaded. Songs:', state.songs.length, 'Liked:', state.liked.size);
  } catch (e) { console.warn('loadState failed:', e); }
}

// Debounced save (avoid excessive writes)
let saveTimer = null;
function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 500);
}

// Init
async function init() {
  await loadState();
  loadTheme();
  renderSongs();
  updateVolumeUI();
  setupWindowControls();
  setupPlaylistNav();
  setupViewNav();
  setupSettings();
  setupCreatePlaylist();
  setupDragDrop();
  setupSidebarResize();

  els.playPauseBtn.addEventListener('click', togglePlay);
  els.prevBtn.addEventListener('click', prevSong);
  els.nextBtn.addEventListener('click', nextSong);
  els.shuffleBtn.addEventListener('click', toggleShuffle);
  els.repeatBtn.addEventListener('click', toggleRepeat);
  els.likeBtn.addEventListener('click', () => state.currentSong && toggleLike(state.currentSong.id));
  els.progressBar.addEventListener('click', handleProgressClick);
  els.volumeBar.addEventListener('click', handleVolumeClick);
  els.volumeBtn.addEventListener('click', toggleMute);
  els.searchInput.addEventListener('input', () => renderSongs(getFilteredSongs()));
  els.searchClear.addEventListener('click', () => { els.searchInput.value = ''; renderSongs(); });
  els.themeToggle.addEventListener('click', toggleTheme);
  els.playAllBtn.addEventListener('click', () => { const s = getFilteredSongs()[0]; if (s) playSong(s); });
  els.addSongsBtn.addEventListener('click', openFileDialog);
  els.addFolderBtn.addEventListener('click', openFolderDialog);
  els.addMoreBtn.addEventListener('click', openFileDialog);
  els.fileInput.addEventListener('change', onFileInputChange);
  els.folderInput.addEventListener('change', onFolderInputChange);

  // Clear liked songs
  const clearLikedBtn = document.getElementById('clearLiked');
  if (clearLikedBtn) clearLikedBtn.addEventListener('click', (e) => { e.stopPropagation(); clearLikedSongs(); });

  // Bottom right player buttons
  document.getElementById('queueBtn')?.addEventListener('click', () => showToast('Queue — coming soon'));
  document.getElementById('devicesBtn')?.addEventListener('click', () => showToast('Devices — coming soon'));
  document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      showToast('Fullscreen');
    } else {
      document.exitFullscreen?.();
    }
  });
  document.addEventListener('keydown', handleKeyboard);

  // Prev/Next page buttons
  els.prevPage.addEventListener('click', () => els.contentScroll.scrollBy({ left: -300, behavior: 'smooth' }));
  els.nextPage.addEventListener('click', () => els.contentScroll.scrollBy({ left: 300, behavior: 'smooth' }));

  // Apply initial playlist name
  els.heroTitle.textContent = state.currentPlaylist;
}

init();