/* daviddn.dev. The whole page is an old CRT. The screen shows a calm
   field of colour; David's name, a line about him and his work sit on
   the glass like a TV's on screen display, every project a channel. A
   chat sits in the middle of the screen.

   Hovering a channel blends the field into that project's colours.
   Choosing one changes the channel like a set would: a burst of static
   and a vertical roll, and under the static the picture becomes the
   article, the project's logo glowing in the strip beside it. Switching,
   and closing (choosing it again, or Escape), change the channel the same
   way. Up and down step through the channels. The address follows
   (/projects/<slug>/), so Back, Forward, reload and shared links land on
   the same view. Under 1000px the guide fills the screen and an article
   takes it over, by the same change. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRAND } from '../logos/brand';
import { DEFAULT_PALETTE, DEFAULT_PALETTE_LIGHT, Field, SWAP, brandAccent, brandPalette } from './Field';
import { Static } from './Static';
import { Marks, type Project } from './Media';
import { Panel } from './Panel';
import { Chat } from './chat/Chat';

type Props = { work: Project[]; projects: Project[]; earlier: Project[]; initial: string | null };

const LINKS = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/daviddn' },
  { label: 'GitHub', url: 'https://github.com/daviddn06' },
  { label: 'Email', url: 'mailto:daviddn@usc.edu' },
  { label: 'Privacy', url: '/privacy/' },
];

const slugOf = (path: string) => path.match(/^\/projects\/([^/]+)\/?$/)?.[1] ?? null;

/* the time in the guide's header strip, like a set's on screen clock;
   blank until the page runs so the server and the browser agree */
function Clock() {
  const [now, setNow] = useState('');
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = window.setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return <span className="osd-clock" aria-hidden="true">{now}</span>;
}

