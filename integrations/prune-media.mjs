/* After `astro build`, deletes from dist/work/ every file that
   src/data/work.js does not reference. public/ itself is never touched,
   so the full media library stays on disk for later. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export default function pruneMedia() {
  return {
    name: 'prune-media',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const data = pathToFileURL(path.join(ROOT, 'src/data/work.js')).href + `?t=${Date.now()}`;
        const keep = (await import(data)).mediaFiles();
        let pruned = 0;
        for (const f of walk(path.join(dist, 'work'))) {
          const rel = '/' + path.relative(dist, f).split(path.sep).join('/');
          if (!keep.has(rel)) { fs.unlinkSync(f); pruned++; }
        }
        for (const d of fs.existsSync(path.join(dist, 'work')) ? fs.readdirSync(path.join(dist, 'work')) : []) {
          const p = path.join(dist, 'work', d);
          if (fs.statSync(p).isDirectory() && fs.readdirSync(p).length === 0) fs.rmdirSync(p);
        }
        logger.info(`kept ${keep.size} media file(s), pruned ${pruned} unused file(s) from dist`);
      },
    },
  };
}
