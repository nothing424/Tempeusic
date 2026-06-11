/**
 * TempeMusic – app.js
 * Source: YouTube Music via Piped API (open-source YT Music proxy)
 * GitHub ref: MetrolistGroup/Metrolist (YT Music Android client)
 */

// ─── CONFIG ────────────────────────────────────────────────────────────────
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://api.piped.yt',
];
let PIPED_API = PIPED_INSTANCES[0];

// ─── STATE ──────────────────────────────────────────────────────────────────
const state = {
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  shuffle: false,
  repeat: false, // false | 'one' | 'all'
  liked: JSON.parse(localStorage.getItem('tm_liked') || '[]'),
  recent: JSON.parse(localStorage.getItem('tm_recent') || '[]'),
  volume: 80,
  ytPlayer: null,
  ytReady: false,
  currentVideoId: null,
  progressInterval: null,
};

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupSearch();
  setupPlayer();
  setupSidebar();
  loadHome();
  updateLibraryView('liked');
});

// ─── YOUTUBE IFrame API ───────────────────────────────────────────────────────
window.onYouTubeIframeAPIReady = function () {
  state.ytPlayer = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
    events: {
      onReady: () => { state.ytReady = true; setVolume(state.volume); },
      onStateChange: onYTStateChange,
      onError: onYTError,
    },
  });
};

function onYTStateChange(e) {
  const S = YT.PlayerState;
  if (e.data === S.PLAYING) {
    setPlayingUI(true);
    startProgressTrack();
    spinVinyl(true);
  } else if (e.data === S.PAUSED) {
    setPlayingUI(false);
    stopProgressTrack();
    spinVinyl(false);
  } else if (e.data === S.ENDED) {
    handleTrackEnd();
  } else if (e.data === S.BUFFERING) {
    // show buffering indicator if desired
  }
}

function onYTError(e) {
  console.warn('YT error:', e.data);
  toast('⚠️ Lagu tidak tersedia, ke lagu berikutnya...');
  setTimeout(playNext, 1500);
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function setupNavigation() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.dataset.view;
      navigateTo(view);
    });
  });

  // See-all links
  $$('[data-view]').forEach(el => {
    if (el.classList.contains('see-all')) {
      el.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(el.dataset.view);
      });
    }
  });

  // Library tabs
  $$('.lib-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.lib-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateLibraryView(tab.dataset.tab);
    });
  });

  // Genre chips
  $$('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      searchMusic(chip.dataset.query);
      navigateTo('search');
    });
  });

  // Hero play btn
  $('hero-play-btn')?.addEventListener('click', () => {
    if (state.queue.length > 0) {
      playTrack(state.currentIndex >= 0 ? state.currentIndex : 0);
    } else {
      searchMusic('pop indonesia terbaru 2025');
      toast('🎵 Memuat musik populer...');
    }
  });
}

