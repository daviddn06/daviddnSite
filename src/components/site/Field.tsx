/* The grid. A calm field of colour in 20px cells that drifts slowly,
   like the reference (shreygups.com). Hovering or opening a project
   blends the whole field into that project's colours over a moment;
   asking for another colour mid blend simply blends on from wherever
   the field is, so it never snaps.

   With a project open, the visible part of the field holds that
   project's logo, drawn in cells and centred, with soft edges that pass
   through the brand's bright tone and a little warmth bleeding into the
   field around it. It lights up from its centre
   outward and fades out the same way before the next one comes in.

   Every cell is one solid colour, written one pixel per cell into a
   small offscreen canvas and drawn scaled up with smoothing off. The
   field is sized to the window and anchored to the right edge, so the
   cells never move. The article sits underneath the field: opening it,
   the field pulls back cell by cell with a ragged edge that lands
   straight, closing it the field covers it again, and switching
   projects covers then reveals. Grid lines are painted only over lit
   cells. With reduced
   motion the field holds still and colour changes are instant. */
import { useEffect, useRef } from 'react';

export const CELL = 12;
/* pixels per cell each way in the offscreen image (kept at 1: every cell the same size) */
const SUB = 1;
/* how long a colour blend takes */
const BLEND = 900;

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/* OKLab, with a lookup table for the sRGB encode so the per cell cost stays low */
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const ENC = new Uint8ClampedArray(4097);
for (let i = 0; i <= 4096; i++) {
  const c = i / 4096;
  ENC[i] = 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
}
const enc = (c: number) => ENC[c <= 0 ? 0 : c >= 1 ? 4096 : (c * 4096) | 0];
const toLab = ([r8, g8, b8]: RGB): [number, number, number] => {
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
const fromLab = (L: number, A: number, B: number, out: Float32Array | Uint8ClampedArray, o: number) => {
  let l = L + 0.3963377774 * A + 0.2158037573 * B;
  let m = L - 0.1055613458 * A - 0.0638541728 * B;
  let s = L - 0.0894841775 * A - 1.291485548 * B;
  l = l * l * l; m = m * m * m; s = s * s * s;
  out[o] = enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  out[o + 1] = enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  out[o + 2] = enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
};

/* The resting palette, a sweep of blues the field moves through, from
   deep indigo to a pale sky. */
export const DEFAULT_PALETTE = ['#1f3a8a', '#2f63c9', '#3f8fd6', '#7cbbe0'];
export const DEFAULT_PALETTE_LIGHT = ['#5b82d4', '#79a2e4', '#98c0ec', '#c2dcf2'];

/* A brand's palette: neighbouring hues around its colour at mid tones,
   so every brand reads as a soft field rather than a hard ramp. Near
   black brands get a warm grey. */
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
  const up = light ? 0.14 : 0;
  if (l < 0.08 || s < 0.08) {
    const g = (x: number) => `hsl(30 6% ${Math.round((x + up) * 100)}%)`;
    return [g(0.2), g(0.32), g(0.45), g(0.58)];
  }
  const sat = Math.min(0.5, Math.max(0.3, s * 0.6));
  const hsl = (dh: number, ll: number, ss = sat) =>
    `hsl(${(((h + dh) % 360) + 360) % 360} ${Math.round(ss * 100)}% ${Math.round((ll + up) * 100)}%)`;
  return [hsl(-22, 0.3), hsl(0, 0.42), hsl(14, 0.52, sat * 0.85), hsl(30, 0.62, sat * 0.6)];
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
const toRGB = (c: string): RGB => {
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
const ramp = (palette: string[]) => {
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


/* a smooth, slowly changing value in 0..1 for a cell, from a few
   folded waves; cheap and free of seams */
const wave = (x: number, y: number, t: number) => {
  const a = Math.sin(x * 0.9 + t * 0.31 + Math.sin(y * 0.7 - t * 0.23) * 1.3);
  const b = Math.sin(y * 0.8 - t * 0.27 + Math.sin(x * 0.6 + t * 0.19) * 1.4);
  const c = Math.sin((x + y) * 0.45 + t * 0.15);
  return (a + b + c * 0.6) / 5.2 + 0.5;
};

/* A logo as a grid of lit cells, from the hidden SVG on the
   page. Drawn large, then cleaned up so the detail that makes it
   recognisable survives at grid size: a mostly solid mark (ShoSoft's
   disc) has its gaps widened so they show, a mostly open mark gets a
   little extra weight so thin strokes hold. Edges stay soft. */
/* coverage per cell (0 to 1, soft at the edges) and a blurred copy,
   padded by GLOW cells each side, for the warmth around the mark */
type Mask = { w: number; h: number; data: Float32Array; glow: Float32Array };
const GLOW = 4;
/* Marks that are already drawn on a grid get one of their columns per
   cell, so they line up with the field instead of being resampled.
   Reve is 17 bars on an 11 unit pitch (6 wide, 5 apart): the art is
   182 units wide, a whole pitch would be 187. */
const PITCH: Record<string, { cols: number; extra: number }> = {
  reve: { cols: 17, extra: 5 / 182 },
};
const masks = new Map<string, Mask>();
/* fits the mark's own shape inside W by H cells, keeping its proportions */
function buildMask(slug: string, W: number, H: number): Promise<Mask | null> {
  const key = `${slug}|${W}x${H}`;
  const hit = masks.get(key);
  if (hit) return Promise.resolve(hit);
  const svg = document.querySelector<SVGElement>(`.marks [data-mark="${slug}"] svg`);
  if (!svg) return Promise.resolve(null);
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '512');
  clone.setAttribute('height', '512');
  clone.setAttribute('style', 'color:#fff;fill:#fff');
  clone.querySelectorAll('*').forEach((n) => {
    const el = n as SVGElement;
    if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#fff');
    if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none') el.setAttribute('stroke', '#fff');
  });
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      /* where the art actually sits inside its viewBox */
      const P = 512;
      const pc = document.createElement('canvas');
      pc.width = pc.height = P;
      const px = pc.getContext('2d', { willReadFrequently: true })!;
      px.drawImage(im, 0, 0, P, P);
      const pd = px.getImageData(0, 0, P, P).data;
      let bx0 = P, bx1 = -1, by0 = P, by1 = -1;
      for (let i = 0; i < P * P; i++) if (pd[i * 4 + 3] > 40) {
        const xx = i % P, yy = (i / P) | 0;
        if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy;
      }
      if (bx1 < 0) { resolve(null); return; }
      const hint = PITCH[slug];
      const bw = (bx1 - bx0 + 1) * (hint ? 1 + hint.extra : 1), bh = by1 - by0 + 1;
      const sc = hint ? hint.cols / bw : Math.min(W / bw, H / bh);
      const mw = Math.max(1, Math.round(bw * sc)), mh = Math.max(1, Math.round(bh * sc));
      /* drawn at K pixels per cell, cleaned up, then counted per cell */
      const K = 8, RW = mw * K, RH = mh * K;
      const c = document.createElement('canvas');
      c.width = RW; c.height = RH;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(pc, bx0, by0, bw, bh, 0, 0, RW, RH);
      const d = x.getImageData(0, 0, RW, RH).data;
      const N = RW * RH;
      const fg = new Uint8Array(N);
      let on = 0;
      for (let i = 0; i < N; i++) if (d[i * 4 + 3] > 127) { fg[i] = 1; on++; }
      /* a square max filter, radius r, over a bitmap */
      const grow = (src: Uint8Array, r: number) => {
        const a = new Uint8Array(N), b = new Uint8Array(N);
        for (let y = 0; y < RH; y++) for (let xx = 0; xx < RW; xx++) {
          let v = 0;
          for (let k = -r; k <= r && !v; k++) { const q = xx + k; if (q >= 0 && q < RW) v = src[y * RW + q]; }
          a[y * RW + xx] = v;
        }
        for (let y = 0; y < RH; y++) for (let xx = 0; xx < RW; xx++) {
          let v = 0;
          for (let k = -r; k <= r && !v; k++) { const q = y + k; if (q >= 0 && q < RH) v = a[q * RW + xx]; }
          b[y * RW + xx] = v;
        }
        return b;
      };
      const r = Math.round(K * 0.4);
      if (on / N > 0.5) {
        /* mostly solid: widen the gaps by growing the background */
        const bg = new Uint8Array(N);
        for (let i = 0; i < N; i++) bg[i] = fg[i] ? 0 : 1;
        const wide = grow(bg, r);
        for (let i = 0; i < N; i++) fg[i] = wide[i] ? 0 : 1;
      }
      /* open marks get a little more weight so thin strokes hold */
      const boost = on / N > 0.5 ? 1.1 : 1.85;
      const out = new Float32Array(mw * mh);
      for (let cy = 0; cy < mh; cy++) for (let cx = 0; cx < mw; cx++) {
        let n = 0;
        for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) n += fg[(cy * K + yy) * RW + cx * K + xx];
        out[cy * mw + cx] = Math.min(1, (n / (K * K)) * boost);
      }
      /* the glow: the coverage, padded, blurred twice with a small box */
      const gw = mw + GLOW * 2, gh = mh + GLOW * 2;
      let g = new Float32Array(gw * gh);
      for (let cy = 0; cy < mh; cy++) for (let cx = 0; cx < mw; cx++) g[(cy + GLOW) * gw + cx + GLOW] = out[cy * mw + cx];
      for (let pass = 0; pass < 2; pass++) {
        const t = new Float32Array(gw * gh), u = new Float32Array(gw * gh);
        for (let y = 0; y < gh; y++) for (let xx = 0; xx < gw; xx++) {
          let sum = 0, n = 0;
          for (let k = -2; k <= 2; k++) { const q = xx + k; if (q >= 0 && q < gw) { sum += g[y * gw + q]; n++; } }
          t[y * gw + xx] = sum / n;
        }
        for (let y = 0; y < gh; y++) for (let xx = 0; xx < gw; xx++) {
          let sum = 0, n = 0;
          for (let k = -2; k <= 2; k++) { const q = y + k; if (q >= 0 && q < gh) { sum += t[q * gw + xx]; n++; } }
          u[y * gw + xx] = sum / n;
        }
        g = u;
      }
      const m = { w: mw, h: mh, data: out, glow: g };
      masks.set(key, m);
      resolve(m);
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

/* How long one logo takes to flow into the next. */
const MORPH = 1100;

/* a mask placed in the middle of a w by h frame, glow padded by GLOW */
function embed(m: Mask, w: number, h: number): Mask {
  const data = new Float32Array(w * h);
  const gw = w + GLOW * 2, gh = h + GLOW * 2, glow = new Float32Array(gw * gh);
  const dx = (w - m.w) >> 1, dy = (h - m.h) >> 1, mgw = m.w + GLOW * 2;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) data[(y + dy) * w + x + dx] = m.data[y * m.w + x];
  for (let y = 0; y < m.h + GLOW * 2; y++) for (let x = 0; x < mgw; x++) glow[(y + dy) * gw + x + dx] = m.glow[y * mgw + x];
  return { w, h, data, glow };
}

/* signed distance to the mark's outline in cells, positive inside,
   refined inside each cell by its coverage */
function sdf(d: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const ins: number[] = [], outs: number[] = [];
  for (let i = 0; i < d.length; i++) (d[i] >= 0.5 ? ins : outs).push(i);
  for (let i = 0; i < d.length; i++) {
    const inside = d[i] >= 0.5, list = inside ? outs : ins;
    const x = i % w, y = (i / w) | 0;
    let best = (w + h) * (w + h);
    for (const j of list) {
      const ex = (j % w) - x, ey = ((j / w) | 0) - y, q = ex * ex + ey * ey;
      if (q < best) best = q;
    }
    const dist = Math.sqrt(best) - 0.5;
    out[i] = inside ? dist + (d[i] - 0.5) : -(dist + (0.5 - d[i]));
  }
  return out;
}

type Props = {
  palette: string[];
  /* the open project, whose logo the field holds */
  mark: string | null;
  /* how much of the field's left side to clear for the article, in px */
  cut: number;
};

/* how long the field takes to pull back from (or cover) the article */
export const REVEAL = 900;

export function Field({ palette, mark, cut }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const want = useRef(palette);
  want.current = palette;
  const wantMark = useRef(mark);
  wantMark.current = mark;
  const wantCut = useRef(cut);
  wantCut.current = cut;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const light = matchMedia('(prefers-color-scheme: light)').matches;
    const main = canvas.parentElement!.parentElement!;

    const off = document.createElement('canvas');
    const octx = off.getContext('2d')!;
    let cols = 0, rows = 0, img: ImageData | null = null, dpr = 1;
    let lines: CanvasPattern | null = null;
    /* the grid lines, one tile per cell, painted only over lit cells */
    const makeLines = () => {
      const tile = document.createElement('canvas');
      const n = Math.round(CELL * dpr);
      tile.width = tile.height = n;
      const tx = tile.getContext('2d')!;
      lineColor = getComputedStyle(document.documentElement).getPropertyValue('--gridline').trim() || 'rgba(6,10,20,0.62)';
      tx.fillStyle = lineColor;
      const w = Math.max(1, Math.round(dpr));
      tx.fillRect(0, 0, n, w);
      tx.fillRect(0, 0, w, n);
      lines = ctx.createPattern(tile, 'repeat');
    };
    let lineColor = '';
    let jitter = new Float32Array(0);
    let rowEdge = new Float32Array(0), rowFrom = new Float32Array(0), rowLag = new Float32Array(0);
    const size = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      cols = Math.ceil(innerWidth / CELL);
      rows = Math.ceil(innerHeight / CELL);
      /* SUB pixels per cell each way, so the logo can be drawn in smaller cells */
      off.width = cols * SUB;
      off.height = rows * SUB;
      img = octx.createImageData(cols * SUB, rows * SUB);
      canvas.width = Math.round(cols * CELL * dpr);
      canvas.height = Math.round(rows * CELL * dpr);
      canvas.style.width = `${cols * CELL}px`;
      canvas.style.height = `${rows * CELL}px`;
      makeLines();
      rowEdge = new Float32Array(rows).fill(wantCut.current);
      rowFrom = new Float32Array(rowEdge);
      rowLag = new Float32Array(rows);
      jitter = new Float32Array(cols * rows);
      for (let i = 0; i < jitter.length; i++) jitter[i] = Math.random();
    };
    size();

    /* the palette as a 256 step OKLab ramp: where a blend started, where
       it is going, and what is on screen now */
    let key = want.current.join();
    let from = ramp(want.current), to = from, now = from.slice();
    let since = -1e9;
    const rgb = new Uint8ClampedArray(768);

    /* The edge where the field gives way to the article, one per row.
       Rows move in bands of a few rows, each band trailing the front by
       its own few cells, so the edge travels as a soft staircase and
       lands straight. */
    let cutTarget = wantCut.current, cutSince = -1e9;
    const LAG = Math.round(80 / CELL);
    const moveCut = (ms: number) => {
      cutTarget = wantCut.current;
      cutSince = still ? -1e9 : ms;
      rowFrom = new Float32Array(rowEdge);
      let r = 0, prev = Math.random();
      while (r < rows) {
        const run = 2 + Math.floor(Math.random() * 4);
        /* neighbouring bands stay close, so the steps are one or two cells */
        const v = Math.min(1, Math.max(0, prev + (Math.random() - 0.5) * 0.7));
        prev = v;
        for (let k = 0; k < run && r < rows; k++, r++) rowLag[r] = v;
      }
    };

    /* the pointer lifts the cells near it a little, easing in and out */
    let px = -1e4, py = -1e4, lift = 0, near = false;
    const onMove = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      px = (e.clientX - box.left) / CELL;
      py = (e.clientY - box.top) / CELL;
      near = e.clientX >= box.left && e.clientY >= box.top;
    };
    const onLeave = () => { near = false; };
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    /* the logo: which one is showing, its size in cells, its coverage,
       and how far it has lit up (0 to 1) */
    /* The logo is always near white. On dark its edges warm through the
       bright end of the palette on the way. On paper they fade straight to
       white (a tone in between would flicker pale and dark), and the
       field deepens around the mark so the white has something to sit on. */
    const HOT = 230 * 3;
    const INK = light ? [255, 255, 255] : [252, 246, 238];
    const sm = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    /* The logo. `shape` is what is on screen when no morph runs. Switching
       projects never fades it: the new mark is placed in a shared frame
       and the two outlines are blended as distance fields, so one shape
       flows into the other. It sits in the strip the open article leaves
       (`lastCut`), and stays there while the article is covered and
       revealed again. */
    let shownMark: string | null = null, M = '', shape: Mask | null = null, lit = 0, loading = false;
    let morph: { a: Mask; b: Mask; sa: Float32Array; sb: Float32Array; since: number } | null = null;
    let lastCut = wantCut.current;

    /* The load in. The field grows out of the middle as one shape, its
       edge a soft, slowly wavy outline stepped in whole cells; each cell
       flashes a little bright as the edge passes and settles. */
    const LOAD = 1600, POP = 220;
    const ph1 = Math.random() * 6.28, ph2 = Math.random() * 6.28;
    let born = still ? -1e9 : -1;

    /* the in-between shape: the outlines blended as distance fields (soft,
       about a cell wide), eased in from and out to the exact coverage so
       neither end jumps; the glow simply crossfades */
    const blend = (m: NonNullable<typeof morph>, e: number): Mask => {
      const { a, b, sa, sb } = m, n = a.data.length;
      const data = new Float32Array(n), w = Math.sin(Math.PI * e);
      for (let i = 0; i < n; i++) {
        const d = sa[i] + (sb[i] - sa[i]) * e;
        const soft = Math.min(1, Math.max(0, d + 0.5));
        const lin = a.data[i] + (b.data[i] - a.data[i]) * e;
        data[i] = lin + (soft - lin) * w;
      }
      const glow = new Float32Array(a.glow.length);
      for (let i = 0; i < glow.length; i++) glow[i] = a.glow[i] + (b.glow[i] - a.glow[i]) * e;
      return { w: a.w, h: a.h, data, glow };
    };
    let drawn: Mask | null = null;
    const view = () => drawn;

    let raf = 0, last = performance.now(), t = Math.random() * 100;
    const frame = (ms: number) => {
      raf = still ? 0 : requestAnimationFrame(frame);
      const dt = Math.min(64, ms - last);
      last = ms;
      if (!still) t += dt * 0.001;

      const k = want.current.join();
      if (k !== key) {
        key = k;
        from = now.slice();
        to = ramp(want.current);
        since = still ? -1e9 : ms;
      }
      const u = Math.min(1, (ms - since) / BLEND);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      for (let i = 0; i < 768; i++) now[i] = from[i] + (to[i] - from[i]) * e;
      for (let j = 0; j < 256; j++) fromLab(now[j * 3], now[j * 3 + 1], now[j * 3 + 2], rgb, j * 3);

      lift += ((near ? 1 : 0) - lift) * Math.min(1, dt / 260);

      /* the edge */
      if (wantCut.current !== cutTarget) {
        moveCut(ms);
        /* while the field is still loading in (the article's width arrives
           a moment after the first frame), the edge goes straight to its
           place, so the growing field never spills over the article */
        if (born < 0 || ms - born < LOAD) { cutSince = -1e9; rowEdge.fill(cutTarget); rowFrom.fill(cutTarget); }
      }
      const cu = Math.min(1, (ms - cutSince) / REVEAL);
      const ce = cu < 0.5 ? 4 * cu * cu * cu : 1 - Math.pow(-2 * cu + 2, 3) / 2;
      const bump = Math.sin(Math.PI * cu);
      for (let r = 0; r < rows; r++) {
        const a = rowFrom[r], dir = Math.sign(cutTarget - a);
        let edge = a + (cutTarget - a) * ce - dir * rowLag[r] * LAG * CELL * bump;
        edge = dir > 0 ? Math.max(a, Math.min(cutTarget, edge)) : Math.min(a, Math.max(cutTarget, edge));
        rowEdge[r] = cu >= 1 ? cutTarget : edge;
      }

      /* the part of the field the logo lives in: the strip beside the open article */
      const mw = main.clientWidth, mh = main.clientHeight;
      const shift = (mw - innerWidth) / CELL; /* main's left edge in canvas cells is -shift */
      const target = wantMark.current;
      if (target && cutTarget > 0) lastCut = cutTarget;
      const vw = (mw - lastCut) / CELL, vh = mh / CELL;
      /* the room the logo may take, in cells */
      const fitW = Math.max(10, Math.min(24, Math.floor(vw * 0.8)));
      const fitH = Math.max(10, Math.min(20, Math.floor(vh * 0.4)));
      const fit = `${fitW}x${fitH}`;
      if (!target) {
        /* closing: the logo fades out where it is */
        lit = still ? 0 : Math.max(0, lit - dt / 380);
        if (lit === 0) { shownMark = null; M = ''; shape = null; morph = null; }
      } else if (target !== shownMark || fit !== M) {
        if (!loading) {
          loading = true;
          const slug = target, f = fit;
          buildMask(slug, fitW, fitH).then((got) => {
            loading = false;
            if (!got || wantMark.current !== slug) return;
            /* what is on screen right now, mid morph or not */
            const from = view();
            if (from && lit > 0 && !still) {
              const W = Math.max(from.w, got.w), H = Math.max(from.h, got.h);
              const A = embed(from, W, H), B = embed(got, W, H);
              morph = { a: A, b: B, sa: sdf(A.data, W, H), sb: sdf(B.data, W, H), since: performance.now() };
              shape = B;
            } else {
              morph = null;
              shape = got;
            }
            shownMark = slug; M = f;
            redraw();
          });
        }
      }
      if (target && shape && !morph && (lit > 0 || cu >= 1)) lit = still ? 1 : Math.min(1, lit + dt / 900);

      /* the shape to draw this frame */
      let cur: Mask | null = shape;
      if (morph) {
        const p = Math.min(1, (ms - morph.since) / MORPH);
        if (p >= 1) morph = null;
        else cur = blend(morph, p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      }
      drawn = cur;
      /* the logo's top left, on a whole cell */
      const lw = cur?.w ?? 0, lh = cur?.h ?? 0;
      const mask = cur;
      const ox = Math.round(((lastCut + mw) / 2 / CELL - shift) - lw / SUB / 2) * SUB;
      const oy = Math.round(vh / 2 - lh / SUB / 2) * SUB;
      const hw = lw / 2, hh = lh / 2;
      const showLogo = !!mask && lit > 0;
      const fine: number[] = [];

      if (born < 0) born = ms;
      const age = ms - born;
      const arriving = age < LOAD + POP + 400;
      const lcx = (cutTarget + mw) / 2 / CELL - shift, lcy = vh / 2;
      const lr = Math.hypot(vw / 2, vh / 2) || 1;
      const data = img!.data;
      const W2 = cols * SUB;
      /* wave scale per cell, so blobs stay the same size whatever the cell size */
      const sc = 0.2 * CELL / 20;
      for (let y = 0; y < rows; y++) {
        /* cells whose centre sits left of this row's edge are cleared */
        const clearTo = rowEdge[y] / CELL - shift - 0.5;
        for (let x = 0; x < cols; x++) {
          const o = (y * SUB * W2 + x * SUB) * 4;
          if (x < clearTo) {
            for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) data[o + (sy * W2 + sx) * 4 + 3] = 0;
            continue;
          }
          /* the load in: this cell's moment, then a quick pop */
          let A = 255, pop = 0;
          if (arriving) {
            const dx = x - lcx, dy = y - lcy, an = Math.atan2(dy, dx);
            /* a wavy outline: a few slow lobes, so it grows as a shape, not a circle */
            const lobe = 1 + 0.12 * Math.sin(an * 3 + ph1 + age * 0.0012) + 0.07 * Math.sin(an * 5 - ph2);
            const r = Math.min(1, Math.hypot(dx, dy) / lr / lobe);
            /* eased so it starts quick from the middle and slows as it fills */
            const at = (1 - Math.sqrt(1 - r * r * 0.999)) * 0.15 * LOAD + r * 0.85 * LOAD + jitter[y * cols + x] * 40;
            const k = (age - at) / POP;
            if (k <= 0) {
              for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) data[o + (sy * W2 + sx) * 4 + 3] = 0;
              continue;
            }
            if (k < 1) A = (k * 255) | 0;
            pop = Math.max(0, 1 - (age - at) / (POP + 400));
          }
          /* the whole field drifts slowly sideways and its colours roll
             through the palette over about a minute */
          let v = 0.5 + (wave(x * sc + t * 0.18, y * sc - t * 0.07, t) - 0.5) * 1.5 + 0.14 * Math.sin(t * 0.11) + 0.28 * pop * pop;
          /* a second, slower field shades the first so it never looks flat */
          const shade = 0.8 + 0.22 * wave(y * sc * 0.7 + 40, x * sc * 0.7 - 20, t * 0.7);
          if (lift > 0.01) {
            const dx = x - px, dy = y - py;
            v += 0.16 * lift * Math.exp(-(dx * dx + dy * dy) / (40 * (20 / CELL) ** 2));
          }
          /* warmth bleeds into the field around the logo */
          if (showLogo) {
            const gx = x - ox + GLOW, gy = y - oy + GLOW;
            if (gx >= 0 && gy >= 0 && gx < lw + GLOW * 2 && gy < lh + GLOW * 2) v += (light ? -0.5 : 0.22) * lit * mask!.glow[gy * (lw + GLOW * 2) + gx];
          }
          const j = Math.max(0, Math.min(255, (v * 255) | 0)) * 3;
          let r = rgb[j] * shade, g = rgb[j + 1] * shade, b = rgb[j + 2] * shade;
          const inLogo = showLogo && x * SUB + SUB > ox && x * SUB < ox + lw && y * SUB + SUB > oy && y * SUB < oy + lh;
          if (!inLogo) {
            for (let sy = 0; sy < SUB; sy++) {
              for (let sx = 0; sx < SUB; sx++) {
                const q = o + (sy * W2 + sx) * 4;
                data[q] = r; data[q + 1] = g; data[q + 2] = b; data[q + 3] = A;
              }
            }
            continue;
          }
          /* inside the logo each cell splits into smaller cells */
          let any = false;
          for (let sy = 0; sy < SUB; sy++) {
            for (let sx = 0; sx < SUB; sx++) {
              const mx = x * SUB + sx - ox, my = y * SUB + sy - oy;
              const cov = mx >= 0 && my >= 0 && mx < lw && my < lh ? mask!.data[my * lw + mx] : 0;
              let rr = r, gg = g, bb = b;
              if (cov > 0) {
                /* lights up from the centre outward */
                const d = Math.hypot((mx + 0.5 - hw) / hw, (my + 0.5 - hh) / hh) / 1.42;
                const L = cov * Math.min(1, Math.max(0, lit * 1.7 - d * 0.7));
                if (L > 0.04) any = true;
                /* first the brand's bright tone, then white (deep on paper),
                   so soft edges and the lighting up pass through colour */
                const warm = light ? 0 : sm(L / 0.55);
                rr += (rgb[HOT] - rr) * warm; gg += (rgb[HOT + 1] - gg) * warm; bb += (rgb[HOT + 2] - bb) * warm;
                const white = light ? sm(L) : sm((L - 0.45) / 0.55) * 0.92;
                rr += (INK[0] - rr) * white; gg += (INK[1] - gg) * white; bb += (INK[2] - bb) * white;
              }
              const q = o + (sy * W2 + sx) * 4;
              data[q] = rr; data[q + 1] = gg; data[q + 2] = bb; data[q + 3] = A;
            }
          }
          if (any) fine.push(x, y);
        }
      }
      octx.putImageData(img!, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      if (lines) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = lines;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        /* the logo's cells get a finer grid */
        if (fine.length) {
          const n = CELL * dpr, w = Math.max(1, Math.round(dpr));
          ctx.fillStyle = lineColor;
          ctx.globalAlpha = 0.55;
          for (let i = 0; i < fine.length; i += 2) {
            const cx = Math.round(fine[i] * n), cy = Math.round(fine[i + 1] * n);
            for (let k = 1; k < SUB; k++) {
              const d = Math.round((n * k) / SUB);
              ctx.fillRect(cx + d, cy, w, Math.round(n));
              ctx.fillRect(cx, cy + d, Math.round(n), w);
            }
          }
          ctx.globalAlpha = 1;
        }
      }
    };
    raf = requestAnimationFrame(frame);

    /* reduced motion draws on demand only */
    const redraw = () => { if (still) requestAnimationFrame(frame); };
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { size(); redraw(); }, 120);
    };
    addEventListener('resize', onResize);
    const poll = still ? window.setInterval(() => {
      if (want.current.join() !== key || wantCut.current !== cutTarget || wantMark.current !== shownMark) redraw();
    }, 100) : 0;

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      clearInterval(poll);
      removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="field" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
