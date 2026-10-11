/* The glass's curve, for everything on the screen that is HTML (the
   guide, the chat, the article, the scanlines over them). The picture
   bends itself in its shader (crt.ts, `warp`); this bends the page's
   layers the same way, so a line of text bows exactly as the picture
   does and its ends follow the rounded tube.

   It is an SVG filter, `#crt-warp`: a displacement map, made here for the
   tube's current size, tells every point of the screen which point of
   the flat layout it shows. Browsers sample that map without smoothing,
   so where the curve moves things by more than a couple of pixels the
   result is softened a touch, more toward the corners (a beam's spot is
   soft there anyway), while the middle of the screen, which barely
   moves, stays sharp. Layers opt in with the `on-glass` class
   (filter: url(#crt-warp) in site.css). The map is rebuilt when the tube
   changes size. Clicks still land on the flat layout; the curve is only
   a few pixels away from it near the edges.

   CURVE is shared with the shader: the middle of each side stays put
   and the corners pull in. */
export const CURVE = 0.05;

const NS = 'http://www.w3.org/2000/svg';

/* the bend itself, as one SVG filter: the displacement, and the softening
   where it moves things far. The fast one is the displacement alone: the
   softening costs the browser five more passes over the layer, every
   frame the layer is bent in the compositor (see `curve`). */
const filter = (id: string, fast = false) => `<filter id="${id}" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">
      <feImage class="crt-warp-map" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap class="crt-warp-move" in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bent"/>${fast ? '' : `
      <feGaussianBlur in="bent" stdDeviation="0.3" result="soft"/>
      <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="edge"/>
      <feComposite in="soft" in2="edge" operator="in" result="soft-edge"/>
      <feComposite in="bent" in2="edge" operator="out" result="sharp-middle"/>
      <feComposite in="soft-edge" in2="sharp-middle" operator="arithmetic" k2="1" k3="1"/>`}
    </filter>`;

/* The displacement map's pixels for a w by h screen, self contained
   (it is also written into the page as is, to bend the screen before the
   app has loaded: warpBoot.ts). Red and green say where each point comes
   from on the flat layout, blue how far it moves (the softening's mask).
   At a quarter size: the curve is smooth. */
export function warpMap(w: number, h: number, k: number) {
  const cx = w / 2, cy = h / 2, r2 = cx * cx + cy * cy;
  const nx = 1 + (k * cx * cx) / r2, ny = 1 + (k * cy * cy) / r2;
  const src = (x: number, y: number) => {
    const dx = x - cx, dy = y - cy, f = 1 + (k * (dx * dx + dy * dy)) / r2;
    return [cx + (dx * f) / nx, cy + (dy * f) / ny];
  };
  const mw = Math.max(2, Math.ceil(w / 4)), mh = Math.max(2, Math.ceil(h / 4));
  const c0 = src(0, 0);
  const most = Math.max(Math.abs(c0[0]), Math.abs(c0[1]), 1);
  const scale = Math.ceil(most * 2 + 4);
  const px = new Uint8ClampedArray(mw * mh * 4);
  for (let j = 0; j < mh; j++) {
    for (let i = 0; i < mw; i++) {
      const x = ((i + 0.5) / mw) * w, y = ((j + 0.5) / mh) * h;
      const s = src(x, y), o = (j * mw + i) * 4;
      px[o] = Math.round(((s[0] - x) / scale + 0.5) * 255);
      px[o + 1] = Math.round(((s[1] - y) / scale + 0.5) * 255);
      px[o + 2] = Math.round(Math.min(1, Math.max(0, Math.hypot(s[0] - x, s[1] - y) - 2) / 6) * 255);
      px[o + 3] = 255;
    }
  }
  return { mw, mh, most, scale, px };
}

/* the filters' markup, also written into the page by warpBoot.ts */
export const DEFS = `<defs>${filter('crt-warp')}${filter('crt-warp-under')}${filter('crt-warp-fast', true)}${filter('crt-warp-under-fast', true)}</defs>`;

/* Builds (or rebuilds) the filter for a tube, and keeps it in step with
   the tube's size. Returns a function that stops watching.

   Two copies share the map. `#crt-warp` bends a whole layer (the guide,
   the chat, the scanlines). `#crt-warp-under` bends the article's layer
   only as far right as the article reaches: right of it that layer is
   empty, and while a project is open it is bent again every frame, so
   the browser is spared the empty part of the screen.

   Each has a fast twin without the softening. A layer that holds a
   scrolling box (the article, a chat with messages) is bent again in the
   compositor every frame, softening and all, so while anything on the
   tube moves (a scroll, an answer streaming in, the article sliding or
   wiping) every layer switches to its fast twin (`data-moving` on the
   tube, site.css) and back about 150ms after it settles. The difference
   is a third of a pixel of blur toward the corners, gone while things
   move. On a
   machine that cannot keep up, the screen's governor marks the tube
   `data-lite` (crt.ts) and every layer stays on its fast twin. */
