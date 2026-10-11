/* The article. A column beside the sidebar that sits under the field;
   the field pulls back to reveal it (Field.tsx), so the article itself
   never animates. The title, one line, the role and dates, then the
   body: paragraphs, small headings and screens, including before and
   after sliders. Projects without a body fall back to notes and shots.

   Switching projects, the content eases in where it stands while copies
   of what it replaces (`leaving`) fade out over it (App.tsx). */
import { memo, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { Compare, Frame, Mini, type Block, type Project, type Shot } from './Media';

type Props = {
  p: Project | null;
  open: boolean;
  /* its content is easing in over a switch */
  swapping?: boolean;
  /* a copy of an article being replaced, fading out over the new one */
  leaving?: boolean;
  /* where that one was scrolled to, and how visible it was */
  startAt?: number;
  from?: number;
  onClose: () => void;
  onZoom: (src: string, alt: string) => void;
};

/* drawn again only when its own props change, not on every hover or step
   of the slide around it */
export const Panel = memo(function Panel({ p, open, swapping, leaving, startAt, from, onClose, onZoom }: Props) {
  const ref = useRef<HTMLElement>(null);
  /* where the article is scrolled to, kept as it scrolls, so a scroll it
     is already at need not be asked of the browser (which would lay out a
     just drawn article in the middle of the click that opened it) */
  const at = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => { at.current = el.scrollTop; };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  /* before the first frame, so a new article never shows the old one's
     scroll, and a leaving copy never shows the top */
  useLayoutEffect(() => { if (open && !leaving && at.current) ref.current?.scrollTo({ top: 0 }); }, [open, leaving, p?.slug]);
  useLayoutEffect(() => { if (leaving && startAt && startAt !== at.current) ref.current?.scrollTo({ top: startAt }); }, [leaving, startAt]);

  /* videos play only while on screen, and never in a hidden tab */
  useEffect(() => {
    const root = ref.current;
    if (!root || !open) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = new Set<HTMLVideoElement>();
    const play = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) seen.add(v); else seen.delete(v);
        if (e.isIntersecting && !still && !document.hidden) v.play().catch(() => {});
        else v.pause();
      }
    }, { root, threshold: 0.3 });
    root.querySelectorAll<HTMLVideoElement>('video[data-auto]').forEach((v) => {
      if (still) v.controls = true;
      play.observe(v);
    });
    const onVis = () => {
      if (still) return;
      for (const v of seen) { if (document.hidden) v.pause(); else v.play().catch(() => {}); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { play.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [p?.slug, open]);

  return (
    <section ref={ref} className={`article${swapping ? ' swap-in' : ''}${leaving ? ' is-leaving' : ''}`}
      style={leaving ? ({ '--from': from ?? 1 } as CSSProperties) : undefined} aria-hidden={!open} inert={!open} aria-label={p?.name}>
      {p && <Body key={p.slug} p={p} onClose={onClose} onZoom={onZoom} />}
    </section>
  );
});

/* The article's content, drawn once per project: opening, closing and
   switching change only the column around it. */
const Body = memo(function Body({ p, onClose, onZoom }: { p: Project; onClose: () => void; onZoom: (src: string, alt: string) => void }) {
  const shot = (m: Shot, k: number) => (
    <figure className={`shot${m.type === 'compare' ? ' wide' : ''}`} key={k}>
      {m.type === 'compare' ? (
        <Compare c={m} alt={`${p.name}, ${m.caption ?? ''}`} />
      ) : m.type === 'pair' ? (
        <div className="pair">
          {m.items.map((it, j) => (
            <Frame key={j} m={it} alt={`${p.name}, ${m.caption ?? ''}`} sizes="(min-width: 1000px) 400px, 46vw" onZoom={onZoom} />
          ))}
        </div>
      ) : (
        <Frame m={m} alt={`${p.name}, ${m.caption ?? ''}`} sizes="(min-width: 1000px) 820px, 92vw" onZoom={onZoom} />
      )}
      {m.caption && <figcaption>{m.caption}</figcaption>}
    </figure>
  );
  const block = (b: Block, k: number) =>
    typeof b === 'string' ? <p key={k}>{b}</p>
      : 'type' in b ? shot(b, k)
      : 'stats' in b ? (
        <dl className="stats" key={k}>
          {b.stats.map(([v, l]) => <div key={l}><dt>{v}</dt><dd>{l}</dd></div>)}
        </dl>
      )
      : <h3 className="sub" key={k}>{b.h}</h3>;

  const host = p?.url ? new URL(p.url).hostname.replace(/^www\./, '') : '';
  const label = host === 'web.archive.org' ? 'Archived site' : host;

  return (
    <div className="article-inner">
      <header className="article-head">
        <h2 className="name"><Mini slug={p.slug} />{p.name}</h2>
        <button type="button" className="close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </header>
      <p>{p.line}</p>
      <p className="meta-line">
        {p.role}<br />{p.when}
        {p.url && <><br /><a href={p.url} target="_blank" rel="noopener">{label}</a></>}
      </p>
      {p.body ? p.body.map(block) : <>
        {p.notes?.map((t, k) => <p key={k}>{t}</p>)}
        {p.shots.map(shot)}
      </>}
    </div>
  );
});

/* Warms the first screens of a project (on hover or focus in the guide),
   so they are decoded before a switch shows them. Matches Frame's
   srcset and sizes so the browser fetches the same file. */
const warmed = new Set<string>();
export function preload(p: Project | undefined) {
  if (!p || warmed.has(p.slug)) return;
  warmed.add(p.slug);
  const shots: Shot[] = (p.body ?? p.shots).filter((b): b is Shot => typeof b === 'object' && 'type' in b).slice(0, 2);
  for (const s of shots) {
    const media = s.type === 'compare' ? [s.after, s.before] : s.type === 'pair' ? s.items : [s];
    for (const m of media) {
      const im = new Image();
      im.decoding = 'async';
      if (m.type === 'video') { if (m.poster) im.src = m.poster; continue; }
      if (m.small) { im.sizes = '(min-width: 1000px) 820px, 92vw'; im.srcset = `${m.small} 800w, ${m.src} 1600w`; }
      im.src = m.small ?? m.src;
      im.decode?.().catch(() => {});
    }
  }
}