function navigateTo(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const view = $(`view-${viewId}`);
  if (view) view.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (navItem) navItem.classList.add('active');

  if (viewId === 'trending') loadTrending();
  if (viewId === 'library') updateLibraryView('liked');

  // Close sidebar on mobile
  if (window.innerWidth <= 900) {
    $('sidebar').classList.remove('open');
  }
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function setupSidebar() {
  $('menu-btn')?.addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
  });
  $$('.playlist-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo('library');
      const tabId = item.dataset.playlist === 'liked' ? 'liked'
        : item.dataset.playlist === 'recent' ? 'recent' : 'liked';
      $$('.lib-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
      });
      updateLibraryView(tabId);
    });
  });
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function pipedFetch(path) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`);
      if (!res.ok) continue;
      PIPED_API = instance;
      $('instance-name').textContent = new URL(instance).hostname.replace('pipedapi.', '').replace('api.', '');
      return await res.json();
    } catch (_) { continue; }
  }
  throw new Error('Semua instance tidak tersedia');
}

async function searchPiped(query) {
  return pipedFetch(`/search?q=${encodeURIComponent(query)}&filter=music_songs`);
}

async function getTrendingPiped() {
  return pipedFetch('/trending?region=ID');
}

async function getStreamUrl(videoId) {
  try {
    const data = await pipedFetch(`/streams/${videoId}`);
    return data;
  } catch (e) {
    return null;
  }
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
async function loadHome() {
  loadTrendingGrid();
  loadRecommendations();
}

async function loadTrendingGrid() {
  try {
    const data = await getTrendingPiped();
    const items = (data || []).slice(0, 8);
    if (!items.length) { fallbackTrendingGrid(); return; }
    const grid = $('trending-grid');
    grid.innerHTML = '';
    items.forEach((item, i) => {
      const card = buildTrackCard(item, i, items, 'trending-grid');
      grid.appendChild(card);
    });
    state.queue = items.map(normalizeTrack);
  } catch (e) {
    fallbackTrendingGrid();
  }
}

function fallbackTrendingGrid() {
  searchMusic('lagu viral indonesia 2025', 'trending-grid', 'card');
}

async function loadRecommendations() {
  try {
    const data = await searchPiped('top hits indonesia');
    const items = (data?.items || []).slice(0, 8);
    const list = $('reco-list');
    list.innerHTML = '';
    items.forEach((item, i) => {
      const row = buildTrackRow(item, i, items, 'reco');
      list.appendChild(row);
    });
  } catch (e) {
    $('reco-list').innerHTML = '<div class="empty-state"><div class="empty-icon">🎵</div><p>Gagal memuat rekomendasi</p></div>';
  }
}

// ─── TRENDING ─────────────────────────────────────────────────────────────────
async function loadTrending() {
  const list = $('trending-list');
  list.innerHTML = '<div class="loading-shimmer"><div class="shimmer-row"></div><div class="shimmer-row"></div><div class="shimmer-row"></div><div class="shimmer-row"></div><div class="shimmer-row"></div></div>';
  try {
    const data = await getTrendingPiped();
    const items = (data || []).slice(0, 25);
    if (!items.length) { loadTrendingFallback(); return; }
    list.innerHTML = '';
    items.forEach((item, i) => {
      const row = buildTrackRow(item, i, items, 'trending');
      list.appendChild(row);
    });
  } catch (e) {
    loadTrendingFallback();
  }
}

function loadTrendingFallback() {
  searchMusic('trending lagu indonesia 2025', null, 'row', 'trending-list');
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function setupSearch() {
  const input = $('search-input');
  const btn = $('search-btn');

  btn.addEventListener('click', () => {
    const q = input.value.trim();
    if (q) { navigateTo('search'); searchMusic(q); }
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) { navigateTo('search'); searchMusic(q); }
    }
  });
}

async function searchMusic(query, targetGridId = null, mode = 'row', targetListId = null) {
  const listId = targetListId || 'search-results';
  const container = $(targetGridId || listId);
  if (!container) return;

  if (!targetGridId) {
    $('search-results').innerHTML = '<div class="loading-shimmer"><div class="shimmer-row"></div><div class="shimmer-row"></div><div class="shimmer-row"></div></div>';
  }

  try {
    const data = await searchPiped(query);
    const items = (data?.items || []).filter(i => i.type === 'stream' || i.url?.includes('/watch')).slice(0, 20);

    if (targetGridId && mode === 'card') {
      const grid = $(targetGridId);
      grid.innerHTML = '';
      grid.style.display = 'grid';
      items.slice(0, 8).forEach((item, i) => {
        grid.appendChild(buildTrackCard(item, i, items, 'search'));
      });
    } else {
      const list = $(listId);
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">😕</div><p>Tidak ada hasil untuk pencarian ini</p></div>';
        return;
      }
      items.forEach((item, i) => {
        list.appendChild(buildTrackRow(item, i, items, 'search'));
      });
    }
    if (!targetGridId) state.queue = items.map(normalizeTrack);
  } catch (e) {
    const el = $(targetGridId || listId);
    if (el) el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal mengambil data. Cek koneksi.</p></div>';
  }
}

// ─── TRACK BUILDERS ───────────────────────────────────────────────────────────
function normalizeTrack(item) {
  const url = item.url || '';
  const videoId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0]
    : url.split('/').pop();
  return {
    id: videoId || Math.random().toString(36).slice(2),
    title: item.title || item.name || 'Unknown',
    artist: item.uploaderName || item.uploader || item.artist || 'Unknown',
    thumbnail: item.thumbnail || item.thumbnailUrl || '',
    duration: item.duration || 0,
    videoId,
  };
}

function buildTrackCard(item, index, allItems, context) {
  const track = normalizeTrack(item);
  const card = document.createElement('div');
  card.className = 'track-card';
  card.innerHTML = `
    <div class="card-thumb">
      ${track.thumbnail
        ? `<img src="${track.thumbnail}" alt="${escHtml(track.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="card-thumb-placeholder" ${track.thumbnail ? 'style="display:none"' : ''}>🎵</div>
      <button class="card-play-btn" aria-label="Putar">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
    </div>
    <div class="card-info">
      <div class="card-title">${escHtml(track.title)}</div>
      <div class="card-artist">${escHtml(track.artist)}</div>
    </div>
  `;
  card.addEventListener('click', () => {
    state.queue = allItems.map(normalizeTrack);
    state.currentIndex = index;
    playTrack(index);
  });
  return card;
}

