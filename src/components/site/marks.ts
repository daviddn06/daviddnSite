/* The open project's logo, from the hidden SVG on the page (`Marks` in
   Media.tsx). `markImage` draws it white at 512px and finds where the
   art actually sits inside its viewBox. `markSdf` turns it into a
   signed distance field, the form the CRT draws it from: one texel per
   CSS pixel, positive inside, so the shader can draw a clean outline at
   any scale, glow around it, and blend one logo into the next by
   mixing two fields. */

import { field } from './sdf';

export type MarkImage = { img: HTMLCanvasElement; x: number; y: number; w: number; h: number };

const images = new Map<string, Promise<MarkImage | null>>();

export function markImage(slug: string): Promise<MarkImage | null> {
  const hit = images.get(slug);
  if (hit) return hit;
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
  const job = new Promise<MarkImage | null>((resolve) => {
    const im = new Image();
    im.onload = () => {
      const P = 512;
      const img = document.createElement('canvas');
      img.width = img.height = P;
      const px = img.getContext('2d', { willReadFrequently: true })!;
      px.drawImage(im, 0, 0, P, P);
      const pd = px.getImageData(0, 0, P, P).data;
      let x0 = P, x1 = -1, y0 = P, y1 = -1;
      for (let i = 0; i < P * P; i++) if (pd[i * 4 + 3] > 40) {
        const xx = i % P, yy = (i / P) | 0;
        if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      }
      resolve(x1 < 0 ? null : { img, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
  images.set(slug, job);
  return job;
}

/* room around the fitted mark for its glow, in CSS px */
export const PAD = 40;

/* the distance transform runs in a worker so a logo never holds up a
   frame; on the page itself if a worker cannot start */
let worker: Worker | null | undefined;
const waiting = new Map<number, (r: { data: Float32Array; on: number }) => void>();
let ids = 0;
const fieldOff = (a: Uint8ClampedArray, w: number, h: number): Promise<{ data: Float32Array; on: number }> => {
  if (worker === undefined) {
    try {
      worker = new Worker(new URL('./sdfWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { const r = waiting.get(e.data.id); waiting.delete(e.data.id); r?.(e.data); };
      worker.onerror = () => { worker?.terminate(); worker = null; const rest = [...waiting.values()]; waiting.clear(); rest.forEach((r) => r(null as never)); };
    } catch { worker = null; }
  }
  if (!worker) return Promise.resolve(field(a, w, h));
  const id = ++ids;
  return new Promise<{ data: Float32Array; on: number } | null>((resolve) => {
    waiting.set(id, resolve);
    worker!.postMessage({ id, a, w, h }, [a.buffer]);
  }).then((r) => r ?? field(a, w, h));
};

export type Sdf = { w: number; h: number; data: Float32Array; weight: number };
const sdfs = new Map<string, Promise<Sdf | null>>();

/* The mark fitted inside FW by FH CSS px, centred in a frame padded by
   PAD each side. Open, thin marks get a little `weight` (px added to the
   distance) so their strokes hold across scanlines. */
export function markSdf(slug: string, FW: number, FH: number): Promise<Sdf | null> {
  const key = `${slug}|${FW}x${FH}`;
  const hit = sdfs.get(key);
  if (hit) return hit;
  const job = markImage(slug).then(async (m) => {
    if (!m) return null;
    const w = FW + PAD * 2, h = FH + PAD * 2;
    const sc = Math.min(FW / m.w, FH / m.h);
    const dw = m.w * sc, dh = m.h * sc;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(m.img, m.x, m.y, m.w, m.h, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const { data, on } = await fieldOff(x.getImageData(0, 0, w, h).data, w, h);
    const fill = on / (dw * dh);
    return { w, h, data, weight: fill > 0.5 ? 0 : 0.6 };
  });
  sdfs.set(key, job);
  return job;
}
