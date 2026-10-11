/* The static of a channel change. A small canvas over the picture and
   the article (under the guide and the chat, which the set draws on top,
   as a real TV does), drawn only while a change runs: snow that swells
   to its thickest at SWAP, when the screen takes the new picture, then
   clears by TUNE. It is plain 2D canvas, so it works without WebGL too.
   Rows of snow are nudged sideways a little, like a set losing and
   finding sync, and the glass's scanlines cross it like everything else.
   With reduced motion there is no static; the channel simply changes. */
import { useEffect, useRef } from 'react';
import { SWAP, TUNE } from './crt';

/* how thick the snow is, t ms into a change */
const thickness = (t: number) =>
  t < 0 || t >= TUNE ? 0
    : t < SWAP ? 0.9 * Math.pow(t / SWAP, 1.4)
    : 0.9 * Math.pow(1 - (t - SWAP) / (TUNE - SWAP), 2);

export function Static({ tune }: { tune: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const first = useRef(tune);
  const at = useRef(-1e9);

  useEffect(() => {
    if (tune === first.current) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const light = matchMedia('(prefers-color-scheme: light)').matches;
    /* a change during a change carries on from its thickest */
    const now = performance.now();
    at.current = now - at.current < TUNE ? now - Math.min(now - at.current, SWAP * 0.8) : now;

    /* one texel per 2.5 CSS px is enough for snow */
    const box = canvas.parentElement!.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width / 2.5)), h = Math.max(1, Math.round(box.height / 2.5));
    canvas.width = w;
    canvas.height = h;
    const img = ctx.createImageData(w, h);
    const px = new Uint32Array(img.data.buffer);
    const row = new Uint32Array(w);
    const base = light ? 120 : 10, span = light ? 135 : 200;

    let raf = 0;
    const draw = (ms: number) => {
      const t = ms - at.current;
      const k = thickness(t);
      if (k <= 0.002 && t > SWAP) { ctx.clearRect(0, 0, w, h); canvas.style.opacity = '0'; return; }
      canvas.style.opacity = '1';
      const a = Math.round(k * 255);
      for (let y = 0; y < h; y++) {
        /* a whole row of snow, slipped sideways now and then */
        for (let x = 0; x < w; x++) {
          const v = base + ((Math.random() * span) | 0);
          row[x] = (a << 24) | (v << 16) | (v << 8) | v;
        }
        const slip = Math.random() < 0.06 ? (Math.random() * 18) | 0 : 0;
        const o = y * w;
        for (let x = 0; x < w; x++) px[o + x] = row[(x + slip) % w];
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tune]);

  return <canvas ref={ref} className="static" aria-hidden="true" />;
}
