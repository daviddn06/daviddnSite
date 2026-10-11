/* History in the bottom right corner of the screen (Live.tsx renders it
   beside the chat, on the same curved layer as the guide).

   On a wide screen with nothing open it is a standing list, composed like
   the guide's channels: New chat at the top, then every past
   conversation, newest first, numbered in the order they were started
   (so a chat keeps its number), titled by its first question, with how
   long ago it was last used. The one on screen is marked; with a fresh
   chat on screen, New chat is. Up and down move through it, Enter opens.
   It scrolls when long and appears once there is something in it.

   Where there is no room for it (a project open, so the strip is narrow,
   or a narrower window) it folds into a small History toggle in the same
   corner, which opens the list over the conversation. Phones reach it
   from the chat bar instead (see Composer in Live.tsx).

   Only opacity and transform move, and only when something changes. */
import { useEffect, useRef, useState } from 'react';
import { ago, when, type Convo } from './store';

export type CornerLayout = 'full' | 'toggle' | 'none';

type Props = {
  layout: CornerLayout;
  /* where the chat sits, so the toggle can sit clear of it */
  place: string;
  /* the toggle steps aside while the chat's own sheet is open */
  away: boolean;
  chats: Convo[];
  current: string;
  /* the conversation on screen has nothing in it yet */
  fresh: boolean;
  onNew: () => void;
  onPick: (c: Convo) => void;
  onOpen: () => void;
};

export function Corner({ layout, place, away, chats, current, fresh, onNew, onPick, onOpen }: Props) {
  const full = layout === 'full' && chats.length > 0;
  const toggle = layout === 'toggle' && chats.length > 0 && !away;

  /* rows that arrive after the list is first drawn rise in */
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null && chats.length) seen.current = new Set(chats.map((c) => c.id));
  useEffect(() => { chats.forEach((c) => seen.current?.add(c.id)); }, [chats]);

  /* "5m" becomes "6m": a quiet redraw once a minute while it shows */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!full) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [full, chats]);

  const list = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>('.hist-row') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  return (
    <>
      <nav ref={list} className="crt-history" data-on={full ? '' : undefined} aria-label="Chat history" aria-hidden={!full} inert={!full || undefined} onKeyDown={onKey}>
        <p className="hist-label">History</p>
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
      </nav>
      <button type="button" className="hist-toggle" data-on={toggle ? '' : undefined} data-where={place} tabIndex={toggle ? 0 : -1}
        aria-hidden={!toggle} onClick={onOpen}>
        History<span className="hist-count">{chats.length}</span>
      </button>
    </>
  );
}
