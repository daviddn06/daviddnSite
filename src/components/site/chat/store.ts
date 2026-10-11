/* The visitor's past conversations, kept in this browser only
   (localStorage `dd_chats`). Every page load starts a new conversation;
   the ones before it stay here to read and continue from the History
   menu. Coming Back to the page (the browser's back button, from the
   resume or the privacy page) picks the last one up again, since that is
   not a fresh visit. */
import type { ThreadMessageLike } from '@assistant-ui/react';

const KEY = 'dd_chats';
/* the conversation this tab is in, for coming Back to it */
const CURRENT = 'dd_chat_cur';
const MAX_CHATS = 30;
const MAX_MESSAGES = 40;

export type Stored = { id: string; role: 'user' | 'assistant'; content: Exclude<ThreadMessageLike['content'], string>[number][] };
/* `topic` is the short title the server gives a conversation (1 to 4
   words); older chats have only `title`, their first question */
export type Convo = { id: string; title: string; topic?: string; at: number; updated: number; messages: Stored[] };
export const nameOf = (c: Pick<Convo, 'title' | 'topic'>) => c.topic || c.title;

export const newId = () => {
  try { return crypto.randomUUID(); } catch { return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
};

export const listChats = (): Convo[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Convo[]) : [];
    return Array.isArray(list) ? list.filter((c) => c && c.id && Array.isArray(c.messages)).sort((a, b) => b.updated - a.updated) : [];
  } catch { return []; }
};

export const getChat = (id: string) => listChats().find((c) => c.id === id) ?? null;

export const putChat = (c: Convo) => {
  const list = [c, ...listChats().filter((x) => x.id !== c.id)].slice(0, MAX_CHATS);
  list[0] = { ...c, messages: c.messages.slice(-MAX_MESSAGES) };
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
  dispatchEvent(new Event('dd-chats'));
};

/* forgetting chats only takes them out of this browser; the server keeps
   its own record, as the privacy page says */
export const removeChats = (ids: string[] | 'all') => {
  const keep = ids === 'all' ? [] : listChats().filter((c) => !ids.includes(c.id));
  try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch { /* blocked */ }
  dispatchEvent(new Event('dd-chats'));
};

export const setCurrent = (id: string) => {
  try { sessionStorage.setItem(CURRENT, id); } catch { /* blocked */ }
};

/* the conversation to start with: the last one when coming Back, else a
   new one */
export const firstChat = (): Convo | null => {
  try {
    sessionStorage.removeItem('dd_chat'); /* the old per tab store */
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== 'back_forward') return null;
    const id = sessionStorage.getItem(CURRENT);
    return id ? getChat(id) : null;
  } catch { return null; }
};

export const titleOf = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 64 ? `${t.slice(0, 62).trimEnd()}…` : t;
};

/* date formats, made once: building one costs more than a whole list of rows */
const FMT = new Map<string, Intl.DateTimeFormat>();
const fmt = (o: Intl.DateTimeFormatOptions) => {
  const k = JSON.stringify(o);
  let f = FMT.get(k);
  if (!f) FMT.set(k, (f = new Intl.DateTimeFormat(undefined, o)));
  return f;
};

/* "Today, 9:25 PM", "Yesterday", "Oct 8" */
export const when = (t: number) => {
  const d = new Date(t), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return fmt({ hour: 'numeric', minute: '2-digit' }).format(d);
  if (diff === 1) return 'Yesterday';
  return fmt({ month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }).format(d);
};

/* how long ago, as short as a set's guide: "now", "5m", "2h",
   "Yesterday", "3d", then the date */
export const ago = (t: number, now = Date.now()) => {
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d`;
  return fmt({ month: 'short', day: 'numeric' }).format(new Date(t));
};
