// Vice City colour grades: a gradient map keyed on luminance, blended back over
// the photo so the picture stays recognisable, plus grain and a vignette.
// Pure pixel work, no network, no library.

// Gradient stops as [position 0..1, r, g, b]. Sunset runs deep purple shadows
// through magenta into orange-gold highlights; neon runs teal shadows into hot
// pink highlights.
const SUNSET_STOPS = [
  [0.0, 26, 8, 46],
  [0.22, 88, 22, 84],
  [0.45, 196, 43, 108],
  [0.68, 255, 110, 60],
  [0.85, 255, 178, 92],
  [1.0, 255, 232, 170],
];
const NEON_STOPS = [
  [0.0, 4, 24, 46],
  [0.25, 10, 90, 120],
  [0.5, 40, 190, 170],
  [0.72, 255, 46, 136],
  [0.88, 255, 120, 190],
  [1.0, 255, 220, 240],
];

function buildLookup(stops) {
  const table = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    table[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    table[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    table[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  return table;
}

const LOOKUPS = { sunset: buildLookup(SUNSET_STOPS), neon: buildLookup(NEON_STOPS) };

// Grade one panel's pixels in place. `strength` blends the gradient map over
// the original; `clean` only lifts contrast and saturation a touch.
export function gradePixels(imageData, mode, strength = 0.62) {
  const d = imageData.data;
  if (mode === 'clean') {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      d[i] = clamp(lum + (r - lum) * 1.12);
      d[i + 1] = clamp(lum + (g - lum) * 1.12);
      d[i + 2] = clamp(lum + (b - lum) * 1.12);
    }
    return;
  }
  const table = LOOKUPS[mode] ?? LOOKUPS.sunset;
  const mix = strength;
  const keep = 1 - mix;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const o = lum * 3;
    d[i] = Math.round(r * keep + table[o] * mix);
    d[i + 1] = Math.round(g * keep + table[o + 1] * mix);
    d[i + 2] = Math.round(b * keep + table[o + 2] * mix);
  }
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

// One shared noise tile, drawn with low alpha for film grain.
let noiseTile = null;
export function grainTile() {
  if (noiseTile) return noiseTile;
  const size = 160;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

// Darken the corners of a rectangle so the panels read like a poster.
export function vignette(ctx, x, y, w, h, strength = 0.42) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.max(w, h) * 0.72;
  const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  g.addColorStop(0, 'rgba(8,2,18,0)');
  g.addColorStop(1, `rgba(8,2,18,${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Warm sunset wash across the whole cover, laid over the panels.
export function sunsetWash(ctx, w, h, mode) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  if (mode === 'neon') {
    g.addColorStop(0, 'rgba(45,226,197,0.10)');
    g.addColorStop(0.55, 'rgba(255,46,136,0.08)');
    g.addColorStop(1, 'rgba(120,20,140,0.12)');
  } else if (mode === 'sunset') {
    g.addColorStop(0, 'rgba(255,46,136,0.10)');
    g.addColorStop(0.55, 'rgba(255,110,60,0.07)');
    g.addColorStop(1, 'rgba(255,178,92,0.10)');
  } else {
    return;
  }
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
