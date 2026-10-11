/* The article. A column beside the sidebar that sits under the field;
   the field pulls back to reveal it (Field.tsx), so the article itself
   never animates. The title, one line, the role and dates, then the
   body: paragraphs, small headings and screens, including before and
   after sliders. Projects without a body fall back to notes and shots. */
import { useEffect, useRef } from 'react';
import { Compare, Frame, type Block, type Project, type Shot } from './Media';

type Props = {
  p: Project | null;
  /* its channel number in the guide */
  channel: string;
  open: boolean;
  onClose: () => void;
  onZoom: (src: string, alt: string) => void;
};

export function Panel({ p, channel, open, onClose, onZoom }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => { if (open) ref.current?.scrollTo({ top: 0 }); }, [open, p?.slug]);

  /* videos play only while on screen */
  useEffect(() => {
    const root = ref.current;
    if (!root || !open) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const play = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !still) v.play().catch(() => {});
        else v.pause();
      }
    }, { root, threshold: 0.3 });
    root.querySelectorAll<HTMLVideoElement>('video[data-auto]').forEach((v) => {
      if (still) v.controls = true;
      play.observe(v);
    });
    return () => play.disconnect();
  }, [p?.slug, open]);

  const shot = (m: Shot, k: number) => (
    <figure className={`shot${m.type === 'compare' ? ' wide' : ''}`} key={k}>
      {m.type === 'compare' ? (
        <Compare c={m} alt={`${p!.name}, ${m.caption ?? ''}`} />
      ) : m.type === 'pair' ? (
        <div className="pair">
          {m.items.map((it, j) => (
            <Frame key={j} m={it} alt={`${p!.name}, ${m.caption ?? ''}`} sizes="(min-width: 1000px) 400px, 46vw" onZoom={onZoom} />
          ))}
        </div>
      ) : (
        <Frame m={m} alt={`${p!.name}, ${m.caption ?? ''}`} sizes="(min-width: 1000px) 820px, 92vw" onZoom={onZoom} />
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
    <section ref={ref} className="article" aria-hidden={!open} inert={!open} aria-label={p?.name}>
      {p && (
        <div className="article-inner" key={p.slug}>
          <header className="article-head">
            <h2 className="name"><span className="ch" aria-hidden="true">{channel}</span>{p.name}</h2>
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
      )}
    </section>
  );
}
