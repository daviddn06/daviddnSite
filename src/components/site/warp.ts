/* The glass's curve, for everything on the screen that is HTML (the
   guide, the chat, the article, the scanlines over them). The picture
   bends itself in its shader (crt.ts, `warp`); this bends the page's
   layers the same way, so a line of text bows exactly as the picture
   does and its ends follow the rounded tube.

   It is an SVG filter, `#crt-warp`: a displacement map, made here for the
   tube's current size, tells every point of the screen which point of
   the flat layout it shows. Browsers sample that map without smoothing,
   so where the curve moves things by more than a pixel the result is
   softened a touch (a beam's spot is soft there anyway), while the
   middle of the screen, which barely moves, stays sharp. Layers opt in with the `on-glass` class
   (filter: url(#crt-warp) in site.css). The map is rebuilt when the tube
   changes size. Clicks still land on the flat layout; the curve is only
   a few pixels away from it near the edges.

   CURVE is shared with the shader: the middle of each side stays put
   and the corners pull in. */
export const CURVE = 0.05;

const NS = 'http://www.w3.org/2000/svg';

/* where on the flat layout the point (x, y) of a w by h screen comes
   from: the same formula as `warp` in crt.ts */
const source = (x: number, y: number, w: number, h: number) => {
  const cx = w / 2, cy = h / 2, dx = x - cx, dy = y - cy;
  const r2 = cx * cx + cy * cy;
  const f = 1 + (CURVE * (dx * dx + dy * dy)) / r2;
  return [cx + (dx * f) / (1 + (CURVE * cx * cx) / r2), cy + (dy * f) / (1 + (CURVE * cy * cy) / r2)];
};

/* Builds (or rebuilds) the filter for a tube, and keeps it in step with
   the tube's size. Returns a function that stops watching. */
export function curve(tube: HTMLElement): () => void {
  let svg = document.getElementById('crt-warp-svg') as unknown as SVGSVGElement | null;
  if (!svg) {
    svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    svg.id = 'crt-warp-svg';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `<defs><filter id="crt-warp" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">
      <feImage id="crt-warp-map" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap id="crt-warp-move" in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bent"/>
      <feGaussianBlur in="bent" stdDeviation="0.3" result="soft"/>
      <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="edge"/>
      <feComposite in="soft" in2="edge" operator="in" result="soft-edge"/>
      <feComposite in="bent" in2="edge" operator="out" result="sharp-middle"/>
      <feComposite in="soft-edge" in2="sharp-middle" operator="arithmetic" k2="1" k3="1"/>
    </filter></defs>`;
    document.body.appendChild(svg);
  }
  const filter = svg.querySelector('filter')!;
  const map = svg.querySelector('#crt-warp-map')!;
  const move = svg.querySelector('#crt-warp-move')!;

  let last = '';
  const build = () => {
    const w = Math.round(tube.clientWidth), h = Math.round(tube.clientHeight);
    if (!w || !h || `${w}x${h}` === last) return;
    last = `${w}x${h}`;
    /* the map at a quarter size is plenty: the curve is smooth */
    const mw = Math.max(2, Math.ceil(w / 4)), mh = Math.max(2, Math.ceil(h / 4));
    const [cx0, cy0] = source(0, 0, w, h);
    const most = Math.max(Math.abs(cx0), Math.abs(cy0), 1);
    const scale = Math.ceil(most * 2 + 4);
    const c = document.createElement('canvas');
    c.width = mw; c.height = mh;
    const x = c.getContext('2d')!;
    const img = x.createImageData(mw, mh);
    for (let j = 0; j < mh; j++) {
      for (let i = 0; i < mw; i++) {
        const px = ((i + 0.5) / mw) * w, py = ((j + 0.5) / mh) * h;
        const [sx, sy] = source(px, py, w, h);
        const o = (j * mw + i) * 4;
        img.data[o] = Math.round(((sx - px) / scale + 0.5) * 255);
        img.data[o + 1] = Math.round(((sy - py) / scale + 0.5) * 255);
        /* how much this point moves, as the mask for the softening */
        img.data[o + 2] = Math.round(Math.min(1, Math.hypot(sx - px, sy - py) / 2) * 255);
        img.data[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    for (const [k, v] of [['width', w], ['height', h]] as const) {
      filter.setAttribute(k, String(v));
      map.setAttribute(k, String(v));
    }
    map.setAttribute('href', c.toDataURL('image/png'));
    move.setAttribute('scale', String(scale));
  };
  build();
  const ro = new ResizeObserver(build);
  ro.observe(tube);
  return () => ro.disconnect();
}
