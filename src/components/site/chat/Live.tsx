/* The live chat (see Chat.tsx): assistant-ui's runtime and primitives
   with the site's adapter. It is loaded on its own, right after the page
   starts, so the rest of the screen does not wait for it; until it is
   here the still copy in Chat.tsx holds its place. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  useSmooth,
  type AssistantRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { chatAdapter, MAX_CHARS, type Context } from './adapter';
import { SiteContext, ToolCard, type Site } from './cards';
import { listChats, nameOf, newId, putChat, removeChats, setCurrent, titleOf, when, type Convo, type Stored } from './store';
import { NARROW, noteFor, placeholderFor, still, type Mode } from './shared';
import { Corner } from './Corner';
import { ModelPicker } from './Model';
import { NEAR, readQuota, writeQuota, type Quota } from './quota';
import { CONTACT } from './cards';
import { Chip, CiteContext, MARK, Sources, citesOf, holdPartial, useGo, type Cite } from './cite';
import type { Project } from '../Media';

/* the line above the box, one picked per new chat, from David himself,
   the way he texts */
const HEADLINES = [
  'ask me about my work.',
  'what do you want to know?',
  "ask me anything about what i've built.",
  "ask what i'm working on right now.",
];
const pickHeadline = (not?: string) => {
  const pool = HEADLINES.filter((h) => h !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};


/* on phones, following a source puts the conversation away so the
   article shows */
const AwayContext = createContext<(() => void) | undefined>(undefined);

/* when the conversation on screen began, so only what arrives after it
   animates in (a conversation reopened from History just appears) */
const Born = createContext<{ current: number }>({ current: 0 });
const useFresh = () => {
  const born = useContext(Born);
  const [fresh] = useState(() => typeof performance !== 'undefined' && performance.now() - born.current > 250);
  return fresh;
};

/* where the visitor is: the heading they are reading in the open
   article, how far down it they are, and the kind of screen */
const readContext = (open: string | null): Context => {
  const viewport = matchMedia(NARROW).matches ? 'phone' : 'desktop';
  const art = open ? document.querySelector<HTMLElement>('.article') : null;
  if (!art) return { section: '', scrolled: 0, viewport };
  const max = art.scrollHeight - art.clientHeight;
  const scrolled = max > 0 ? Math.max(0, Math.min(100, Math.round((art.scrollTop / max) * 100))) : 0;
  const line = art.getBoundingClientRect().top + art.clientHeight * 0.33;
  let section = '';
  art.querySelectorAll<HTMLElement>('h2, h3').forEach((h) => {
    if (h.closest('.article-head')) return;
    if (h.getBoundingClientRect().top <= line) section = (h.textContent ?? '').trim();
  });
  return { section: section.slice(0, 120), scrolled, viewport };
};

/* the conversation as it is kept, and back */
const toStored = (messages: ReturnType<AssistantRuntime['thread']['getState']>['messages']): Stored[] => {
  const list: Stored[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const content: Stored['content'] = [];
    for (const p of m.content) {
      if (p.type === 'text') { if (p.text) content.push({ type: 'text', text: p.text }); }
      else if (p.type === 'tool-call') content.push({ type: 'tool-call', toolCallId: p.toolCallId, toolName: p.toolName, args: p.args, argsText: p.argsText, result: p.result });
    }
    if (content.length) list.push({ id: m.id, role: m.role, content });
  }
  return list;
};
const fromStored = (list: Stored[]): ThreadMessageLike[] =>
  list.map((m) => ({ ...m, status: m.role === 'assistant' ? { type: 'complete', reason: 'unknown' } : undefined }));


export function Live({ first, ...site }: Site & { first: Convo | null }) {
  const siteRef = useRef(site);
  siteRef.current = site;
  const convo = useRef<{ id: string; at: number; topic?: string }>({ id: first?.id ?? newId(), at: first?.at ?? Date.now(), topic: first?.topic });
  /* the conversation's short title, from the server; the later one wins */
  const [topic, setTopic] = useState(first?.topic ?? '');
  const adapter = useMemo(() => chatAdapter({
    cid: () => convo.current.id,
    /* the resume is not a project the server knows; where the visitor is
       in it still goes in the context */
    page: () => siteRef.current.open,
    context: () => readContext(siteRef.current.open),
    act: (name, input) => {
      const s = siteRef.current;
      if (name === 'open_project' && typeof input.slug === 'string' && s.all.some((p) => p.slug === input.slug)) s.show(input.slug);
      if (name === 'close_project') s.show(null);
      if (name === 'show_resume') s.show('cv');
    },
    quota: (left, limit) => writeQuota({ left, limit }),
    title: (t) => { convo.current.topic = t; setTopic(t); },
    limit: (kind, retry, limit) => writeQuota({ left: kind === 'day' ? 0 : readQuota()?.left ?? limit, limit, kind, until: Date.now() + retry * 1000 }),
  }), []);
  const runtime = useLocalRuntime(adapter, { initialMessages: first ? fromStored(first.messages) : [] });
  const born = useRef(typeof performance !== 'undefined' ? performance.now() : 0);

  /* keep the conversation once it has a question in it */
  const kept = useRef(first ? JSON.stringify(first.messages) : '');
  useEffect(() => runtime.thread.subscribe(() => {
    const t = runtime.thread.getState();
    if (t.isRunning) return;
    const messages = toStored(t.messages);
    const ask = messages.find((m) => m.role === 'user');
    if (!ask) return;
    const json = JSON.stringify(messages);
    if (json === kept.current) return;
    kept.current = json;
    const text = ask.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ');
    putChat({ id: convo.current.id, title: titleOf(text), topic: convo.current.topic, at: convo.current.at, updated: Date.now(), messages });
    setCurrent(convo.current.id);
  }), [runtime]);

  /* New chat and History. The conversation on screen fades out, the next
     one is put in its place, and it fades in. */
  const [headline, setHeadline] = useState(() => pickHeadline());
  const [cid, setCid] = useState(convo.current.id);
  const [swap, setSwap] = useState(false);
  const timer = useRef(0);
  const switchTo = useCallback((c: Convo | null) => {
    const run = () => {
      if (runtime.thread.getState().isRunning) runtime.thread.cancelRun();
      convo.current = c ? { id: c.id, at: c.at, topic: c.topic } : { id: newId(), at: Date.now() };
      setTopic(c?.topic ?? '');
      kept.current = c ? JSON.stringify(c.messages) : '';
      born.current = performance.now();
      runtime.thread.reset(c ? fromStored(c.messages) : []);
      if (c) setCurrent(c.id);
      else setHeadline((h) => pickHeadline(h));
      setCid(convo.current.id);
      setSwap(false);
    };
    clearTimeout(timer.current);
    if (still()) { run(); return; }
    setSwap(true);
    timer.current = window.setTimeout(run, 140);
  }, [runtime]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Born.Provider value={born}>
        <Screen open={site.open} all={site.all} headline={headline} cid={cid} named={topic} swap={swap} switchTo={switchTo} />
      </Born.Provider>
    </AssistantRuntimeProvider>
  );
}

/* Where the chat sits now. A change of place between the middle and
   the panel beside an article is small and quiet: the conversation fades
   out where it is (120ms), moves while unseen, and fades in at its new
   place with a 6px rise (site.css's --t-small); changing back midway
   just fades in again where it was. Phones (the bar) and reduced motion
   just switch. Nothing remounts, so the bubbles keep their scroll. */
function usePlace(target: Mode) {
  const [shown, setShown] = useState(target);
  const [fade, setFade] = useState<'out' | 'in' | undefined>();
  useEffect(() => {
    if (target === shown) { setFade((f) => (f === 'out' ? 'in' : f)); return; }
    if (still() || target === 'bar' || shown === 'bar') { setShown(target); return; }
    setFade('out');
    const t = window.setTimeout(() => { setShown(target); setFade('in'); }, 120);
    return () => clearTimeout(t);
  }, [target, shown]);
  return [shown, fade, () => setFade(undefined)] as const;
}

/* keeps something mounted while it animates away */
function usePresence(on: boolean, ms: number) {
  const [mounted, setMounted] = useState(on);
  useEffect(() => {
    if (on) { setMounted(true); return; }
    if (still()) { setMounted(false); return; }
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return mounted || on;
}

type ScreenProps = {
  open: string | null;
  all: Project[];
  headline: string;
  cid: string;
  named: string;
  swap: boolean;
  switchTo: (c: Convo | null) => void;
};

function Screen({ open, all, headline, cid, named, swap, switchTo }: ScreenProps) {
  const slot = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const empty = useAuiState((s) => s.thread.isEmpty);
  const running = useAuiState((s) => s.thread.isRunning);
  const project = all.find((p) => p.slug === open);

  const [narrow, setNarrow] = useState(() => matchMedia(NARROW).matches);
  useEffect(() => {
    const mq = matchMedia(NARROW);
    const sync = () => setNarrow(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [mode, fade, faded] = usePlace(narrow ? 'bar' : open ? 'dock' : 'center');

  /* past conversations, for History */
  const [chats, setChats] = useState<Convo[]>(() => listChats());
  useEffect(() => {
    const sync = () => setChats(listChats());
    addEventListener('dd-chats', sync);
    addEventListener('storage', sync);
    return () => { removeEventListener('dd-chats', sync); removeEventListener('storage', sync); };
  }, []);
  const past = chats.some((c) => c.id !== cid);
  /* newest first by when each was started, so continuing an older chat
     never reshuffles the list under the pointer */
  const ordered = useMemo(() => [...chats].sort((a, b) => b.at - a.at), [chats]);
  /* History is listed in the guide (Corner.tsx), which holds New message
     too, so the chat's own buttons step aside except on phones, where the
     conversation covers the guide */
  const standing = mode !== 'bar';
  const [menu, setMenu] = useState(false);
  const menuShown = usePresence(menu, 200);

  /* in use: focused, answering, or opened on purpose and not yet put away */
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  useEffect(() => { if (running) setPinned(true); }, [running]);
  /* in the dock an empty conversation stays a bar, unless there are past
     chats to reach (then just their button shows above it) */
  const expanded = mode === 'center' || mode === 'dock' || menu || ((focused || pinned) && (mode === 'bar' || !empty || past));

  const focusInput = () => { if (!matchMedia('(hover: none)').matches) input.current?.focus(); };
  const away = () => { setMenu(false); setPinned(false); setFocused(false); input.current?.blur(); };
  const closeMenu = () => { setMenu(false); focusInput(); };
  const fresh = () => { setMenu(false); if (!empty) switchTo(null); focusInput(); };
  const reopen = (c: Convo) => { setMenu(false); setPinned(true); if (c.id !== cid) switchTo(c); focusInput(); };

  /* a click elsewhere on the screen closes History and puts the sheet
     away (not while answering) */
  useEffect(() => {
    if (!menu && (mode === 'center' || !pinned)) return;
    const onDown = (e: PointerEvent) => {
      if (slot.current?.contains(e.target as Node)) return;
      setMenu(false);
      if (!running) setPinned(false);
    };
    addEventListener('pointerdown', onDown);
    return () => removeEventListener('pointerdown', onDown);
  }, [mode, pinned, running, menu]);

  const openMenu = () => { setChats(listChats()); setMenu(true); };
  /* ends the conversation on screen (it stays in History) and goes back
     to the empty chat */
  const closeChat = () => { setMenu(false); setPinned(false); if (!empty) switchTo(null); input.current?.blur(); };

  /* the conversation's title, its first question */
  const asked = useAuiState((s) => {
    const m = s.thread.messages.find((x) => x.role === 'user');
    return m ? m.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ').replace(/\s+/g, ' ').trim() : '';
  });

  /* New chat from anywhere: Command K, or Control K */
  const mac = useMemo(() => /Mac|iPhone|iPad/.test(navigator.platform), []);
  const freshRef = useRef(fresh);
  freshRef.current = fresh;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((mac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); freshRef.current(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [mac]);

  /* Docked beside a project, the project's logo (drawn by the picture,
     crt.ts) follows this chat's \`.crt-logo-spot\`: centred in the panel
     with the headline under it while the chat is empty, up at the top in
     a compact row with the chat's controls once there is a conversation.
     The spot moves by a transform; here it is only measured, when the
     panel changes size. */
  useEffect(() => {
    const el = slot.current;
    if (mode !== 'dock' || !el) return;
    const SPOT = 128, GAP = 14, LINE = 30, TOP = 28, FOOT = 104;
    const place = () => {
      const z = el.offsetTop, h = el.offsetHeight;
      const up = -z / 2 + 6;
      const room = h - FOOT + z - TOP;
      const group = Math.max(-z + TOP, -z + TOP + (room - (SPOT + GAP + LINE)) / 2);
      el.style.setProperty('--spot-top', `${Math.round(up - SPOT / 2)}px`);
      el.style.setProperty('--spot-drop', `${Math.round(Math.max(0, group + SPOT / 2 - up))}px`);
      el.style.setProperty('--row-top', `${Math.round(up - 16)}px`);
      el.style.setProperty('--hello-top', `${Math.round(group + SPOT + GAP)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  return (<>
    <div id="crt-chat-slot" ref={slot} className="crt-slot" data-mode={mode} data-fade={fade}
      data-history={standing ? 'full' : undefined}
      data-expanded={expanded ? '' : undefined}
      data-empty={empty ? '' : undefined}
      data-menu={menu ? '' : undefined}
      data-swap={swap ? '' : undefined}
      data-page={open ?? undefined}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget && e.animationName === 'chat-place-in') faded(); }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!slot.current?.contains(e.relatedTarget as Node)) setFocused(false); }}>
      <AwayContext.Provider value={mode === 'bar' ? away : undefined}>
      <ThreadPrimitive.Root className="chat">
        <div className="chat-sheet">
          {/* once talking: what this chat is about, New chat, and Close */}
          <div className="chat-head" data-on={!empty || mode === 'bar' ? '' : undefined}>
            {mode === 'center' && <p className="chat-topic" title={named || asked}><span key={named || asked}>{named || asked}</span></p>}
            {mode === 'bar' && (
              <button type="button" className="chat-tool" data-kind="history" data-on={past || menu ? '' : undefined} tabIndex={past || menu ? 0 : -1}
                aria-expanded={menu} onClick={() => (menu ? closeMenu() : openMenu())}>
                History
              </button>
            )}
            <button type="button" className="chat-ctl" tabIndex={!empty ? 0 : -1} data-on={!empty ? '' : undefined} onClick={fresh}
              aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
              New chat{mode !== 'bar' && <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>}
            </button>
            {mode !== 'bar' ? (
              <button type="button" className="chat-ctl" tabIndex={!empty ? 0 : -1} data-on={!empty ? '' : undefined} onClick={closeChat} aria-keyshortcuts="Escape">
                Close<kbd>esc</kbd>
              </button>
            ) : (
              <button type="button" className="chat-x" onClick={away} aria-label="Close chat">
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            )}
          </div>
          <div className="chat-stage">
            {/* messages fill the screen from the top and only scroll, following the
                newest, once they reach the bottom */}
            <ThreadPrimitive.Viewport className="chat-body" turnAnchor="bottom" autoScroll inert={menu || undefined}>
              <ThreadPrimitive.Messages>
                {({ message }) => (message.role === 'user' ? <UserMessage /> : <AssistantMessage />)}
              </ThreadPrimitive.Messages>
            </ThreadPrimitive.Viewport>
            <div className="chat-hello" aria-hidden={!empty}>
              <div>
                <p className="msg-from chat-from">David <span className="ai-tag">AI</span></p>
                <h2 className="chat-title" key={headline}>{headline}</h2>
              </div>
            </div>
            {menuShown && <History chats={ordered} current={cid} on={menu} onPick={reopen} onClose={closeMenu} />}
          </div>
        </div>

        {mode === 'dock' && <>
          <div className="crt-logo-spot" aria-hidden="true" />
          <div className="dock-hello" aria-hidden={!empty}>
            <p className="chat-title">{headline}</p>
          </div>
        </>}

        <Composer input={input} placeholder={placeholderFor(project)} onEscape={() => (menu ? closeMenu() : mode !== 'bar' && !empty ? closeChat() : away())}
          onHistory={mode === 'bar' && chats.length ? openMenu : undefined} />

        <p className="chat-note">{noteFor(project)}</p>
        <div className="chat-rest" />
      </ThreadPrimitive.Root>
      </AwayContext.Provider>
    </div>
    <Corner chats={ordered} current={cid} fresh={empty} onNew={fresh} onPick={reopen}
      onRemove={(ids) => { removeChats(ids); if (!empty && (ids === 'all' || ids.includes(cid))) switchTo(null); }} />
  </>);
}

/* History, a small on screen menu over the conversation: past chats
   newest first, numbered like the channels, the one on screen marked.
   Up and down move through it, Enter opens one, Escape goes back. */
function History({ chats, current, on, onPick, onClose }: { chats: Convo[]; current: string; on: boolean; onPick: (c: Convo) => void; onClose: () => void }) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!on) return;
    const rows = list.current?.querySelectorAll<HTMLButtonElement>('button');
    const here = list.current?.querySelector<HTMLButtonElement>('[aria-current]');
    (here ?? rows?.[0])?.focus({ preventScroll: true });
    here?.scrollIntoView({ block: 'nearest' });
  }, [on]);
  const onKey = (e: React.KeyboardEvent) => {
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      next?.focus();
    } else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  return (
    <div className="chat-menu" data-on={on ? '' : undefined} role="dialog" aria-label="Past chats" onKeyDown={onKey}>
      <p className="chat-menu-label">Past chats</p>
      <ul ref={list}>
        {chats.map((c, i) => (
          <li key={c.id} style={{ "--n": i } as React.CSSProperties}>
            <button type="button" className="chat-row" aria-current={c.id === current ? 'true' : undefined} onClick={() => onPick(c)}>
              <span className="ch">{String(chats.length - i).padStart(2, '0')}</span>
              <span className="chat-row-title">{nameOf(c)}</span>
              <span className="chat-row-when">{c.id === current ? 'Now' : when(c.updated)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* the allowance as it stands, ticking while a short wait runs down */
function useQuota() {
  const [q, setQ] = useState<Quota | null>(() => readQuota());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const sync = () => { setQ(readQuota()); setNow(Date.now()); };
    addEventListener('dd-quota', sync);
    return () => removeEventListener('dd-quota', sync);
  }, []);
  const waiting = q?.until && q.until > now ? q : null;
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (waiting.until! <= t) setQ(readQuota());
    }, waiting.kind === 'minute' ? 250 : 30000);
    return () => clearInterval(id);
  }, [waiting]);
  return {
    left: q?.left ?? null,
    limit: q?.limit ?? 100,
    wait: waiting?.kind === 'minute' ? Math.ceil((waiting.until! - now) / 1000) : 0,
    done: waiting?.kind === 'day',
  };
}

/* close to the limit: how many are left, and a bar that drains */
function Meter({ left, wait }: { left: number | null; wait: number }) {
  const near = left !== null && left <= NEAR;
  if (!near && !wait) return null;
  return (
    <div className="quota" role="status">
      {wait > 0 && <span className="quota-wait">try again in {wait}s</span>}
      {near && <>
        <span className="quota-bar" aria-hidden="true">
          {Array.from({ length: NEAR }, (_, i) => <i key={i} data-on={i < left! ? '' : undefined} />)}
        </span>
        <span className="quota-left">{left === 1 ? '1 message' : `${left} messages`} left today</span>
      </>}
    </div>
  );
}

function Composer({ input, placeholder, onEscape, onHistory }: { input: React.RefObject<HTMLTextAreaElement | null>; placeholder: string; onEscape: () => void; onHistory?: () => void }) {
  const length = useAuiState((s) => s.composer.text.length);
  const running = useAuiState((s) => s.thread.isRunning);
  const quota = useQuota();
  /* the day's messages are used up: the conversation stays, the box
     gives way to a note */
  if (quota.done) {
    return (
      <div className="composer composer-done" role="status">
        <p>that's it for today. it resets tomorrow, or email me at <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.</p>
      </div>
    );
  }
  const held = quota.wait > 0;
  return (<>
    <Meter left={quota.left} wait={quota.wait} />
    <ComposerPrimitive.Root className="composer" data-history={onHistory ? '' : undefined} data-held={held ? '' : undefined}>
      {/* on phones, past chats are a tap away from the bar */}
      {onHistory && (
        <button type="button" className="composer-history" aria-label="History" onClick={onHistory}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      )}
      <ComposerPrimitive.Input
        ref={input}
        className="composer-input"
        placeholder={placeholder}
        aria-label="Message"
        rows={1}
        maxRows={6}
        maxLength={MAX_CHARS}
        submitMode={held ? 'none' as const : 'enter' as const}
        cancelOnEscape={false}
        addAttachmentOnPaste={false}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onEscape(); } }}
      />
      <span className="composer-count" data-on={length > MAX_CHARS - 160 ? '' : undefined} aria-live="polite">{length > MAX_CHARS - 160 ? `${length} / ${MAX_CHARS}` : ''}</span>
      <ModelPicker />
      {/* one button that turns into stop while answering */}
      {running ? (
        <ComposerPrimitive.Cancel className="composer-btn is-stop" aria-label="Stop">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" /></svg>
        </ComposerPrimitive.Cancel>
      ) : (
        <ComposerPrimitive.Send className="composer-btn" aria-label="Send" disabled={held || undefined}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 13V3.5M3.8 7.4 8 3.2l4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ComposerPrimitive.Send>
      )}
    </ComposerPrimitive.Root>
  </>);
}

function UserMessage() {
  const fresh = useFresh();
  return (
    <MessagePrimitive.Root className={`msg msg-user${fresh ? ' is-new' : ''}`}>
      <MessagePrimitive.Parts>
        {({ part }) => (part.type === 'text' ? <MessagePartPrimitive.Text component="p" smooth={false} /> : null)}
      </MessagePrimitive.Parts>
    </MessagePrimitive.Root>
  );
}

/* David's side: his first reply in a conversation carries his name and
   an honest AI tag */
function AssistantMessage() {
  const fresh = useFresh();
  const first = useAuiState((s) => s.thread.messages.find((m) => m.role === 'assistant')?.id === s.message.id);
  /* the reply's sources, numbered in the order they first appear */
  const site = useContext(SiteContext);
  const said = useAuiState((s) => s.message.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n'));
  const cites = useMemo(() => citesOf(said, site?.all ?? []), [said, site?.all]);
  const go = useGo(useContext(AwayContext));
  const cite = useMemo(() => ({ cites, go }), [cites, go]);
  return (
    <CiteContext.Provider value={cite}>
    <MessagePrimitive.Root className={`msg msg-bot${fresh ? ' is-new' : ''}`}>
      {first && <p className="msg-from">David <span className="ai-tag">AI</span></p>}
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === 'text') return <Text />;
          if (part.type === 'tool-call') return <Card name={part.toolName} args={part.args as Record<string, unknown>} />;
          return null;
        }}
      </MessagePrimitive.Parts>
      <Sources cites={cites} fresh={fresh} />
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root className="msg-error">
          <ErrorPrimitive.Message />
          <ActionBarPrimitive.Reload className="msg-retry">Try again</ActionBarPrimitive.Reload>
        </ErrorPrimitive.Root>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
    </CiteContext.Provider>
  );
}

function Card({ name, args }: { name: string; args: Record<string, unknown> }) {
  const fresh = useFresh();
  return <div className={`msg-part${fresh ? ' is-new' : ''}`}><ToolCard toolName={name} args={args} /></div>;
}

/* A text from David. Before the first words it is a bubble with the
   three dots of someone typing; then the words stream into the same
   bubble at an even pace however the pieces arrive, drawn the same way
   while typing and after, so nothing reflows when it finishes: links and
   addresses are links and **bold** is bold as soon as they are
   complete. */
const NONE = { type: 'text', text: '', status: { type: 'complete' } } as const;
function Text() {
  const fresh = useFresh();
  const part = useAuiState((s) => (s.part.type === 'text' ? s.part : null));
  const { text, status } = useSmooth((part ?? NONE) as Parameters<typeof useSmooth>[0], fresh ? { drainMs: 420, maxCharIntervalMs: 14 } : false);
  const typing = status.type === 'running';
  const site = useContext(SiteContext);
  const { cites } = useContext(CiteContext);
  /* links to a project open it here, keeping the conversation */
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    const slug = a?.getAttribute('href')?.match(/^\/projects\/([^/]+)\/?$/)?.[1];
    if (!slug || !site?.all.some((p) => p.slug === slug) || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    site.show(slug);
  };
  const shown = tidy(text, typing);
  if (!shown) {
    return typing || part?.status.type === 'running'
      ? <p className="msg-text bubble is-typing" aria-label="David is typing"><span className="dots" aria-hidden="true"><i /><i /><i /></span></p>
      : null;
  }
  return (
    <p className="msg-text bubble" onClick={onClick}>
      {withCites(shown, cites, fresh)}
    </p>
  );
}

/* the spacing around a piece of an answer, and a bold marker that has
   not closed yet */
const tidy = (text: string, typing: boolean) => {
  let t = (typing ? holdPartial(text) : text).trim();
  if (typing && (t.match(/\*\*/g)?.length ?? 0) % 2) {
    const i = t.lastIndexOf('**');
    t = t.slice(0, i) + t.slice(i + 2);
  }
  return t;
};

/* the text with its citation markers as numbered chips */
function withCites(text: string, cites: Cite[], fresh: boolean) {
  const out: React.ReactNode[] = [];
  let last = 0, k = 0;
  for (const m of text.matchAll(MARK)) {
    const i = m.index ?? 0;
    if (i > last) out.push(<span key={k++}>{rich(text.slice(last, i).replace(/ $/, ''))}</span>);
    const c = cites.find((x) => x.key === `${m[1]}#${(m[2] ?? '').trim().toLowerCase()}`);
    if (c) out.push(<Chip key={k++} c={c} fresh={fresh} />);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(<span key={k++}>{rich(text.slice(last))}</span>);
  return out;
}

const LINK = /(https?:\/\/[^\s)]+|daviddn\.dev\/[^\s),.]*|[\w.+-]+@[\w-]+\.[\w.]+|\*\*[^*]+\*\*)/g;
function rich(text: string) {
  const out: React.ReactNode[] = [];
  let last = 0, k = 0;
  for (const m of text.matchAll(LINK)) {
    const s = m[0], i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const trimmed = s.replace(/[.,;:!?]+$/, '');
    const tail = s.slice(trimmed.length);
    if (s.startsWith('**')) out.push(<strong key={k++}>{s.slice(2, -2)}</strong>);
    else if (trimmed.includes('@') && !trimmed.startsWith('http')) out.push(<a key={k++} href={`mailto:${trimmed}`}>{trimmed}</a>);
    else {
      const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      const local = href.startsWith('https://daviddn.dev/') ? href.slice('https://daviddn.dev'.length) : null;
      out.push(<a key={k++} href={local ?? href} target={local ? undefined : '_blank'} rel="noopener">{trimmed.replace(/^https?:\/\//, '')}</a>);
    }
    if (tail) out.push(tail);
    last = i + s.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