function buildTrackRow(item, index, allItems, context) {
  const track = normalizeTrack(item);
  const dur = formatDuration(track.duration);
  const isLiked = state.liked.some(l => l.id === track.id);

  const row = document.createElement('div');
  row.className = 'track-row';
  row.dataset.trackId = track.id;
  row.innerHTML = `
    <div class="track-num">${index + 1}</div>
    <div class="track-thumb-sm">
      ${track.thumbnail
        ? `<img src="${track.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <span class="th-placeholder" ${track.thumbnail ? 'style="display:none"' : ''}>🎵</span>
    </div>
    <div class="track-meta">
      <div class="track-name">${escHtml(track.title)}</div>
      <div class="track-artist-sub">${escHtml(track.artist)}</div>
    </div>
    <div class="track-duration">${dur}</div>
    <button class="track-like-btn ${isLiked ? 'liked' : ''}" title="Suka">
      <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </button>
  `;

  row.querySelector('.track-like-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleLike(track, e.currentTarget);
  });

  row.addEventListener('click', () => {
    state.queue = allItems.map(normalizeTrack);
    state.currentIndex = index;
    playTrack(index);
  });
  return row;
}

// ─── PLAYBACK ─────────────────────────────────────────────────────────────────
async function playTrack(index) {
  const track = state.queue[index];
  if (!track) return;

  state.currentIndex = index;
  state.currentVideoId = track.videoId;

  // Update UI immediately
  updatePlayerInfo(track);
  markPlayingRow(track.id);

  // Add to recent
  addToRecent(track);

  if (!state.ytReady || !state.ytPlayer) {
    toast('⏳ Player belum siap, tunggu sebentar...');
    setTimeout(() => playTrack(index), 1500);
    return;
  }

  try {
    if (track.videoId) {
      state.ytPlayer.loadVideoById(track.videoId);
      state.ytPlayer.playVideo();
    } else {
      toast('⚠️ ID video tidak ditemukan');
    }
  } catch (e) {
    toast('⚠️ Gagal memutar lagu');
  }
}

function togglePlay() {
  if (!state.ytReady || !state.ytPlayer) return;
  try {
    const yt = state.ytPlayer;
    const ytState = yt.getPlayerState?.();
    if (ytState === YT.PlayerState.PLAYING) {
      yt.pauseVideo();
    } else {
      if (state.currentVideoId) {
        yt.playVideo();
      } else if (state.queue.length > 0) {
        playTrack(0);
      }
    }
  } catch (e) { }
}

function playNext() {
  if (!state.queue.length) return;
  let next;
  if (state.shuffle) {
    next = Math.floor(Math.random() * state.queue.length);
  } else {
    next = (state.currentIndex + 1) % state.queue.length;
  }
  playTrack(next);
}

function playPrev() {
  if (!state.queue.length) return;
  const prev = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
  playTrack(prev);
}

function handleTrackEnd() {
  if (state.repeat === 'one') {
    state.ytPlayer.seekTo(0);
    state.ytPlayer.playVideo();
  } else if (state.repeat === 'all' || state.currentIndex < state.queue.length - 1) {
    playNext();
  } else {
    setPlayingUI(false);
    spinVinyl(false);
  }
}

// ─── PLAYER UI ────────────────────────────────────────────────────────────────
function setupPlayer() {
  $('play-pause-btn').addEventListener('click', togglePlay);
  $('next-btn').addEventListener('click', playNext);
  $('prev-btn').addEventListener('click', playPrev);

  $('shuffle-btn').addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    $('shuffle-btn').classList.toggle('active', state.shuffle);
    toast(state.shuffle ? '🔀 Acak aktif' : '🔀 Acak nonaktif');
  });

  $('repeat-btn').addEventListener('click', () => {
    if (!state.repeat) { state.repeat = 'all'; $('repeat-btn').classList.add('active'); toast('🔁 Ulangi semua'); }
    else if (state.repeat === 'all') { state.repeat = 'one'; toast('🔂 Ulangi satu'); }
    else { state.repeat = false; $('repeat-btn').classList.remove('active'); toast('🔁 Ulangi nonaktif'); }
  });

  $('player-like-btn').addEventListener('click', () => {
    const track = state.queue[state.currentIndex];
    if (track) toggleLike(track, $('player-like-btn'));
  });

  $('progress-bar').addEventListener('click', e => {
    if (!state.ytReady || !state.ytPlayer) return;
    const rect = $('progress-bar').getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    try {
      const dur = state.ytPlayer.getDuration?.() || 0;
      state.ytPlayer.seekTo(pct * dur, true);
    } catch (_) {}
  });

  $('volume-slider').addEventListener('input', e => {
    state.volume = parseInt(e.target.value);
    setVolume(state.volume);
  });
}

function setVolume(vol) {
  if (state.ytPlayer?.setVolume) {
    try { state.ytPlayer.setVolume(vol); } catch (_) {}
  }
}

function updatePlayerInfo(track) {
  $('player-title').textContent = track.title;
  $('player-artist').textContent = track.artist;
  const thumb = $('player-thumb');
  if (track.thumbnail) {
    thumb.innerHTML = `<img src="${track.thumbnail}" alt="" onerror="this.parentElement.innerHTML='<svg viewBox=\\"0 0 24 24\\"><path d=\\"M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\"/></svg>'">`;
  }
  // Update like button
  const liked = state.liked.some(l => l.id === track.id);
  $('player-like-btn').classList.toggle('liked', liked);
}

function setPlayingUI(playing) {
  state.isPlaying = playing;
  const btn = $('play-pause-btn');
  btn.querySelector('.icon-play').style.display = playing ? 'none' : 'block';
  btn.querySelector('.icon-pause').style.display = playing ? 'block' : 'none';
}

function markPlayingRow(trackId) {
  $$('.track-row').forEach(row => {
    row.classList.toggle('playing', row.dataset.trackId === trackId);
  });
}

function spinVinyl(playing) {
  const vinyl = $('vinyl-disc');
  if (vinyl) vinyl.classList.toggle('playing', playing);
}

function startProgressTrack() {
  stopProgressTrack();
  state.progressInterval = setInterval(updateProgress, 500);
}

function stopProgressTrack() {
  if (state.progressInterval) clearInterval(state.progressInterval);
}

function updateProgress() {
  if (!state.ytReady || !state.ytPlayer) return;
  try {
    const cur = state.ytPlayer.getCurrentTime?.() || 0;
    const dur = state.ytPlayer.getDuration?.() || 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    $('progress-fill').style.width = pct + '%';
    $('time-current').textContent = formatDuration(Math.floor(cur));
    $('time-total').textContent = formatDuration(Math.floor(dur));
  } catch (_) {}
}

// ─── LIBRARY ──────────────────────────────────────────────────────────────────
function updateLibraryView(tab) {
  const list = $('library-list');
  list.innerHTML = '';

  let items = [];
  if (tab === 'liked') items = state.liked;
  else if (tab === 'recent') items = state.recent;
  else if (tab === 'queue') items = state.queue;

  if (!items.length) {
    const msgs = {
      liked: ['❤️', 'Belum ada lagu yang disukai', 'Tap ❤ di lagu manapun untuk menyimpan'],
      recent: ['🕐', 'Belum ada riwayat', 'Putar lagu manapun untuk mulai'],
      queue: ['🎵', 'Antrian kosong', 'Cari lagu untuk ditambahkan'],
    };
    const [icon, title, sub] = msgs[tab] || ['🎵', 'Kosong', ''];
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${title}</p><small>${sub}</small></div>`;
    return;
  }

  items.forEach((track, i) => {
    const row = buildTrackRow(track, i, items, 'library');
    list.appendChild(row);
  });
}

function toggleLike(track, btn) {
  const idx = state.liked.findIndex(l => l.id === track.id);
  if (idx >= 0) {
    state.liked.splice(idx, 1);
    btn.classList.remove('liked');
    toast('💔 Dihapus dari disukai');
  } else {
    state.liked.unshift(track);
    btn.classList.add('liked');
    toast('❤️ Ditambah ke disukai!');
  }
  localStorage.setItem('tm_liked', JSON.stringify(state.liked));
  // Also update player like btn
  if (state.queue[state.currentIndex]?.id === track.id) {
    $('player-like-btn').classList.toggle('liked', idx < 0);
  }
}

function addToRecent(track) {
  state.recent = state.recent.filter(r => r.id !== track.id);
  state.recent.unshift(track);
  if (state.recent.length > 50) state.recent = state.recent.slice(0, 50);
  localStorage.setItem('tm_recent', JSON.stringify(state.recent));
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function formatDuration(secs) {
  if (!secs || isNaN(secs)) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimeout;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2500);
}
