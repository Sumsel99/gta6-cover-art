// Draws the multi-panel Vice City style cover onto a canvas.
// Layouts: hero (one big panel + two stacked), grid (2 x 2), strip (three
// vertical panels). Every panel holds its own photo, zoom and pan, so one
// photo can fill several panels or several photos can share the cover.

import { gradePixels, grainTile, vignette, sunsetWash } from './grade.js';

export const LAYOUTS = {
  hero: { panels: 3, names: ['Hero', 'Top right', 'Bottom right'] },
  grid: { panels: 4, names: ['Top left', 'Top right', 'Bottom left', 'Bottom right'] },
  strip: { panels: 3, names: ['Left', 'Middle', 'Right'] },
};

export function panelCount(layout) {
  return (LAYOUTS[layout] ?? LAYOUTS.hero).panels;
}

export function panelName(layout, index) {
  return (LAYOUTS[layout] ?? LAYOUTS.hero).names[index] ?? `Panel ${index + 1}`;
}

// Panel rectangles for a cover of W x H, with a thin dark gutter between them.
export function layoutPanels(layout, w, h) {
  const gap = Math.max(4, Math.round(w * 0.006));
  if (layout === 'grid') {
    const cw = (w - gap) / 2;
    const ch = (h - gap) / 2;
    return [
      { x: 0, y: 0, w: cw, h: ch },
      { x: cw + gap, y: 0, w: cw, h: ch },
      { x: 0, y: ch + gap, w: cw, h: ch },
      { x: cw + gap, y: ch + gap, w: cw, h: ch },
    ];
  }
  if (layout === 'strip') {
    const cw = (w - gap * 2) / 3;
    return [
      { x: 0, y: 0, w: cw, h },
      { x: cw + gap, y: 0, w: cw, h },
      { x: (cw + gap) * 2, y: 0, w: cw, h },
    ];
  }
  const big = w * 0.62;
  const side = w - big - gap;
  const half = (h - gap) / 2;
  return [
    { x: 0, y: 0, w: big, h },
    { x: big + gap, y: 0, w: side, h: half },
    { x: big + gap, y: half + gap, w: side, h: half },
  ];
}

// Cover-fit draw of one photo into a panel rect, with the panel's zoom and pan.
function drawPhotoInto(ctx, img, rect, zoom, panX, panY) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const maxX = Math.max(0, (dw - rect.w) / 2);
  const maxY = Math.max(0, (dh - rect.h) / 2);
  const dx = rect.x + (rect.w - dw) / 2 - panX * maxX;
  const dy = rect.y + (rect.h - dh) / 2 - panY * maxY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// Grade one panel: draw the photo to a scratch canvas, grade its pixels,
// then stamp it onto the cover.
function drawGradedPanel(ctx, img, rect, panel, grade, scratch) {
  const pw = Math.max(2, Math.round(rect.w));
  const ph = Math.max(2, Math.round(rect.h));
  scratch.width = pw;
  scratch.height = ph;
  const sctx = scratch.getContext('2d');
  sctx.fillStyle = '#1a0b2e';
  sctx.fillRect(0, 0, pw, ph);
  drawPhotoInto(sctx, img, { x: 0, y: 0, w: pw, h: ph }, panel.zoom, panel.panX, panel.panY);
  const data = sctx.getImageData(0, 0, pw, ph);
  gradePixels(data, grade);
  sctx.putImageData(data, 0, 0);
  ctx.drawImage(scratch, rect.x, rect.y);
}

function fitFont(ctx, text, maxWidth, startPx, family) {
  let px = startPx;
  ctx.font = `${px}px ${family}`;
  while (px > 24 && ctx.measureText(text).width > maxWidth) {
    px -= 4;
    ctx.font = `${px}px ${family}`;
  }
  return px;
}

// The big gradient sun disc behind the title, with thin cut lines.
function drawSun(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.45, '#ffb35c');
  g.addColorStop(0.8, '#ff5e7a');
  g.addColorStop(1, '#ff2e88');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(16,4,32,0.55)';
  const cut = r * 0.14;
  for (let i = 0; i < 3; i++) {
    const y = cy + r * 0.12 + i * cut;
    ctx.fillRect(cx - r, y, r * 2, cut * 0.32);
  }
  ctx.restore();
}

function drawCaption(ctx, state, w, h) {
  const bandH = h * 0.30;
  const bandY = h - bandH;
  const g = ctx.createLinearGradient(0, bandY - h * 0.06, 0, h);
  g.addColorStop(0, 'rgba(10,3,22,0)');
  g.addColorStop(0.45, 'rgba(10,3,22,0.62)');
  g.addColorStop(1, 'rgba(10,3,22,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, bandY - h * 0.06, w, h - bandY + h * 0.06);

  const pad = w * 0.035;
  const title = (state.title || 'SUNSET HEIST').toUpperCase();
  const sub = (state.subtitle || '').toUpperCase();

  // Sun disc peeking over the caption band from the top right, clear of the
  // title text: a setting sun behind the panels, never behind the letters.
  const sunR = h * 0.115;
  const sunX = w - pad - sunR * 0.85;
  const sunY = bandY - sunR * 0.75;
  drawSun(ctx, sunX, sunY, sunR);

  const titlePx = fitFont(ctx, title, w - pad * 2, h * 0.135, 'Anton, sans-serif');
  const titleY = bandY + bandH * 0.62;
  ctx.save();
  ctx.font = `${titlePx}px Anton, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12,2,24,0.95)';
  ctx.lineWidth = Math.max(4, titlePx * 0.09);
  ctx.shadowColor = 'rgba(255,46,136,0.55)';
  ctx.shadowBlur = titlePx * 0.22;
  ctx.shadowOffsetY = titlePx * 0.04;
  ctx.strokeText(title, pad, titleY);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, pad, titleY);
  ctx.restore();

  if (sub) {
    const subPx = Math.max(14, Math.round(h * 0.032));
    ctx.save();
    ctx.font = `${subPx}px Anton, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subPx * 0.18)}px`; } catch { /* older canvas */ }
    const tw = ctx.measureText(sub).width;
    const pillPadX = subPx * 0.9;
    const pillW = tw + pillPadX * 2;
    const pillH = subPx * 1.9;
    const pillX = pad;
    const pillY = titleY + h * 0.028;
    const pg = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
    pg.addColorStop(0, '#ff2e88');
    pg.addColorStop(1, '#ff9a3d');
    ctx.fillStyle = pg;
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(sub, pillX + pillPadX, pillY + pillH / 2 + subPx * 0.06);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Render the whole cover. `opts.selected` draws a pink outline around one
// panel (preview only); exports pass nothing.
export function drawCover(ctx, state, w, h, opts = {}) {
  ctx.save();
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h);
  const scratch = drawCover.scratch ?? (drawCover.scratch = document.createElement('canvas'));
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: 0, zoom: 1, panX: 0, panY: 0 };
    const img = state.photos[panel.photo]?.img;
    if (img) drawGradedPanel(ctx, img, rect, panel, state.grade, scratch);
  });
  sunsetWash(ctx, w, h, state.grade);
  // Film grain over the panels.
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  vignette(ctx, 0, 0, w, h, 0.4);
  drawCaption(ctx, state, w, h);
  if (opts.selected != null && rects[opts.selected]) {
    const r = rects[opts.selected];
    ctx.save();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.setLineDash([w * 0.012, w * 0.008]);
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.restore();
  }
  ctx.restore();
}

// Render the cover at export size and return the canvas.
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), state, w, h);
  return canvas;
}
