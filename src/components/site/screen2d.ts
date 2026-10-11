/* The screen without WebGL. A plain 2D canvas draws the same picture as
   crt.ts in a simpler way, so a browser without WebGL 2 still sees a
   CRT and not a flat page.

   The drifting colour field is worked out at a low resolution (one value
   per 8 CSS px) with the shader's own waves and palette, then scaled up
   smooth, which is how a soft analog picture looks anyway. Over it go
   scanlines at the picture's pitch, the open project's logo as white
   phosphor with a glow, and the corners falling into shadow. The whole
   raster is then bent onto the glass in thin strips, across and then
   down, with the same gentle barrel as the shader (warp.ts), and its
   corners are rounded.

   Behaviour follows the main screen: a short power on (a line opening
   out), palettes blending over 900ms, the pointer brightening the
   picture near it, text on the glass (`data-calm`) dimming what is
   behind it, the side left of `cut` blank for the article, its edge
   sweeping across as a line of light when a project opens or closes,
   and the logo in the strip that remains. Hidden
   tabs stop drawing; reduced motion draws only when something changes.

   The privacy and 404 pages use it too, as a calm picture behind their
   text (`quiet` skips the power on and fades the picture in instead). */
import { blender } from './palette';
import { markSdf, type Sdf } from './marks';
import { CURVE } from './warp';
import { WIPE, type Wants } from './crt';

const LOAD = 900;
const TEXEL = 8;
const RADIUS = 16;
const CALMS = 4;

const wave = (x: number, y: number, t: number) => {
  const a = Math.sin(x * 0.9 + t * 0.31 + Math.sin(y * 0.7 - t * 0.23) * 1.3);
  const b = Math.sin(y * 0.8 - t * 0.27 + Math.sin(x * 0.6 + t * 0.19) * 1.4);
  const c = Math.sin((x + y) * 0.45 + t * 0.15);
  return (a + b + c * 0.6) / 5.2 + 0.5;
};
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const sm = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
/* how much the picture quiets at (px, py) for one calm zone: an oval
   around the box with a very wide, soft falloff, the same as calmAt in
   crt.ts, so it never reads as a shape */
const calmOval = (px: number, py: number, x: number, y: number, w: number, h: number) => {
  const dx = (px - x - w / 2) / (w / 2 + 160), dy = (py - y - h / 2) / (h / 2 + 160);
  return 1 - sm(0.35, 1, Math.hypot(dx, dy));
};

