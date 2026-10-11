/* The chat, in the middle of the screen. Built on assistant-ui's
   unstyled primitives (thread, messages, composer, autoscroll) with the
   site's own adapter (adapter.ts), styled by chat.css so it reads as text
   on the glass.

   Like ChatGPT. With nothing said yet it is one line picked at random
   above the box and "Ask anything about David." under it. Once talking,
   the box settles to the bottom and the conversation reads down from the
   top, each question pinned to the top as it is asked.

   One conversation follows the visitor around the site: opening,
   switching and closing projects keep it, and every message tells the
   server which project is open and where the visitor is in it. With a
   project open the chat docks to the bottom of the strip beside the
   article as a slim bar ("Ask anything about ShoSoft") that opens upward
   while in use. Under 1000px it is a bar along the bottom of the screen
   that opens into a full screen conversation.

   A page load starts a new conversation; New chat starts one too. Past
   ones are kept in this browser (store.ts) and listed in History, a
   small on screen menu, to read and continue.

   Motion. Everything moves on the site's one curve (--ease), enters a
   little up and in, leaves quicker than it came, and can be interrupted.
   Changing where the chat sits (a project opening) fades it out and in
   rather than sliding it across the screen. Reduced motion turns it all
   off. */
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
import './chat.css';
import { chatAdapter, MAX_CHARS, type Context } from './adapter';
import { SiteContext, ToolCard, type Site } from './cards';
import { firstChat, listChats, newId, putChat, setCurrent, titleOf, when, type Convo, type Stored } from './store';
import type { Project } from '../Media';

/* the line above the box, one picked per new chat, in the chat's own
   voice: casual, warm, a little cheeky */
