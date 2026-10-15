import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import pruneMedia from './integrations/prune-media.mjs';
import precompress from './integrations/precompress.mjs';

/* React renders the logo SVGs at build time only. No component is
   hydrated, so no React ships to the browser. */
export default defineConfig({
  site: 'https://daviddn.dev',
  server: { port: 4321 },
  build: { inlineStylesheets: 'always' },
  integrations: [react(), pruneMedia(), precompress()],
  /* AVA Media is told as Wedge Studio now (2026-10-15), so its old
     address lands on the Wedge channel. */
  redirects: { '/projects/ava-media': '/projects/wedge/' },
});
