/* Types, the screenshot frame, the before and after slider, and the
   hidden marks the field draws its logo from. */
import { memo, useState } from 'react';
import { BRAND } from '../logos/brand';
import { ProjectLogo } from '../logos/ProjectLogo';

export type Media = {
  type: 'image' | 'video';
  src: string;
  small?: string;
  poster?: string;
  w: number;
  h: number;
  caption?: string;
  device?: string;
};
export type Compare = { type: 'compare'; caption?: string; before: Media; after: Media; labels?: [string, string] };
export type Shot = Media | Compare | { type: 'pair'; caption?: string; items: Media[] };
/* An article is a list of blocks: a paragraph, a heading, or a screen.
   `text` is a paragraph with links in it, plain strings and [label, href] pairs. */
export type Block = string | { h: string } | { stats: [string, string][] } | { role: [string, string] } | { list: string[] } | { text: (string | [string, string])[] } | Shot;
export type Project = {
  slug: string;
  name: string;
  role: string;
  when: string;
  line: string;
  url: string;
  tile: Media;
  shots: Shot[];
  notes?: string[];
  body?: Block[];
};

export const brand = (slug: string) => BRAND[slug] ?? { color: '#222', ink: '#fff', name: slug, wordmark: false };

/* A frame waiting for its image shimmers (details.css). Off screen that
   shimmer is never seen, but it would still repaint the article, and the
   bent glass over it, every frame; so it only runs while in view. */
let shimmer: IntersectionObserver | null = null;
const watchShimmer = (el: HTMLElement | null) => {
  if (!el || typeof IntersectionObserver === 'undefined') return undefined;
  shimmer ??= new IntersectionObserver((entries) => {
    for (const e of entries) (e.target as HTMLElement).style.animationPlayState = e.isIntersecting ? '' : 'paused';
  });
  shimmer.observe(el);
  /* once the image is in, there is nothing left to watch */
  const img = el.querySelector('img');
  const done = () => shimmer?.unobserve(el);
  if (!img || img.complete) done();
  else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
  return done;
};

/* Videos that open on a dark intro (measured by sampling their frames):
   they start, and loop back to, the moment the picture is up, so the
   slot never shows a black frame. */
const START: Record<string, number> = { '/work/wedge/site-intro-manifesto.mp4': 2.3 };

/* One image or video. Images open full size, videos loop while on screen,
   over a still of their picture until they are actually playing. */
export function Frame({ m, alt, sizes, onZoom }: { m: Media; alt: string; sizes: string; onZoom: (src: string, alt: string) => void }) {
  const tall = m.h > m.w;
  const style = { aspectRatio: `${m.w} / ${m.h}` };
  if (m.type === 'video') {
    return (
      <div className={`frame${tall ? ' tall' : ''}`} style={style}>
        {m.poster && <img className="frame-poster" src={m.poster} alt="" aria-hidden="true" width={m.w} height={m.h} decoding="async" />}
        <video data-auto muted loop={!START[m.src]} playsInline preload="none" poster={m.poster} width={m.w} height={m.h} aria-label={alt}
          onLoadedMetadata={(e) => { const s = START[m.src]; if (s && e.currentTarget.currentTime < s) e.currentTarget.currentTime = s; }}
          onTimeUpdate={(e) => { const v = e.currentTarget; if (!v.paused && v.currentTime >= (START[m.src] ?? 0)) v.classList.add('is-live'); }}
          onEnded={(e) => { const v = e.currentTarget; v.currentTime = START[m.src] ?? 0; v.play().catch(() => {}); }}>
          <source src={m.src} type="video/mp4" />
        </video>
      </div>
    );
  }
  return (
    <button type="button" ref={watchShimmer} className={`frame${tall ? ' tall' : ''}`} style={style} onClick={() => onZoom(m.src, alt)} aria-label={`View larger, ${alt}`}>
      <img
        src={m.small}
        srcSet={`${m.small} ${tall ? 400 : 800}w, ${m.src} ${tall ? 780 : 1600}w`}
        sizes={sizes}
        width={m.w}
        height={m.h}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}

/* Before and after, one over the other, with a handle to drag across.
   A range input under the hood, so it works with keys and touch too. */
export function Compare({ c, alt }: { c: Compare; alt: string }) {
  const [x, setX] = useState(50);
  const [a, b] = c.labels ?? ['Before', 'After'];
  const pic = (m: Media, label: string) => (
    <img src={m.src} srcSet={m.small ? `${m.small} 1200w, ${m.src} 2880w` : undefined} sizes="(min-width: 1000px) 820px, 92vw"
      width={m.w} height={m.h} alt={`${alt}, ${label.toLowerCase()}`} loading="lazy" decoding="async" draggable={false} />
  );
  return (
    <div className="compare" style={{ aspectRatio: `${c.after.w} / ${c.after.h}`, '--x': `${x}%` } as React.CSSProperties}>
      {pic(c.after, b)}
      <div className="compare-before">{pic(c.before, a)}</div>
      <span className="compare-tag left">{a}</span>
      <span className="compare-tag right">{b}</span>
      <span className="compare-handle" aria-hidden="true" />
      <input type="range" min={0} max={100} step={0.1} value={x} aria-label={`${a} and ${b}, drag to compare`}
        onChange={(e) => setX(parseFloat(e.target.value))} />
    </div>
  );
}

/* A project's mark at the size of a line of text, for the guide, the
   article's title and the chat's cards. It draws in the text's colour;
   the brand colour is set by the place it sits in. Decorative, the name
   beside it says what it is. */
export function Mini({ slug }: { slug: string }) {
  return <span className="mini" aria-hidden="true"><ProjectLogo slug={slug} size={17} /></span>;
}

/* Every brand's mark, hidden. The screen draws the open one from it as
   glowing phosphor. It never changes, so it is drawn once. */
export const Marks = memo(function Marks({ slugs }: { slugs: string[] }) {
  return (
    <div className="marks" hidden aria-hidden="true">
      {slugs.map((s) => <span key={s} data-mark={s}><ProjectLogo slug={s} size={64} color="#fff" /></span>)}
    </div>
  );
});
