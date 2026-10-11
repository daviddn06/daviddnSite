/* The fallback screen, for browsers without WebGL 2. The field the
   site had before the CRT: colour in 12px cells drifting slowly, the
   logo drawn in cells, the article revealed row band by row band. To
   sit with the CRT it is drawn soft (the cells upscaled with smoothing,
   like a low resolution picture) under fine scanlines instead of grid
   lines. Same timings, same behaviour; see crt.ts for the main one. */
import { ramp, fromLab } from './palette';
import { markImage } from './marks';
import type { Wants } from './crt';

const CELL = 12;
const SUB = 1;
const BLEND = 900;
const REVEAL = 900;

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

  return markImage(slug).then((mi) => {
      if (!mi) return null;
      const pc = mi.img, bx0 = mi.x, by0 = mi.y, bx1 = mi.x + mi.w - 1, by1 = mi.y + mi.h - 1;
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
      return m;
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

export function startCells(canvas0: HTMLCanvasElement, w: Wants): () => void {
  const want = w.palette, wantMark = w.mark, wantCut = w.cut;
  /* a canvas that already tried WebGL cannot give a 2D context, so it
     is swapped for a fresh one in the same place */
  let canvas = canvas0;
  let got = canvas.getContext('2d');
  if (!got) {
    canvas = document.createElement('canvas');
    canvas0.replaceWith(canvas);
    got = canvas.getContext('2d');
  }
  if (!got) return () => {};
  const ctx = got;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const light = matchMedia('(prefers-color-scheme: light)').matches;
  const main = canvas.parentElement!.parentElement!;

  const off = document.createElement('canvas');
  const octx = off.getContext('2d')!;
  let cols = 0, rows = 0, img: ImageData | null = null, dpr = 1;
  let lines: CanvasPattern | null = null;
  /* scanlines, one dark line every few pixels, painted only over lit cells */
  const makeLines = () => {
    const tile = document.createElement('canvas');
    const n = Math.max(3, Math.round(3 * dpr));
    tile.width = 1; tile.height = n;
    const tx = tile.getContext('2d')!;
    lineColor = 'rgba(0,0,0,0.28)';
    tx.fillStyle = lineColor;
    tx.fillRect(0, 0, 1, Math.max(1, Math.round(dpr)));
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
    /* window sized and anchored to the right edge of the screen */
    canvas.style.left = `${main.clientWidth - innerWidth}px`;
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
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            const mx = x * SUB + sx - ox, my = y * SUB + sy - oy;
            const cov = mx >= 0 && my >= 0 && mx < lw && my < lh ? mask!.data[my * lw + mx] : 0;
            let rr = r, gg = g, bb = b;
            if (cov > 0) {
              /* lights up from the centre outward */
              const d = Math.hypot((mx + 0.5 - hw) / hw, (my + 0.5 - hh) / hh) / 1.42;
              const L = cov * Math.min(1, Math.max(0, lit * 1.7 - d * 0.7));
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
          }
    }
    octx.putImageData(img!, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    if (lines) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = lines;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
}
