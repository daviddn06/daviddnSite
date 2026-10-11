/* After `astro build`, writes a brotli (.br) and a gzip (.gz) copy beside
   every text file in dist (pages, scripts, styles, SVG, JSON, XML, text)
   that is worth compressing, at the highest settings, once. Caddy serves
   them as they are with `file_server { precompressed br gzip }` instead of
   gzipping each response on the fly at a lower level; browsers that ask
   for neither get the plain file. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const TEXT = /\.(html|js|mjs|css|svg|json|xml|txt|webmanifest)$/i;
const MIN = 1024;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export default function precompress() {
  return {
    name: 'precompress',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        let n = 0, raw = 0, br = 0;
        for (const f of walk(fileURLToPath(dir))) {
          if (!TEXT.test(f)) continue;
          const body = fs.readFileSync(f);
          if (body.length < MIN) continue;
          const b = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } });
          const g = zlib.gzipSync(body, { level: 9 });
          /* only keep a copy that is actually smaller */
          if (b.length < body.length) fs.writeFileSync(f + '.br', b);
          if (g.length < body.length) fs.writeFileSync(f + '.gz', g);
          n++; raw += body.length; br += Math.min(b.length, body.length);
        }
        logger.info(`compressed ${n} file(s), ${Math.round(raw / 1024)} KB to ${Math.round(br / 1024)} KB with brotli`);
      },
    },
  };
}
