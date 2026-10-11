/* Citations. David's replies can point at where a claim comes from: the
   server (asked with `features: ["cite"]`, adapter.ts) has the model put
   a marker right after it, `[[slug]]` or `[[slug#Heading text]]`, where
   the heading is one of that project's article headings.

   Each marker becomes a small numbered chip in the text, tinted with the
   project's colour, and a Sources row under the reply lists them with
   the project's mark. Choosing either opens the project and scrolls its
   article to the heading, which glows for a moment.

   It looks like the set tuning in: as a citation arrives, that project's
   channel in the guide flickers, the chip scans in, and the sources line
   up one after another. Each is short, opacity, transform, filter and
   clip only. Markers are kept in the saved conversation as they came,
   so a reopened chat shows its sources too; a marker that has not
   closed yet is never shown. */
import { createContext, useContext, useEffect } from 'react';
import { BRAND } from '../../logos/brand';
import { brandAccent } from '../palette';
import { Mini, type Project } from '../Media';
import { SiteContext } from './cards';

export type Cite = { key: string; slug: string; heading: string; n: number };

export const MARK = /\[\[([a-z0-9-]+)(?:#([^\]\n]{1,140}))?\]\]/g;

/* every source in a reply, numbered in the order they first appear */
export const citesOf = (text: string, all: Project[]): Cite[] => {
  const out: Cite[] = [];
  for (const m of text.matchAll(MARK)) {
    const slug = m[1], heading = (m[2] ?? '').trim();
    if (!all.some((p) => p.slug === slug)) continue;
    const key = `${slug}#${heading.toLowerCase()}`;
    if (!out.some((c) => c.key === key)) out.push({ key, slug, heading, n: out.length + 1 });
  }
  return out;
};

/* a marker still arriving ("[[sho", or a lone "[") is held back */
export const holdPartial = (text: string) => {
  const i = text.lastIndexOf('[[');
  if (i >= 0 && text.indexOf(']]', i) < 0) return text.slice(0, i);
  return text.endsWith('[') ? text.slice(0, -1) : text;
};

export const CiteContext = createContext<{ cites: Cite[]; go: (c: Cite) => void }>({ cites: [], go: () => {} });

const tint = (slug: string) => {
  const b = BRAND[slug];
  if (!b) return undefined;
  const light = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches;
  return brandAccent(b.color, light);
};

const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* opens the project and brings its article to the heading */
export function useGo(after?: () => void) {
  const site = useContext(SiteContext);
  return (c: Cite) => {
    const p = site?.all.find((x) => x.slug === c.slug);
    if (!site || !p) return;
    site.show(c.slug);
    after?.();
    const want = c.heading.toLowerCase();
    const t0 = performance.now();
    let settled = 0;
    const seek = () => {
      const art = [...document.querySelectorAll<HTMLElement>('.article')]
        .find((a) => a.getAttribute('aria-hidden') !== 'true' && a.getAttribute('aria-label') === p.name);
      /* wait for the article to be the one on screen, then a few more
         frames so its own reset to the top has happened */
      if (!art || settled++ < 3) {
        if (performance.now() - t0 < 2500) requestAnimationFrame(seek);
        return;
      }
      const h = want ? [...art.querySelectorAll<HTMLElement>('h2, h3')].find((x) => (x.textContent ?? '').trim().toLowerCase() === want) : null;
      if (!h) { art.scrollTo({ top: 0, behavior: still() ? 'auto' : 'smooth' }); return; }
      const top = h.getBoundingClientRect().top - art.getBoundingClientRect().top + art.scrollTop - 28;
      art.scrollTo({ top: Math.max(0, top), behavior: still() ? 'auto' : 'smooth' });
      h.classList.remove('cite-hit');
      void h.offsetWidth;
      h.classList.add('cite-hit');
      window.setTimeout(() => h.classList.remove('cite-hit'), 1800);
    };
    requestAnimationFrame(seek);
  };
}

/* the guide's channel for a project flickers, as if the set tuned in */
const tune = (slug: string) => {
  if (still()) return;
  const ch = document.querySelector<HTMLElement>(`.channel[href="/projects/${slug}/"]`);
  if (!ch) return;
  ch.classList.remove('cite-tune');
  void ch.offsetWidth;
  ch.classList.add('cite-tune');
  window.setTimeout(() => ch.classList.remove('cite-tune'), 420);
};

export function Chip({ c, fresh }: { c: Cite; fresh: boolean }) {
  const { go } = useContext(CiteContext);
  const site = useContext(SiteContext);
  const name = site?.all.find((p) => p.slug === c.slug)?.name ?? c.slug;
  useEffect(() => { if (fresh) tune(c.slug); }, []);
  return (
    <button type="button" className={`cite${fresh ? ' is-new' : ''}`} style={{ '--tint': tint(c.slug) } as React.CSSProperties}
      aria-label={`Source ${c.n}, ${name}${c.heading ? `, ${c.heading}` : ''}`} onClick={() => go(c)}>
      {c.n}
    </button>
  );
}

export function Sources({ cites, fresh }: { cites: Cite[]; fresh: boolean }) {
  const { go } = useContext(CiteContext);
  const site = useContext(SiteContext);
  if (!cites.length) return null;
  return (
    <div className={`sources${fresh ? ' is-new' : ''}`} aria-label="Sources">
      {cites.map((c, i) => {
        const p = site?.all.find((x) => x.slug === c.slug);
        return (
          <button type="button" key={c.key} className="source" style={{ '--i': i, '--tint': tint(c.slug) } as React.CSSProperties} onClick={() => go(c)}>
            <span className="source-n">{c.n}</span>
            <Mini slug={c.slug} />
            <span className="source-name">{p?.name ?? c.slug}{c.heading && <span className="source-where"> · {c.heading}</span>}</span>
          </button>
        );
      })}
    </div>
  );
}
