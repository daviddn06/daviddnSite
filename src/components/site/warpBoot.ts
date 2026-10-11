/* Bends the screen before the app has loaded. Written into the page as is
   (Base.astro), right after the screen's markup, so the guide and the
   article are never seen flat on a slow phone: it builds the same filters
   and map as warp.ts (passed in, so there is one source for both) and
   marks the page `curved`. The app's own curve (App.tsx) takes over the
   same filters when it starts. Self contained: nothing outside this
   function is in scope where it runs. */
import type { warpMap as WarpMap } from './warp';

export function bootCurve(defs: string, k: number, warpMap: typeof WarpMap) {
  try {
    const tube = document.querySelector<HTMLElement>('.stage:not(.page) > .tube');
    if (!tube || document.getElementById('crt-warp-svg')) return;
    const w = Math.round(tube.clientWidth), h = Math.round(tube.clientHeight);
    if (!w || !h) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'crt-warp-svg';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = defs;
    const m = warpMap(w, h, k);
    const c = document.createElement('canvas');
    c.width = m.mw; c.height = m.mh;
    const x = c.getContext('2d');
    if (!x) return;
    const img = x.createImageData(m.mw, m.mh);
    img.data.set(m.px);
    x.putImageData(img, 0, 0);
    const href = c.toDataURL('image/png');
    svg.querySelectorAll('.crt-warp-map').forEach((n) => { n.setAttribute('width', String(w)); n.setAttribute('height', String(h)); n.setAttribute('href', href); });
    svg.querySelectorAll('.crt-warp-move').forEach((n) => n.setAttribute('scale', String(m.scale)));
    document.body.appendChild(svg);
    document.documentElement.classList.add('curved');
  } catch (e) { /* the app bends it when it starts */ }
}