export function startScreen2d(canvas0: HTMLCanvasElement, w: Wants, opts: { quiet?: boolean } = {}): () => void {
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
  const main = canvas.parentElement!.parentElement!;
  const tube = main.parentElement!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lightMq = matchMedia('(prefers-color-scheme: light)');

  /* the low resolution field, the flat raster, and a strip buffer */
  const low = document.createElement('canvas');
  const lctx = low.getContext('2d')!;
  const flat = document.createElement('canvas');
  const fctx = flat.getContext('2d')!;
  const mid = document.createElement('canvas');
  const mctx = mid.getContext('2d')!;
  let W = 0, H = 0, dpr = 1, pitch = 3, cols = 0, rows = 0, img: ImageData | null = null;
  let lines: CanvasPattern | null = null, linesFor = '';
  const size = () => {
    const nw = Math.max(1, main.clientWidth), nh = Math.max(1, main.clientHeight);
    const d = Math.min(2, devicePixelRatio || 1), most = Math.sqrt(4.6e6 / (nw * nh));
    const nd = d <= most ? d : d / Math.ceil(d / most);
    if (nw === W && nh === H && nd === dpr) return;
    W = nw; H = nh; dpr = nd;
    const pd = Math.max(3, Math.round(3 * dpr));
    pitch = pd / dpr;
    tube.style.setProperty('--scan', `${pitch}px`);
    cols = Math.ceil(W / TEXEL) + 1;
    rows = Math.ceil(H / TEXEL) + 1;
    low.width = cols; low.height = rows;
    img = lctx.createImageData(cols, rows);
    for (const c of [canvas, flat, mid]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    linesFor = '';
  };
  /* one dark line every scanline, in device pixels */
  const scanlines = (light: boolean) => {
    const key = `${pitch * dpr}${light}`;
    if (key === linesFor && lines) return lines;
    linesFor = key;
    const n = Math.round(pitch * dpr);
    const tile = document.createElement('canvas');
    tile.width = 1; tile.height = n;
    const tx = tile.getContext('2d')!;
    tx.fillStyle = light ? 'rgba(30,40,60,0.09)' : 'rgba(0,0,0,0.34)';
    tx.fillRect(0, n - Math.max(1, Math.round(n / 3)), 1, Math.max(1, Math.round(n / 3)));
    lines = ctx.createPattern(tile, 'repeat');
    return lines;
  };

  const palette = blender(w.palette.current ?? []);

  /* the pointer brightens the picture near it, easing in and out */
  let px = -1e4, py = -1e4, lift = 0, near = false;
  const onMove = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    px = e.clientX - b.left; py = e.clientY - b.top;
    near = px >= -40 && py >= -40 && px <= b.width + 40 && py <= b.height + 40;
  };
  const onLeave = () => { near = false; };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  /* text on the glass asks for calm behind it; each zone's strength and
     box are eased, as in crt.ts, so the quiet never pops or jumps */
  const calm = new Float32Array(CALMS * 5);
  const eased = new WeakMap<Element, { c: number; r: number[] }>();
  let calmN = 0;
  const readCalm = (dt: number) => {
    calmN = 0;
    const b = canvas.getBoundingClientRect();
    for (const el of tube.querySelectorAll<HTMLElement>('[data-calm]')) {
      if (calmN >= CALMS) break;
      const goal = parseFloat(el.dataset.calm || '0') || 0;
      const a = el.getBoundingClientRect();
      const box = [a.left - b.left, a.top - b.top, a.width, a.height];
      let z = eased.get(el);
      if (!z) { z = { c: 0, r: box }; eased.set(el, z); }
      const k = still ? 1 : 1 - Math.exp(-dt / 190);
      z.c += (goal - z.c) * k;
      if (a.width && a.height) for (let i = 0; i < 4; i++) z.r[i] += (box[i] - z.r[i]) * k;
      if (z.c < 0.002 || !z.r[2] || !z.r[3]) continue;
      calm.set([z.r[0], z.r[1], z.r[2], z.r[3], z.c], calmN * 5);
      calmN++;
    }
  };

  /* the logo, drawn once per mark from its distance field */
  let shownMark: string | null = null, fitKey = '', logo: HTMLCanvasElement | null = null, lit = 0, loading = false, lastCut = w.cut.current ?? 0;
  const paintLogo = (s: Sdf) => {
    const c = document.createElement('canvas');
    c.width = s.w; c.height = s.h;
    const x = c.getContext('2d')!;
    const im = x.createImageData(s.w, s.h);
    for (let i = 0; i < s.data.length; i++) {
      const cov = Math.min(1, Math.max(0, (s.data[i] + s.weight) / 1.25 + 0.5));
      im.data[i * 4] = 252; im.data[i * 4 + 1] = 248; im.data[i * 4 + 2] = 242; im.data[i * 4 + 3] = cov * 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  };

  /* the edge where the picture gives way to the article sweeps to its
     place: opening it settles in, closing it eases out and back */
  let cutTarget = w.cut.current ?? 0, edgeFrom = cutTarget, edgeTo = cutTarget, edgeAt = -1e9, edgeNow = cutTarget;

  let raf = 0, last = performance.now(), t = Math.random() * 100, born = -1;
  const power = !still && !opts.quiet;
  const draw = (ms: number) => {
    const dt = Math.min(64, ms - last);
    last = ms;
    if (!still) t += dt * 0.001;
    size();
    if (born < 0) born = ms;
    const age = power ? ms - born : 1e9;
    const light = lightMq.matches;
    const rgb = palette(w.palette.current ?? [], ms, still);
    lift += ((near ? 1 : 0) - lift) * (still ? 1 : Math.min(1, dt / 260));
    readCalm(dt);

    const goal = w.cut.current ?? 0;
    if (goal !== cutTarget) {
      cutTarget = goal;
      edgeFrom = edgeNow;
      edgeTo = goal;
      edgeAt = still || age < LOAD ? -1e9 : ms;
    }
    const cu = Math.min(1, (ms - edgeAt) / WIPE);
    const ce = edgeTo > edgeFrom ? 1 - Math.pow(1 - cu, 3) : ease(cu);
    const cut = edgeNow = edgeFrom + (edgeTo - edgeFrom) * ce;
    const flare = cu < 1 ? Math.pow(Math.sin(Math.PI * cu), 0.6) : 0;

    /* the logo's room: the strip beside the open article */
    const target = w.mark.current;
    if (target && goal > 0) lastCut = goal;
    const vw = W - lastCut;
    const fitW = Math.max(120, Math.min(288, Math.floor((vw * 0.8) / 8) * 8));
    const fitH = Math.max(120, Math.min(240, Math.floor((H * 0.4) / 8) * 8));
    const fk = `${fitW}x${fitH}`;
    if (!target) {
      lit = still ? 0 : Math.max(0, lit - dt / 380);
      if (lit === 0) { shownMark = null; logo = null; fitKey = ''; }
    } else if ((target !== shownMark || fk !== fitKey) && !loading) {
      loading = true;
      markSdf(target, fitW, fitH).then((s) => {
        loading = false;
        if (!s || w.mark.current !== target) return;
        logo = paintLogo(s);
        shownMark = target; fitKey = fk;
        wake();
      });
    }
    if (target && logo) lit = still ? 1 : Math.min(1, lit + dt / 900);

    /* 1. the field, one value per texel */
    const data = img!.data;
    const shift = innerWidth - W;
    for (let j = 0; j < rows; j++) {
      const y = j * TEXEL;
      for (let i = 0; i < cols; i++) {
        const x = i * TEXEL;
        const cx = (x + shift) / 12, cy = y / 12;
        let v = 0.5 + (wave(cx * 0.12 + t * 0.18, cy * 0.12 - t * 0.07, t) - 0.5) * 1.5 + 0.14 * Math.sin(t * 0.11);
        let shade = 0.8 + 0.22 * wave(cy * 0.084 + 40, cx * 0.084 - 20, t * 0.7);
        if (lift > 0.01) {
          const dx = (x - px) / 12, dy = (y - py) / 12;
          v += 0.16 * lift * Math.exp(-(dx * dx + dy * dy) / 111);
        }
        let c = 0;
        for (let k = 0; k < calmN; k++) {
          const o = k * 5;
          c = Math.max(c, calm[o + 4] * calmOval(x, y, calm[o], calm[o + 1], calm[o + 2], calm[o + 3]));
        }
        v += (0.42 - v) * c * 0.5;
        shade += (0.9 - shade) * c * 0.6;
        const q = Math.max(0, Math.min(255, (v * 255) | 0)) * 3;
        /* calm dims the picture on dark glass and greys it toward the
           glass on light, as the tube pass in crt.ts does; on dark a
           touch over, standing in for the main screen's halation */
        const dim = light ? 1 : 1.12 * (1 - c * 0.88 * 0.52);
        let r = rgb[q] * shade * dim, g = rgb[q + 1] * shade * dim, b = rgb[q + 2] * shade * dim;
        if (light && c > 0) { const k = c * 0.88 * 0.62; r += (238 - r) * k; g += (241 - g) * k; b += (246 - b) * k; }
        const o = (j * cols + i) * 4;
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
      }
    }
    lctx.putImageData(img!, 0, 0);

    /* 2. the flat raster: field, logo, scanlines, in the tube's shape */
    const D = dpr, FW = flat.width, FH = flat.height;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.globalAlpha = 1;
    fctx.clearRect(0, 0, FW, FH);
    fctx.setTransform(D, 0, 0, D, 0, 0);
    fctx.save();
    fctx.beginPath();
    fctx.roundRect(cut, 0, W - cut, H, RADIUS);
    fctx.clip();
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';
    fctx.drawImage(low, 0, 0, cols, rows, 0, 0, cols * TEXEL, rows * TEXEL);
    if (logo && lit > 0) {
      const lx = (lastCut + W) / 2 - logo.width / 2, ly = H / 2 - logo.height / 2;
      const hot = `rgb(${rgb[690]},${rgb[691]},${rgb[692]})`;
      fctx.globalAlpha = lit;
      fctx.shadowColor = light ? 'rgba(10,20,45,0.5)' : hot;
      fctx.shadowBlur = 28 * D;
      fctx.drawImage(logo, lx, ly);
      fctx.shadowBlur = 8 * D;
      fctx.drawImage(logo, lx, ly);
      fctx.shadowBlur = 0;
      fctx.globalAlpha = 1;
    }
    fctx.restore();
    /* a moving edge is a line of phosphor, its afterglow trailing behind */
    if (flare > 0.01) {
      const back = edgeTo > edgeFrom ? -1 : 1, R = 90;
      const g = fctx.createLinearGradient(cut - R, 0, cut + R, 0);
      const at = (dx: number) => Math.min(1, Math.max(0, (R + dx) / (2 * R)));
      const a = light ? 0.5 * flare : 0.75 * flare;
      const trail = `rgba(210,228,255,${a * 0.35})`, none = 'rgba(210,228,255,0)';
      g.addColorStop(0, none);
      g.addColorStop(at(back < 0 ? -6 : -4), back < 0 ? trail : none);
      g.addColorStop(at(0), `rgba(236,244,255,${a})`);
      g.addColorStop(at(back < 0 ? 4 : 6), back < 0 ? none : trail);
      g.addColorStop(1, 'rgba(210,228,255,0)');
      fctx.fillStyle = g;
      fctx.fillRect(cut - R, 0, 2 * R, H);
    }
    fctx.setTransform(1, 0, 0, 1, 0, 0);

    /* the power on: a line across, opening out, overbright */
    if (age < LOAD) {
      const ex = 1 - Math.pow(1 - sm(0, 260, age), 3), ey = ease(sm(220, 700, age));
      const cx = ((cut + W) / 2) * D, hw = Math.max(2, ((W - cut) / 2) * ex * D), hh = Math.max(D, (H / 2) * ey * D);
      fctx.globalCompositeOperation = 'source-atop';
      fctx.fillStyle = `rgba(235,242,255,${0.8 * (1 - sm(80, 520, age))})`;
      fctx.fillRect(0, 0, FW, FH);
      fctx.globalCompositeOperation = 'source-over';
      fctx.clearRect(0, 0, FW, FH / 2 - hh);
      fctx.clearRect(0, FH / 2 + hh, FW, FH);
      fctx.clearRect(0, 0, cx - hw, FH);
      fctx.clearRect(cx + hw, 0, FW, FH);
    }
    fctx.globalCompositeOperation = 'source-over';

    /* 3. bend it onto the glass: the barrel of warp.ts, applied across in
       thin rows, then down in thin columns */
    const S = 2 * D;
    const R2 = (W * W + H * H) / 4, kx = 1 + (CURVE * W * W) / 4 / R2, ky = 1 + (CURVE * H * H) / 4 / R2;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, FW, FH);
    for (let y = 0; y < FH; y += S) {
      const dy = (y + S / 2) / D - H / 2;
      /* how far this row is squeezed toward the middle */
      const f = (1 + (CURVE * (W * W / 4 + dy * dy)) / R2) / kx;
      const hw = FW / 2 / f;
      mctx.drawImage(flat, 0, y, FW, S, FW / 2 - hw, y, hw * 2, S);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let x = 0; x < FW; x += S) {
      const dx = (x + S / 2) / D - W / 2;
      const f = (1 + (CURVE * (dx * dx + H * H / 4)) / R2) / ky;
      const hh = FH / 2 / f;
      ctx.drawImage(mid, x, 0, S, FH, x, FH / 2 - hh, S, hh * 2);
    }
    /* 4. on the bent picture, so they stay crisp: scanlines in whole
       device pixels, and the corners falling into shadow */
    const CW = canvas.width, CH = canvas.height;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = scanlines(light)!;
    ctx.fillRect(0, 0, CW, CH);
    const v = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.45, CW / 2, CH / 2, Math.hypot(CW, CH) * 0.55);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, light ? 'rgba(30,45,70,0.2)' : 'rgba(0,0,0,0.34)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, CW, CH);
    ctx.globalCompositeOperation = 'source-over';
  };

  /* runs while visible; reduced motion draws on demand only */
  let visible = !document.hidden;
  const frame = (ms: number) => {
    raf = 0;
    draw(ms);
    if (!still && visible) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  wake();
  const onVis = () => { visible = !document.hidden; if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; } };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => wake());
  ro.observe(main);
  let lastKey = '';
  const poll = still ? window.setInterval(() => {
    let k = `${(w.palette.current ?? []).join()}|${w.cut.current}|${w.mark.current}|${!!logo}|${lightMq.matches}`;
    tube.querySelectorAll<HTMLElement>('[data-calm]').forEach((el) => { k += el.dataset.calm; });
    if (k !== lastKey) { lastKey = k; wake(); }
  }, 100) : 0;

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(poll);
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVis);
  };
}
