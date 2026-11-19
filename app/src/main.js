// Wires the Sunset Cover Studio editor: photos, layouts, per-panel crop and
// pan, caption, grade, export, and the ?shot= scenes for screenshots.
import { drawCover, renderCover, layoutPanels, panelCount, panelName } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const ctx = canvas.getContext('2d');

const SIZES = {
  '1920x1080': [1920, 1080],
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
};

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: '1920x1080',
  title: 'SUNSET HEIST',
  subtitle: 'VICE CITY · SUMMER 2026',
  photos: [],
  panels: [],
  selected: 0,
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function defaultPanels(layout) {
  // Pier is the wide sunset shot, boulevard the tall street shot: alternate
  // them so every layout shows both photos.
  const pier = state.photos.findIndex((p) => p.name === 'pier');
  const blvd = state.photos.findIndex((p) => p.name === 'boulevard');
  const a = pier === -1 ? 0 : pier;
  const b = blvd === -1 ? 0 : blvd;
  // A panel that repeats a photo gets a tighter crop, so it reads as a
  // different shot of the same scene instead of a copy.
  const mk = (photo, zoom = 1, panX = 0, panY = 0) => ({ photo, zoom, panX, panY });
  if (layout === 'grid') return [mk(a), mk(b), mk(b, 1.45, -0.3, 0.1), mk(a, 1.35, 0.35, -0.1)];
  if (layout === 'strip') return [mk(b), mk(a), mk(b, 1.45, 0.3, 0)];
  return [mk(a), mk(b), mk(a, 1.5, 0.35, -0.1)];
}

function rebuildPanels() {
  const old = state.panels;
  const fresh = defaultPanels(state.layout);
  for (let i = 0; i < fresh.length && i < old.length; i++) {
    if (old[i]) fresh[i].photo = old[i].photo;
  }
  state.panels = fresh;
  state.selected = Math.min(state.selected, fresh.length - 1);
}

let redrawQueued = false;
function redraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    const [w, h] = SIZES[state.size];
    canvas.width = w;
    canvas.height = h;
    drawCover(ctx, state, w, h, { selected: state.selected });
    $('sizeLabel').textContent = `${w} × ${h}`;
    $('panelName').textContent = `${state.selected + 1} · ${panelName(state.layout, state.selected)}`;
    syncPanelControls();
  });
}

function syncPanelControls() {
  const p = state.panels[state.selected];
  if (!p) return;
  $('zoom').value = p.zoom;
  $('panX').value = p.panX;
  $('panY').value = p.panY;
}

function renderTray() {
  const tray = $('photoTray');
  tray.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const thumb = document.createElement('img');
    thumb.src = photo.thumb;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    const selectedPhoto = state.panels[state.selected]?.photo;
    if (selectedPhoto === i) thumb.classList.add('on');
    thumb.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      renderTray();
      redraw();
    });
    tray.append(thumb);
  });
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  const name = file.name.replace(/\.[^.]+$/, '') || `photo ${state.photos.length + 1}`;
  state.photos.push({ name, img, thumb: url });
  renderTray();
  redraw();
  $('status').textContent = `Loaded ${name}. Click a panel, then a photo to place it.`;
}

async function exportPng(sizeKey) {
  const key = sizeKey ?? state.size;
  const [w, h] = SIZES[key];
  const out = renderCover(state, w, h);
  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  return blob;
}

async function downloadExport() {
  const [w, h] = SIZES[state.size];
  const blob = await exportPng();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sunset-cover-${w}x${h}.png`;
  a.click();
  $('status').textContent = `Saved sunset-cover-${w}x${h}.png — ${(blob.size / 1024).toFixed(0)} KiB.`;
}

function setSeg(id, value) {
  document.querySelectorAll(`#${id} button`).forEach((b) => {
    b.classList.toggle('on', b.dataset[Object.keys(b.dataset)[0]] === value);
  });
}

function wireSeg(id, key, apply) {
  $(id).addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    apply(btn.dataset[key]);
    redraw();
  });
}

// --- controls ---------------------------------------------------------------
$('photoInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) await addPhotoFile(file);
  e.target.value = '';
});
const dz = $('dropzone');
['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => {
  e.preventDefault();
  dz.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
  e.preventDefault();
  dz.classList.remove('over');
}));
dz.addEventListener('drop', async (e) => {
  for (const file of e.dataTransfer.files) {
    if (file.type.startsWith('image/')) await addPhotoFile(file);
  }
});
dz.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('photoInput').click(); }
});

wireSeg('layoutSeg', 'layout', (v) => { state.layout = v; rebuildPanels(); });
wireSeg('gradeSeg', 'grade', (v) => { state.grade = v; });
wireSeg('sizeSeg', 'size', (v) => { state.size = v; });

$('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  redraw();
});
$('panX').addEventListener('input', (e) => {
  state.panels[state.selected].panX = Number(e.target.value);
  redraw();
});
$('panY').addEventListener('input', (e) => {
  state.panels[state.selected].panY = Number(e.target.value);
  redraw();
});
$('fillPanel').addEventListener('click', () => {
  const p = state.panels[state.selected];
  p.zoom = 1; p.panX = 0; p.panY = 0;
  redraw();
});
$('swapPhoto').addEventListener('click', () => {
  const p = state.panels[state.selected];
  p.photo = (p.photo + 1) % state.photos.length;
  renderTray();
  redraw();
});
$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
$('export').addEventListener('click', downloadExport);
$('exportTop').addEventListener('click', downloadExport);

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  const hit = panels.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (hit >= 0) {
    state.selected = hit;
    renderTray();
    redraw();
  }
});

// --- shot-scene API (used by shots.js) --------------------------------------
const api = {
  setLayout(v) { if (panelCount(v)) { state.layout = v; rebuildPanels(); } },
  setGrade(v) { if (['sunset', 'neon', 'clean'].includes(v)) state.grade = v; },
  setSize(v) { if (SIZES[v]) state.size = v; },
  setCaption(title, subtitle) {
    if (title) { state.title = title; $('title').value = title; }
    if (subtitle !== undefined) { state.subtitle = subtitle; $('subtitle').value = subtitle; }
  },
  setPhoto(name) {
    const i = state.photos.findIndex((p) => p.name === name);
    if (i >= 0) {
      const other = state.photos.findIndex((p) => p.name !== name);
      state.panels.forEach((p, idx) => {
        p.photo = idx % 2 === 0 ? i : (other === -1 ? i : other);
      });
      if (state.layout === 'hero') state.panels[0].photo = i;
    }
  },
  async fontsReady() {
    try { await document.fonts.load('100px Anton'); } catch { /* fall back */ }
    await document.fonts.ready;
  },
  redraw,
  exportPng,
};

// --- boot -------------------------------------------------------------------
async function boot() {
  const [pier, blvd] = await Promise.all([
    loadImage('samples/pier.jpg'),
    loadImage('samples/boulevard.jpg'),
  ]);
  state.photos = [
    { name: 'pier', img: pier, thumb: 'samples/pier.jpg' },
    { name: 'boulevard', img: blvd, thumb: 'samples/boulevard.jpg' },
  ];
  rebuildPanels();
  renderTray();
  redraw();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    await api.fontsReady();
    await runShot(shot, params, api);
  } else {
    api.fontsReady().then(redraw);
  }
}

boot();
