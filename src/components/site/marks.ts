/* The open project's logo, from the hidden SVG on the page (`Marks` in
   Media.tsx). `markImage` draws it white at 512px and finds where the
   art actually sits inside its viewBox. `markSdf` turns it into a
   signed distance field, the form the CRT draws it from: one texel per
   CSS pixel, positive inside, so the shader can draw a clean outline at
   any scale, glow around it, and blend one logo into the next by
   mixing two fields. */

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
const INF = 1e20;

/* Felzenszwalb and Huttenlocher's squared distance transform along one
   row or column, as in Mapbox's TinySDF */
function edt1d(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Uint16Array, z: Float64Array) {
  v[0] = 0; z[0] = -INF; z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k], qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}
function edt(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), v = new Uint16Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
}

export type Sdf = { w: number; h: number; data: Float32Array; weight: number };
const sdfs = new Map<string, Sdf>();

/* The mark fitted inside FW by FH CSS px, centred in a frame padded by
   PAD each side. Open, thin marks get a little `weight` (px added to the
   distance) so their strokes hold across scanlines. */
export async function markSdf(slug: string, FW: number, FH: number): Promise<Sdf | null> {
  const key = `${slug}|${FW}x${FH}`;
  const hit = sdfs.get(key);
  if (hit) return hit;
  const m = await markImage(slug);
  if (!m) return null;
  const w = FW + PAD * 2, h = FH + PAD * 2;
  const sc = Math.min(FW / m.w, FH / m.h);
  const dw = m.w * sc, dh = m.h * sc;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(m.img, m.x, m.y, m.w, m.h, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const a = x.getImageData(0, 0, w, h).data;
  const n = w * h;
  const outer = new Float64Array(n), inner = new Float64Array(n);
  let on = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i * 4 + 3] / 255;
    on += v;
    if (v >= 1) { outer[i] = 0; inner[i] = INF; }
    else if (v <= 0) { outer[i] = INF; inner[i] = 0; }
    else {
      const d = 0.5 - v;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  edt(outer, w, h);
  edt(inner, w, h);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.sqrt(inner[i]) - Math.sqrt(outer[i]);
  const fill = on / (dw * dh);
  const out = { w, h, data, weight: fill > 0.5 ? 0 : 0.6 };
  sdfs.set(key, out);
  return out;
}
