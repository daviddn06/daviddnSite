/* A logo's signed distance field from its coverage, the slow part of
   marks.ts. Pure arithmetic, so it runs the same in a worker
   (sdfWorker.ts) as on the page. */
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

/* RGBA pixels (only alpha is read) to the distance field, positive
   inside, and the total coverage */
export function field(a: Uint8ClampedArray, w: number, h: number): { data: Float32Array; on: number } {
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
  return { data, on };
}
