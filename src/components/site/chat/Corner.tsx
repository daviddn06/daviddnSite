/* History, in the guide (the sidebar), under the channels and above the
   links: Live.tsx renders it beside the chat and it is drawn into the
   guide's `#crt-history-slot` (App.tsx), so it scrolls with the guide
   and sits on the same curved layer, on phones too.

   Composed like the guide's channels: New message at the top, then every
   past conversation, newest first, numbered in the order they were
   started (so a chat keeps its number), titled by its first question,
   with how long ago it was last used. The one on screen is marked; with a
   fresh chat on screen, New message is. Up and down move through it,
   Enter opens. Long lists scroll inside it. It appears once there is
   something in it.

   Only opacity and transform move, and only when something changes. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ago, nameOf, when, type Convo } from './store';

type Props = {
  chats: Convo[];
  current: string;
  /* the conversation on screen has nothing in it yet */
  fresh: boolean;
  onNew: () => void;
  onPick: (c: Convo) => void;
  /* chats taken out of this browser (the one on screen among them, then
     a new one starts) */
  onRemove: (ids: string[] | 'all') => void;
};

const GONE = 220;

export function Corner({ chats, current, fresh, onNew, onPick, onRemove }: Props) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById('crt-history-slot')); }, []);
  /* once drawn, the server's copy in the guide can go (App.tsx) */
  useEffect(() => { if (slot) dispatchEvent(new Event('dd-history-live')); }, [slot]);
  const nav = useRef<HTMLElement>(null);
  /* with chats: the label, the rows and Clear history; with none, only
     New chat stays */
  const on = chats.length > 0;

  /* rows that arrive after the list is first drawn rise in */
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null && chats.length) seen.current = new Set(chats.map((c) => c.id));
  useEffect(() => { chats.forEach((c) => seen.current?.add(c.id)); }, [chats]);

  /* "5m" becomes "6m": a quiet redraw once a minute while it shows */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [on, chats]);

  /* rows fold away, then go */
  const [going, setGoing] = useState<Set<string>>(() => new Set());
  const [asking, setAsking] = useState(false);
  const quick = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [fading, setFading] = useState(false);
  const remove = (ids: string[] | 'all') => {
    setAsking(false);
    /* everything at once: the rows fade one after another, then the
       whole block folds away (CSS) */
    if (ids === 'all' || ids.length >= chats.length) {
      setFading(true);
      const n = Math.min(chats.length, 8);
      window.setTimeout(() => { onRemove(ids); setFading(false); }, quick() ? 0 : 140 + n * 25);
      return;
    }
    setGoing(new Set(ids));
    window.setTimeout(() => { onRemove(ids); setGoing(new Set()); }, quick() ? 0 : GONE);
  };
  /* while the block folds away it keeps showing what it held */
  const last = useRef(chats);
  if (chats.length) last.current = chats;
  const shown = chats.length ? chats : last.current;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...(nav.current?.querySelectorAll<HTMLButtonElement>('.hist-new, .hist-row') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    e.stopPropagation();
    rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  if (!slot) return null;
  return createPortal(
    <nav ref={nav} className="crt-history" data-on={on ? '' : undefined} data-fading={fading || !on ? '' : undefined} aria-labelledby="h-chats" onKeyDown={onKey}>
      <div className="hist-tray">
        <h2 id="h-chats" className="label">Chats</h2>
        <NewChat onClick={onNew} />
        {/* the rows and Clear history fold away when there are none */}
        <div className="hist-fold" inert={!on || undefined}>
          <div className="hist-fold-in">
            <ul className="hist-list">
              {shown.map((c, i) => (
                <li key={c.id} style={{ '--n': Math.min(i, 8) } as React.CSSProperties} className={`${seen.current && !seen.current.has(c.id) ? 'is-new' : ''}${going.has(c.id) ? ' is-going' : ''}` || undefined}>
                  <button type="button" className="hist-row" aria-current={c.id === current && !fresh ? 'true' : undefined}
                    aria-label={`${nameOf(c)}, ${when(c.updated)}`} onClick={() => onPick(c)}>
                    <svg className="hist-glyph" viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><path d="M2.5 3.5a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H6.5L4 11.5V9a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                    <span className="hist-title"><span key={nameOf(c)} className="hist-name">{nameOf(c)}</span></span>
                    <span className="hist-when" aria-hidden="true">{ago(c.updated, now)}</span>
                  </button>
                  <button type="button" className="hist-del" aria-label={`Delete ${nameOf(c)}`} title="Delete from this browser" onClick={() => remove([c.id])}>
                    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hist-foot" data-asking={asking ? '' : undefined}>
              {asking ? <>
                <span className="hist-ask">Removes them from this browser.</span>
                <button type="button" className="hist-act is-yes" autoFocus onClick={() => remove('all')}>Clear</button>
                <button type="button" className="hist-act" onClick={() => setAsking(false)}>Cancel</button>
              </> : (
                <button type="button" className="hist-act" onClick={() => setAsking(true)}>Clear history</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>,
    slot,
  );
}

/* a row on the guide's grid: the mark's column, the name's column, and
   the shortcut at the end on hover */
function NewChat({ onClick }: { onClick?: () => void }) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button type="button" className="hist-new" onClick={onClick} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
      <span className="hist-new-mark" aria-hidden="true">
        <svg viewBox="0 0 18 18" width="17" height="17"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v6.5a1.5 1.5 0 0 1-1.5 1.5H8l-3.5 3v-3a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M9 5.6v4.3M6.85 7.75h4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </span>
      <span className="hist-new-name">New chat</span>
      <kbd className="hist-new-key" aria-hidden="true">{mac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}

/* What the guide holds before the chat's code has loaded (App.tsx renders
   it on the server): the empty state, New chat alone, exactly as the live
   one first draws it, so nothing pops. The live list takes its place the
   moment it arrives (chat.css); a click before then is passed on. */
export function HistoryShell() {
  return (
    <nav className="crt-history hist-static" aria-labelledby="h-chats-ssr">
      <div className="hist-tray">
        <h2 id="h-chats-ssr" className="label">Chats</h2>
        <NewChat onClick={() => dispatchEvent(new Event('dd-new-chat'))} />
      </div>
    </nav>
  );
}
