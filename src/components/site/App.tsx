/* daviddn.dev. The whole page is an old CRT. The screen shows a calm
   field of colour; David's name, a line about him and his work sit on
   the glass like a TV's on screen display, every project a channel
   marked by its own logo. A
   chat sits in the middle of the screen.

   Hovering a channel blends the field into that project's colours.
   Choosing one slides the article in: the picture's edge sweeps across
   as a bright line of phosphor with a short afterglow, the article
   easing in behind it, the project's logo glowing in the strip that
   remains. Closing (choosing it again, or Escape) slides it back out;
   switching wipes the new article in over the old with the same line.
   Up and down step through the channels. The address follows
   (/projects/<slug>/), so Back, Forward, reload and shared links land on
   the same view. Under 1000px the guide fills the screen and an article
   slides up over it. */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRAND } from '../logos/brand';
import { DEFAULT_PALETTE, DEFAULT_PALETTE_LIGHT, Field, WIPE, brandAccent, brandPalette } from './Field';
import { curve } from './warp';
import { Marks, Mini, type Project } from './Media';
import { Panel } from './Panel';
import { Chat } from './chat/Chat';

type Props = { work: Project[]; projects: Project[]; earlier: Project[]; initial: string | null };

const LINKS = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/daviddn' },
  { label: 'GitHub', url: 'https://github.com/daviddn06' },
  { label: 'Email', url: 'mailto:daviddn@usc.edu' },
  { label: 'Privacy', url: '/privacy/' },
];

const NOOP = () => {};
const slugOf = (path: string) => path.match(/^\/projects\/([^/]+)\/?$/)?.[1] ?? null;

/* the time in the guide's header strip, like a set's on screen clock;
   blank until the page runs so the server and the browser agree */
