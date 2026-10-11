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
import { ago, when, type Convo } from './store';

type Props = {
  chats: Convo[];
  current: string;
  /* the conversation on screen has nothing in it yet */
  fresh: boolean;
  onNew: () => void;
  onPick: (c: Convo) => void;
};

export function Corner({ chats, current, fresh, onNew, onPick }: Props) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById('crt-history-slot')); }, []);
  const nav = useRef<HTMLElement>(null);
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

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...(nav.current?.querySelectorAll<HTMLButtonElement>('.hist-row') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    e.stopPropagation();
    rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  if (!slot) return null;
  return createPortal(
    <nav ref={nav} className="crt-history" data-on={on ? '' : undefined} aria-label="Chat history" aria-hidden={!on} inert={!on || undefined} onKeyDown={onKey}>
      <h2 className="hist-label">History</h2>
      <button type="button" className="hist-row hist-new" aria-current={fresh ? 'true' : undefined} onClick={onNew}>
        <span className="ch" aria-hidden="true">
          <svg viewBox="0 0 12 12" width="10" height="10"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </span>
        <span className="hist-title">New chat</span>
      </button>
      <ul className="hist-list">
        {chats.map((c, i) => (
          <li key={c.id} className={seen.current && !seen.current.has(c.id) ? 'is-new' : undefined}>
            <button type="button" className="hist-row" aria-current={c.id === current && !fresh ? 'true' : undefined}
              aria-label={`${c.title}, ${when(c.updated)}`} onClick={() => onPick(c)}>
              <span className="ch" aria-hidden="true">{String(chats.length - i).padStart(2, '0')}</span>
              <span className="hist-title">{c.title}</span>
              <span className="hist-when" aria-hidden="true">{ago(c.updated, now)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>,
    slot,
  );
}