const HEADLINES = [
  'ask me anything about david',
  'what do you wanna know about david?',
  "david's out building stuff. ask me instead",
  "hey. curious what david's been up to?",
  'i know a lot about david. try me',
  "go ahead, ask me about david's work",
  "david's busy shipping. i'm the one you can bug",
];
const pickHeadline = (not?: string) => {
  const pool = HEADLINES.filter((h) => h !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

/* "ShoSoft AI" reads as "ShoSoft" here */
const short = (p: Project) => p.name.replace(/\s+AI$/, '');
const noteFor = (p?: Project) => `Ask anything about ${p ? short(p) : 'David'}.`;
const placeholderFor = (p?: Project) => (p ? `Ask anything about ${short(p)}` : 'Ask anything');

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NARROW = '(max-width: 999px)';
type Mode = 'center' | 'dock' | 'bar';

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

export function Chat(props: Site) {
  /* the server renders a still copy; the live chat takes over once the
     page is running */
  const [first, setFirst] = useState<{ convo: Convo | null } | null>(null);
  useEffect(() => { setFirst({ convo: firstChat() }); }, []);
  const site = useMemo(() => props, [props.all, props.sections, props.open, props.show]);
  return (
    <SiteContext.Provider value={site}>
      {first ? <Live {...props} first={first.convo} /> : <Still open={props.open} all={props.all} />}
    </SiteContext.Provider>
  );
}

/* the chat before it is live: the same layout, nothing to do yet (the
   headline stays blank so a different one never flashes in) */
function Still({ open, all }: { open: string | null; all: Project[] }) {
  const p = all.find((x) => x.slug === open);
  return (
    <div id="crt-chat-slot" className="crt-slot" data-mode={open ? 'dock' : 'center'} data-empty="">
      <div className="chat">
        <div className="chat-sheet">
          <div className="chat-head" />
          <div className="chat-stage">
            <div className="chat-body" />
            <div className="chat-hello"><div><p className="chat-title">&nbsp;</p></div></div>
          </div>
        </div>
        <div className="composer">
          <textarea className="composer-input" rows={1} placeholder={placeholderFor(p)} aria-label="Message" disabled />
          <span className="composer-btn" aria-hidden="true" />
        </div>
        <p className="chat-note">{noteFor(p)}</p>
        <div className="chat-rest" />
      </div>
    </div>
  );
}

function Live({ first, ...site }: Site & { first: Convo | null }) {
  const siteRef = useRef(site);
  siteRef.current = site;
  const convo = useRef({ id: first?.id ?? newId(), at: first?.at ?? Date.now() });
  const adapter = useMemo(() => chatAdapter({
    cid: () => convo.current.id,
    page: () => siteRef.current.open,
    context: () => readContext(siteRef.current.open),
    act: (name, input) => {
      const s = siteRef.current;
      if (name === 'open_project' && typeof input.slug === 'string' && s.all.some((p) => p.slug === input.slug)) s.show(input.slug);
      if (name === 'close_project') s.show(null);
    },
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
    putChat({ id: convo.current.id, title: titleOf(text), at: convo.current.at, updated: Date.now(), messages });
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
      convo.current = c ? { id: c.id, at: c.at } : { id: newId(), at: Date.now() };
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
    timer.current = window.setTimeout(run, 180);
  }, [runtime]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Born.Provider value={born}>
        <Screen open={site.open} all={site.all} headline={headline} cid={cid} swap={swap} switchTo={switchTo} />
      </Born.Provider>
    </AssistantRuntimeProvider>
  );
}

/* where the chat sits now. A change of place fades the chat out, moves
   it while it is invisible, and fades it in; changing back midway just
   fades in again where it was. */
function usePlace(target: Mode) {
  const [shown, setShown] = useState(target);
  const [fade, setFade] = useState<'out' | 'in' | undefined>();
  useEffect(() => {
    if (target === shown) { setFade((f) => (f === 'out' ? 'in' : f)); return; }
    if (still()) { setShown(target); return; }
    setFade('out');
    const t = window.setTimeout(() => { setShown(target); setFade('in'); }, 170);
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
  swap: boolean;
  switchTo: (c: Convo | null) => void;
};

function Screen({ open, all, headline, cid, swap, switchTo }: ScreenProps) {
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
  const [menu, setMenu] = useState(false);
  const menuShown = usePresence(menu, 200);

  /* in use: focused, answering, or opened on purpose and not yet put away */
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  useEffect(() => { if (running) setPinned(true); }, [running]);
  /* in the dock an empty conversation stays a bar, unless there are past
     chats to reach (then just their button shows above it) */
  const expanded = mode === 'center' || menu || ((focused || pinned) && (mode === 'bar' || !empty || past));

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

  return (
    <div id="crt-chat-slot" ref={slot} className="crt-slot" data-mode={mode} data-fade={fade}
      data-expanded={expanded ? '' : undefined}
      data-empty={empty ? '' : undefined}
      data-menu={menu ? '' : undefined}
      data-swap={swap ? '' : undefined}
      data-page={open ?? undefined}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget && e.animationName === 'chat-place-in') faded(); }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!slot.current?.contains(e.relatedTarget as Node)) setFocused(false); }}>
      <ThreadPrimitive.Root className="chat">
        <div className="chat-sheet">
          <div className="chat-head">
            <button type="button" className="chat-tool" data-on={!empty ? '' : undefined} tabIndex={!empty ? 0 : -1} onClick={fresh}>
              New chat
            </button>
            <button type="button" className="chat-tool" data-on={past || menu ? '' : undefined} tabIndex={past || menu ? 0 : -1}
              aria-expanded={menu} onClick={() => (menu ? closeMenu() : (setChats(listChats()), setMenu(true)))}>
              History
            </button>
            <button type="button" className="chat-x" onClick={away} aria-label="Close chat">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="chat-stage">
            <ThreadPrimitive.Viewport className="chat-body" turnAnchor={mode === 'center' ? 'top' : 'bottom'} inert={menu || undefined}>
              <ThreadPrimitive.Messages>
                {({ message }) => (message.role === 'user' ? <UserMessage /> : <AssistantMessage />)}
              </ThreadPrimitive.Messages>
            </ThreadPrimitive.Viewport>
            <div className="chat-hello" aria-hidden={!empty}>
              <div><h2 className="chat-title" key={headline}>{headline}</h2></div>
            </div>
            {menuShown && <History chats={chats} current={cid} on={menu} onPick={reopen} onClose={closeMenu} />}
          </div>
        </div>

        <Composer input={input} placeholder={placeholderFor(project)} onEscape={() => (menu ? closeMenu() : away())} />

        <p className="chat-note">{noteFor(project)}</p>
        <div className="chat-rest" />
      </ThreadPrimitive.Root>
    </div>
  );
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
              <span className="ch">{String(i + 1).padStart(2, '0')}</span>
              <span className="chat-row-title">{c.title}</span>
              <span className="chat-row-when">{c.id === current ? 'Now' : when(c.updated)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Composer({ input, placeholder, onEscape }: { input: React.RefObject<HTMLTextAreaElement | null>; placeholder: string; onEscape: () => void }) {
  const length = useAuiState((s) => s.composer.text.length);
  const running = useAuiState((s) => s.thread.isRunning);
  return (
    <ComposerPrimitive.Root className="composer">
      <ComposerPrimitive.Input
        ref={input}
        className="composer-input"
        placeholder={placeholder}
        aria-label="Message"
        rows={1}
        maxRows={6}
        maxLength={MAX_CHARS}
        submitMode="enter"
        cancelOnEscape={false}
        addAttachmentOnPaste={false}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onEscape(); } }}
      />
      <span className="composer-count" data-on={length > MAX_CHARS - 160 ? '' : undefined} aria-live="polite">{length > MAX_CHARS - 160 ? `${length} / ${MAX_CHARS}` : ''}</span>
      {/* one button that turns into stop while answering */}
      {running ? (
        <ComposerPrimitive.Cancel className="composer-btn is-stop" aria-label="Stop">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" /></svg>
        </ComposerPrimitive.Cancel>
      ) : (
        <ComposerPrimitive.Send className="composer-btn" aria-label="Send">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 13V3.5M3.8 7.4 8 3.2l4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ComposerPrimitive.Send>
      )}
    </ComposerPrimitive.Root>
  );
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