const Clock = memo(function Clock() {
  const [now, setNow] = useState('');
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    /* once a minute, as the minute turns, and again on coming back to the tab */
    let id = 0;
    const tick = () => {
      const d = new Date();
      setNow(fmt.format(d));
      clearTimeout(id);
      id = window.setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    tick();
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <span className="osd-clock" aria-hidden="true">{now}</span>;
});

export default function App({ work, projects, earlier, initial }: Props) {
  const all = useMemo(() => [...work, ...projects, ...earlier], [work, projects, earlier]);
  const sections = useMemo(() => [
    { id: 'work', title: 'Work', items: work },
    { id: 'projects', title: 'Projects', items: projects },
    { id: 'earlier', title: 'Earlier', items: earlier },
  ], [work, projects, earlier]);
  const slugs = useMemo(() => all.map((p) => p.slug), [all]);

  /* `open` is the project on screen; `shown` is what the article holds
     (it keeps its project while the screen covers it again). Switching
     between projects wipes the new article in over the old one, so for
     a moment `leaving` holds the old one underneath. */
  const [open, setOpen] = useState<string | null>(initial);
  const [shown, setShown] = useState<string | null>(initial);
  const [leaving, setLeaving] = useState<string | null>(null);
  const swap = useRef(0);
  const leavingAt = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [ready, setReady] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setReady(true)); }, []);
  /* everything on the screen bends with the glass (warp.ts) */
  const tube = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tube.current;
    if (!el) return;
    const stop = curve(el);
    el.dataset.curved = '';
    return stop;
  }, []);

  const show = useCallback((s: string | null, push = true) => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = matchMedia('(max-width: 999px)').matches;
    const was = openRef.current;
    if (s === was) return;
    setOpen(s);
    openRef.current = s;
    if (s) {
      clearTimeout(swap.current);
      if (was && shownRef.current && !still && !narrow) {
        leavingAt.current = document.querySelector('.article:not(.is-leaving)')?.scrollTop ?? 0;
        setLeaving(shownRef.current);
        swap.current = window.setTimeout(() => setLeaving(null), WIPE + 80);
      } else setLeaving(null);
      setShown(s);
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

  const close = useCallback(() => show(null), [show]);

  /* phones: the article owns scrolling while it is up */
  useEffect(() => {
    const narrow = matchMedia('(max-width: 999px)').matches;
    document.documentElement.style.overflow = open && narrow ? 'hidden' : '';
  }, [open]);

  /* the full size viewer */
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const onZoom = useCallback((src: string, alt: string) => setZoom({ src, alt }), []);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (zoom && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [zoom]);
  /* closing, the picture switches off like a set (a bright line, then
     nothing) before the dialog goes; with reduced motion it just goes */
  const closing = useRef(0);
  const unzoom = () => {
    const d = dialog.current;
    if (!d || !d.open || d.classList.contains('closing')) return;
    const done = () => { d.classList.remove('closing'); d.close(); setZoom(null); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    d.classList.add('closing');
    clearTimeout(closing.current);
    closing.current = window.setTimeout(done, 260);
  };

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
  const cut = open ? col : 0;
  /* the chat moves to the strip as an article opens, and back to the
     middle only once the picture has covered the article again */
  const [chatOpen, setChatOpen] = useState(open);
  useEffect(() => {
    if (open) { setChatOpen(open); return; }
    const t = window.setTimeout(() => setChatOpen(null), WIPE);
    return () => clearTimeout(t);
  }, [open]);

  /* the open project's colour becomes the accent for every link and mark */
  const accent = open && BRAND[open] ? brandAccent(BRAND[open].color, light) : null;

  /* the open project owns the colours; hover previews only when nothing is open */
  const focus = open ?? hot;
  const palette = useMemo(
    () => (focus && BRAND[focus] ? brandPalette(BRAND[focus].color, light) : light ? DEFAULT_PALETTE_LIGHT : DEFAULT_PALETTE),
    [focus, light],
  );

  /* each project's colour, readable as text, for its mark on hover */
  const tint = (slug: string) => (BRAND[slug] ? brandAccent(BRAND[slug].color, light) : undefined);

  return (
    <div className={`stage${open ? ' is-open' : ''}${ready ? ' ready' : ''}`}
      style={accent ? ({ '--link': accent } as React.CSSProperties) : undefined}>
      <Marks slugs={slugs} />
      <div className="tube" ref={tube}>
        {/* under the picture, shown where it gives way: the article */}
        <div className="under on-glass">
        {/* switching: the old article stays put underneath while the new
            one is wiped in over it */}
        {leaving && (
          <Panel
            key={`was-${leaving}`}
            p={all.find((x) => x.slug === leaving) ?? null}
            open={false}
            leaving
            startAt={leavingAt.current}
            onClose={NOOP}
            onZoom={NOOP}
          />
        )}
        <Panel
          p={all.find((x) => x.slug === shown) ?? null}
          open={!!open}
          wipe={!!leaving}
          onClose={close}
          onZoom={onZoom}
        />
        {/* the wipe's leading edge, a line of phosphor with a short trail */}
        {leaving && <div className="wipe-line" key={`wipe-${shown}`} aria-hidden="true" />}
        </div>
        <main className="main">
          <Field palette={palette} mark={open} cut={cut} />
        </main>

        {/* over the picture, drawn into it: the guide, the chat, and the
            scanlines that cross everything on the screen */}
        <div className="over on-glass">

        {/* The on screen display: a panel on the glass like a TV's channel
            guide. A header strip (name and the time), a line about David,
            the channels (each with its logo) in three sections, the open one on a
            selection bar, and the links at the foot. */}
        <header className="osd">
          <div className="osd-panel" data-calm="0.9">
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
                          style={{ '--tint': tint(p.slug) } as React.CSSProperties}
                          href={`/projects/${p.slug}/`}
                          aria-current={open === p.slug ? 'page' : undefined}
                          onPointerEnter={(e) => enter(p.slug, e)}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                            e.preventDefault();
                            show(open === p.slug ? null : p.slug);
                          }}
                        >
                          <Mini slug={p.slug} />
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

            {/* the chat's history, drawn here by chat/Corner.tsx */}
            <div id="crt-history-slot" />

            <ul className="links">
              {LINKS.map((l) => (
                <li key={l.label}><a className="link" href={l.url} target={l.url.startsWith('http') ? '_blank' : undefined} rel="noopener">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </header>

        {/* the chat, in the middle of the screen (#crt-chat-slot, see .crt-slot) */}
        <Chat all={all} sections={sections} open={chatOpen} show={show} />
        <div className="lines" aria-hidden="true" />
        </div>

        {/* the glass itself, flat over everything: the tube's edge falling
            into shadow, the corners darker, a reflection high on the left */}
        <div className="glass" aria-hidden="true" />
      </div>

      <dialog ref={dialog} className="viewer" aria-label="Full size image"
        onClick={unzoom} onCancel={(e) => { e.preventDefault(); unzoom(); }}>
        {zoom && <img src={zoom.src} alt={zoom.alt} />}
      </dialog>
    </div>
  );
}