export default function App({ work, projects, earlier, initial }: Props) {
  const all = useMemo(() => [...work, ...projects, ...earlier], [work, projects, earlier]);
  const sections = useMemo(() => [
    { id: 'work', title: 'Work', items: work },
    { id: 'projects', title: 'Projects', items: projects },
    { id: 'earlier', title: 'Earlier', items: earlier },
  ], [work, projects, earlier]);

  /* `open` is the channel asked for (the guide, the address, the keys
     follow it at once); `tuned` is what the screen shows, which changes
     halfway through a channel change, under the static. `shown` is what
     the article holds; it keeps its project after the screen moves on. */
  const [open, setOpen] = useState<string | null>(initial);
  const [tuned, setTuned] = useState<string | null>(initial);
  const [shown, setShown] = useState<string | null>(initial);
  useEffect(() => { if (tuned) setShown(tuned); }, [tuned]);
  /* counts channel changes, for the static and the roll */
  const [tune, setTune] = useState(0);
  const swap = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  const [ready, setReady] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setReady(true)); }, []);

  const show = useCallback((s: string | null, push = true) => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (s === openRef.current) return;
    setOpen(s);
    openRef.current = s;
    clearTimeout(swap.current);
    if (still) setTuned(s);
    else {
      setTune((n) => n + 1);
      swap.current = window.setTimeout(() => setTuned(openRef.current), SWAP);
    }
    const p = all.find((x) => x.slug === s);
    document.title = p ? `${p.name}, David Nguyen` : 'David Nguyen';
    if (push) {
      const url = s ? `/projects/${s}/` : '/';
      if (location.pathname !== url) history.pushState({ slug: s }, '', url);
    }
  }, [all]);

  useEffect(() => {
    const onPop = () => show(slugOf(location.pathname), false);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [show]);

  /* phones: the article owns scrolling while it is up */
  useEffect(() => {
    const narrow = matchMedia('(max-width: 999px)').matches;
    document.documentElement.style.overflow = tuned && narrow ? 'hidden' : '';
  }, [tuned]);

  /* the full size viewer */
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (zoom && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [zoom]);
  const unzoom = () => { dialog.current?.close(); setZoom(null); };

  /* Escape closes, arrows step through everything in order */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoom || e.metaKey || e.ctrlKey || e.altKey || !open) return;
      /* never while typing, or while the chat has focus */
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], .crt-slot')) return;
      if (e.key === 'Escape') { e.preventDefault(); show(null); return; }
      const i = all.findIndex((p) => p.slug === open);
      if (e.key === 'ArrowDown' && i < all.length - 1) { e.preventDefault(); show(all[i + 1].slug); }
      if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); show(all[i - 1].slug); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, zoom, all, show]);

  /* Hover. A short grace on leaving, so moving between names never
     dips back through the resting colours. */
  const [hot, setHot] = useState<string | null>(null);
  const timer = useRef(0);
  const enter = (s: string, e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    setHot(s);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHot(null), 160);
  };

  const [light, setLight] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)');
    const sync = () => setLight(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* how much of the screen the article needs: the guide beside it and
     its own column, measured to the column's right edge */
  const [col, setCol] = useState(0);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.article');
    if (!el) return;
    const narrow = matchMedia('(max-width: 999px)');
    const sync = () => setCol(narrow.matches ? 0 : el.offsetLeft + el.offsetWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    narrow.addEventListener('change', sync);
    return () => { ro.disconnect(); narrow.removeEventListener('change', sync); };
  }, []);
  const cut = tuned ? col : 0;

  /* the open project's colour becomes the accent for every link and mark */
  const accent = open && BRAND[open] ? brandAccent(BRAND[open].color, light) : null;

  /* the open project owns the colours; hover previews only when nothing is open */
  const focus = tuned ?? (open ? null : hot);
  const palette = useMemo(
    () => (focus && BRAND[focus] ? brandPalette(BRAND[focus].color, light) : light ? DEFAULT_PALETTE_LIGHT : DEFAULT_PALETTE),
    [focus, light],
  );

  /* channel numbers follow the order of the guide */
  const channel = (slug: string) => String(all.findIndex((p) => p.slug === slug) + 1).padStart(2, '0');

  return (
    <div className={`stage${tuned ? ' is-open' : ''}${ready ? ' ready' : ''}`}
      style={accent ? ({ '--link': accent } as React.CSSProperties) : undefined}>
      <Marks slugs={all.map((p) => p.slug)} />
      <div className="tube">
        <Panel
          p={all.find((x) => x.slug === shown) ?? null}
          channel={shown ? channel(shown) : ''}
          open={!!tuned}
          onClose={() => show(null)}
          onZoom={(src, alt) => setZoom({ src, alt })}
        />
        <main className="main">
          <Field palette={palette} mark={tuned} cut={cut} tune={tune} />
        </main>
        {/* the static of a channel change, over the picture and the article */}
        <Static tune={tune} />

        {/* The on screen display: a panel on the glass like a TV's channel
            guide. A header strip (name and the time), a line about David,
            the channels in three sections with the open one on a
            selection bar, and the links at the foot. */}
        <header className="osd" data-calm="0.35">
          <div className="osd-panel">
            <div className="osd-top">
              <h1 className="name">David Nguyen</h1>
              <Clock />
            </div>
            <p className="bio">I design and build software products. Business at USC Marshall, minoring in Designing for Digital Experiences.</p>

            <nav className="lists" onPointerLeave={leave} aria-label="Work and projects">
              {sections.map((s) => (
                <section key={s.id} aria-labelledby={`h-${s.id}`}>
                  <h2 id={`h-${s.id}`} className="label">{s.title}</h2>
                  <ul>
                    {s.items.map((p) => (
                      <li key={p.slug}>
                        <a
                          className={`channel${open === p.slug ? ' active' : ''}`}
                          href={`/projects/${p.slug}/`}
                          aria-current={open === p.slug ? 'page' : undefined}
                          onPointerEnter={(e) => enter(p.slug, e)}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                            e.preventDefault();
                            show(open === p.slug ? null : p.slug);
                          }}
                        >
                          <span className="ch" aria-hidden="true">{channel(p.slug)}</span>
                          <span className="ch-name">{p.name}</span>
                          {open === p.slug && (
                            <svg className="x" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </nav>

            <ul className="links">
              {LINKS.map((l) => (
                <li key={l.label}><a className="link" href={l.url} target={l.url.startsWith('http') ? '_blank' : undefined} rel="noopener">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </header>

        {/* the chat, in the middle of the screen (#crt-chat-slot, see .crt-slot) */}
        <Chat all={all} sections={sections} open={tuned} show={show} />

        {/* the glass over everything: scanlines, the tube's edge, a reflection */}
        <div className="glass" aria-hidden="true" />
      </div>

      <dialog ref={dialog} className="viewer" aria-label="Full size image"
        onClick={unzoom} onCancel={(e) => { e.preventDefault(); unzoom(); }}>
        {zoom && <img src={zoom.src} alt={zoom.alt} />}
      </dialog>
    </div>
  );
}