function AssistantMessage() {
  const fresh = useFresh();
  return (
    <MessagePrimitive.Root className={`msg msg-bot${fresh ? ' is-new' : ''}`}>
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === 'text') return <Text />;
          if (part.type === 'tool-call') return <Card name={part.toolName} args={part.args as Record<string, unknown>} />;
          return null;
        }}
      </MessagePrimitive.Parts>
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root className="msg-error">
          <ErrorPrimitive.Message />
          <ActionBarPrimitive.Reload className="msg-retry">Try again</ActionBarPrimitive.Reload>
        </ErrorPrimitive.Root>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}

function Card({ name, args }: { name: string; args: Record<string, unknown> }) {
  const fresh = useFresh();
  return <div className={`msg-part${fresh ? ' is-new' : ''}`}><ToolCard toolName={name} args={args} /></div>;
}

/* The answer types out at an even pace behind the beam, however the
   pieces arrive, and is drawn the same way while typing and after, so
   nothing reflows when it finishes: links and addresses are links and
   **bold** is bold as soon as they are complete. */
const NONE = { type: 'text', text: '', status: { type: 'complete' } } as const;
function Text() {
  const fresh = useFresh();
  const part = useAuiState((s) => (s.part.type === 'text' ? s.part : null));
  const { text, status } = useSmooth((part ?? NONE) as Parameters<typeof useSmooth>[0], fresh ? { drainMs: 420, maxCharIntervalMs: 14 } : false);
  const typing = status.type === 'running';
  const site = useContext(SiteContext);
  /* links to a project open it here, keeping the conversation */
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    const slug = a?.getAttribute('href')?.match(/^\/projects\/([^/]+)\/?$/)?.[1];
    if (!slug || !site?.all.some((p) => p.slug === slug) || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    site.show(slug);
  };
  return (
    <p className="msg-text" onClick={onClick}>
      {rich(tidy(text, typing))}
      {fresh && <span className="cursor" data-off={typing ? undefined : ''} aria-hidden="true" />}
    </p>
  );
}

/* the spacing around a piece of an answer, and a bold marker that has
   not closed yet */
const tidy = (text: string, typing: boolean) => {
  let t = text.trim();
  if (typing && (t.match(/\*\*/g)?.length ?? 0) % 2) {
    const i = t.lastIndexOf('**');
    t = t.slice(0, i) + t.slice(i + 2);
  }
  return t;
};

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
