/* Colour for the screen. OKLab blending, the resting palettes, a
   brand's palette and its accent, and a palette as a 256 step ramp.
   Shared by the CRT (crt.ts) and the plain canvas it falls back to
   (screen2d.ts). */

export type RGB = [number, number, number];
export const hex = (h: string): RGB => {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/* OKLab, with a lookup table for the sRGB encode so converting a whole ramp stays cheap */
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const ENC = new Uint8ClampedArray(4097);
for (let i = 0; i <= 4096; i++) {
  const c = i / 4096;
  ENC[i] = 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
}
const enc = (c: number) => ENC[c <= 0 ? 0 : c >= 1 ? 4096 : (c * 4096) | 0];
export const toLab = ([r8, g8, b8]: RGB): [number, number, number] => {
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
/* writes sRGB 0..255 into out[o..o+2] */
export const fromLab = (L: number, A: number, B: number, out: Float32Array | Uint8ClampedArray, o: number) => {
  let l = L + 0.3963377774 * A + 0.2158037573 * B;
  let m = L - 0.1055613458 * A - 0.0638541728 * B;
  let s = L - 0.0894841775 * A - 1.291485548 * B;
  l = l * l * l; m = m * m * m; s = s * s * s;
  out[o] = enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  out[o + 1] = enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  out[o + 2] = enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
};

/* The resting palette, the blues the field moves through. Calmed
   2026-10-11 (David): mostly deep navy, its highlights about half as
   bright as before and closer together, so nothing bright ever sits
   under text. A project's colours (hover, open) keep their full range. */
export const DEFAULT_PALETTE = ['#0b1530', '#11214a', '#19306a', '#264486'];
export const DEFAULT_PALETTE_LIGHT = ['#9fb3da', '#aabde0', '#b6c7e6', '#c3d2ec'];

/* A brand's palette: neighbouring hues around its colour, so every brand
   reads as a soft field rather than a hard ramp. */
export function brandPalette(color: string, light = false): string[] {
  const [r, g, b] = hex(color).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  /* Calm like the resting picture (2026-10-11): on dark the brand is a
     deep tint, about as dark as the resting navy, its brightest tone a
     muted glow; on paper a pale wash. Each project still reads as its own
     channel by hue. Near black brands get a warm grey. */
  const L = light ? [0.66, 0.75, 0.8, 0.85] : [0.08, 0.13, 0.19, 0.27];
  if (l < 0.08 || s < 0.08) {
    const g = (x: number) => `hsl(30 6% ${Math.round(x * 100)}%)`;
    return L.map(g);
  }
  const sat = light ? Math.min(0.42, Math.max(0.24, s * 0.5)) : Math.min(0.62, Math.max(0.36, s * 0.7));
  const hsl = (dh: number, ll: number, ss: number) =>
    `hsl(${Math.round((((h + dh) % 360) + 360) % 360)} ${Math.round(ss * 100)}% ${Math.round(ll * 100)}%)`;
  return [hsl(-14, L[0], sat), hsl(0, L[1], sat), hsl(8, L[2], sat * 0.85), hsl(18, L[3], sat * 0.7)];
}

/* A brand's accent for text: its hue, kept readable on the page. Light
   on dark, deep on paper; near black brands get a quiet grey. */
export function brandAccent(color: string, light = false): string {
  const [r, g, b] = hex(color).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.08 || s < 0.08) return light ? '#3b3b3b' : '#d4d4d4';
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = ((h * 60) % 360 + 360) % 360;
  const sat = Math.round(Math.min(0.85, Math.max(0.5, s)) * 100);
  return `hsl(${Math.round(h)} ${sat}% ${light ? 42 : 76}%)`;
}

/* any CSS colour to RGB, through a 1x1 canvas */
let probe: CanvasRenderingContext2D | null = null;
export const toRGB = (c: string): RGB => {
  if (c.startsWith('#')) return hex(c);
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!probe) return [128, 128, 128];
  probe.fillStyle = '#000';
  probe.fillStyle = c;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
};


/* a palette of four CSS colours to a 256 step ramp in OKLab */
export const ramp = (palette: string[]) => {
  const labs = palette.map((c) => toLab(toRGB(c)));
  const out = new Float32Array(768);
  for (let j = 0; j < 256; j++) {
    const f = (j / 255) * 3;
    const k = f >= 3 ? 2 : Math.floor(f);
    const u = f - k;
    const a = labs[k], b = labs[k + 1];
    out[j * 3] = a[0] + (b[0] - a[0]) * u;
    out[j * 3 + 1] = a[1] + (b[1] - a[1]) * u;
    out[j * 3 + 2] = a[2] + (b[2] - a[2]) * u;
  }
  return out;
};

/* The palette on screen. A new palette blends in over BLEND ms from
   wherever the colours are, so asking again mid blend never snaps.
   `step` returns the current ramp as sRGB, 256 steps of three bytes. */
export const BLEND = 500;
export function blender(initial: string[]) {
  let key = initial.join();
  let from = ramp(initial), to = from;
  const now = from.slice();
  let since = -1e9;
  const rgb = new Uint8ClampedArray(768);
  return (palette: string[], ms: number, still: boolean) => {
    const k = palette.join();
    if (k !== key) {
      key = k;
      from = now.slice();
      to = ramp(palette);
      since = still ? -1e9 : ms;
    }
    const u = Math.min(1, (ms - since) / BLEND);
    /* eased out like the article's crossfade, so the colour answers at once */
    const e = 1 - Math.pow(1 - u, 3);
    for (let i = 0; i < 768; i++) now[i] = from[i] + (to[i] - from[i]) * e;
    for (let j = 0; j < 256; j++) fromLab(now[j * 3], now[j * 3 + 1], now[j * 3 + 2], rgb, j * 3);
    return rgb;
  };
}