export function curve(tube: HTMLElement): () => void {
  let svg = document.getElementById('crt-warp-svg') as unknown as SVGSVGElement | null;
  if (!svg) {
    svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    svg.id = 'crt-warp-svg';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = DEFS;
    document.body.appendChild(svg);
  }
  const maps = svg.querySelectorAll('.crt-warp-map');
  const moves = svg.querySelectorAll('.crt-warp-move');
  const unders = svg.querySelectorAll('#crt-warp-under, #crt-warp-under-fast');
  const layer = tube.querySelector<HTMLElement>('.under');

  let last = '', most = 0;
  const build = () => {
    const w = Math.round(tube.clientWidth), h = Math.round(tube.clientHeight);
    if (!w || !h || `${w}x${h}` === last) return;
    last = `${w}x${h}`;
    const m = warpMap(w, h, CURVE);
    most = m.most;
    const scale = m.scale;
    const c = document.createElement('canvas');
    c.width = m.mw; c.height = m.mh;
    const x = c.getContext('2d')!;
    const img = x.createImageData(m.mw, m.mh);
    img.data.set(m.px);
    x.putImageData(img, 0, 0);
    /* the filter's region is the layer's own box (in its bounding box
       units: WebKit misplaces a region given in user space now and then);
       the map inside it is laid out in CSS pixels */
    const href = c.toDataURL('image/png');
    for (const map of maps) {
      for (const [k, v] of [['width', w], ['height', h]] as const) map.setAttribute(k, String(v));
      map.setAttribute('href', href);
    }
    for (const move of moves) move.setAttribute('scale', String(scale));
  };

  /* the under layer from the tube's left edge to the article's right
     edge, widened by the most the bend moves a point (plus the
     softening). It always starts at the left edge: WebKit shifts the
     whole result by a region that starts anywhere else. */
  let span = '';
  const fit = () => {
    const w = tube.clientWidth;
    if (!layer || !w) return;
    let r = 0;
    for (const a of layer.querySelectorAll<HTMLElement>('.article')) r = Math.max(r, a.offsetLeft + a.offsetWidth);
    const x1 = r > 0 ? Math.min(w, Math.ceil(r + most + 4)) : w;
    const next = String(x1 / w);
    if (next === span) return;
    span = next;
    for (const u of unders) u.setAttribute('width', next);
  };
  const watched = new Set<Element>();
  const ro = new ResizeObserver(() => { build(); fit(); });
  const track = () => {
    for (const a of layer?.querySelectorAll('.article') ?? []) if (!watched.has(a)) { watched.add(a); ro.observe(a); }
    for (const a of watched) if (!a.isConnected) { watched.delete(a); ro.unobserve(a); }
    fit();
  };
  build();
  ro.observe(tube);
  const mo = new MutationObserver(track);
  if (layer) mo.observe(layer, { childList: true });
  track();

  /* motion: the tube's layers are fast while anything on it moves, and
     for HOLD ms after */
  const HOLD = 150;
  let until = 0, timer = 0;
  const settle = () => {
    timer = 0;
    if (until > performance.now() || sliding()) { timer = window.setTimeout(settle, HOLD); return; }
    delete tube.dataset.moving;
  };
  const moving = (el: EventTarget | Node | null) => {
    if (!(el instanceof Node) || !tube.contains(el)) return;
    until = performance.now() + HOLD;
    if (!('moving' in tube.dataset)) tube.dataset.moving = '';
    if (!timer) timer = window.setTimeout(settle, HOLD);
  };
  /* the article's own motion (sliding in or out, a wipe) runs as CSS
     animations; endless ones (a screenshot's shimmer) do not count */
  const sliding = () => !!layer && layer.getAnimations({ subtree: true }).some((a) =>
    a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
  const onScroll = (e: Event) => moving(e.target);
  /* only the article's motion counts, while it shows, and not endless
     animations (a waiting screenshot's shimmer, which also starts in an
     article built out of sight under a hovered project) */
  const onAnim = (e: Event) => {
    const t = e.target as Element;
    if (!layer?.contains(t) || getComputedStyle(layer).visibility === 'hidden') return;
    const name = (e as AnimationEvent).animationName;
    if (t.getAnimations().some((a) => (a as CSSAnimation).animationName === name && a.effect?.getComputedTiming().iterations !== Infinity)) moving(t);
  };
  tube.addEventListener('scroll', onScroll, { capture: true, passive: true });
  tube.addEventListener('animationstart', onAnim, true);
  /* an answer streaming into the chat */
  const typed = new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target instanceof Element ? r.target : r.target.parentElement;
      if (el?.closest('.crt-slot')) { moving(el); return; }
    }
  });
  const over = tube.querySelector('.over.on-glass');
  if (over) typed.observe(over, { childList: true, characterData: true, subtree: true });

  return () => {
    ro.disconnect(); mo.disconnect(); typed.disconnect();
    tube.removeEventListener('scroll', onScroll, true);
    tube.removeEventListener('animationstart', onAnim, true);
    clearTimeout(timer);
    delete tube.dataset.moving;
  };
}
