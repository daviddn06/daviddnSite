/* The chat, in the middle of the screen. Built on assistant-ui's
   unstyled primitives (thread, messages, composer, autoscroll) with the
   site's own adapter (adapter.ts) and styled entirely by site.css, so it
   reads as text on the glass.

   Where it sits. With nothing open it is the screen's main thing, a
   column centred in the picture: one line picked per visit, the box to
   type in and a quiet note under it; once talking, the conversation
   above the box, like any chat. With a project open it docks to the
   bottom of the strip beside the article as a slim bar; while it is in
   use (focused, or answering) the conversation opens upward as a short
   sheet over the strip. Under 1000px it is a bar along the bottom of the
   screen that opens into a full screen conversation.

   While it holds a conversation or has focus, it asks the picture to calm
   down behind it (`data-calm`, see crt.ts) so the text stays readable.
   The conversation is kept for the tab's session. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type AssistantRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { chatAdapter, MAX_CHARS } from './adapter';
import { SiteContext, ToolCard, type Site } from './cards';

const KEY = 'dd_chat';
/* the line above the box, one picked per visit */
const HEADLINES = [
  'What do you want to know about David?',
  'Ask me what David is building.',
  'Curious how David works?',
  'Where should we start?',
  'Want the short version of David?',
  'Ask about anything on the screen.',
];
const NOTE = 'Ask anything about David.';

/* the conversation, kept for this tab */
type Stored = { id: string; role: 'user' | 'assistant'; content: ThreadMessageLike['content'] };
const load = (): ThreadMessageLike[] => {
  try {
    const raw = sessionStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Stored[]) : [];
    return list.map((m) => ({ ...m, status: m.role === 'assistant' ? { type: 'complete', reason: 'unknown' } : undefined }));
  } catch { return []; }
};
const save = (runtime: AssistantRuntime) => {
  const t = runtime.thread.getState();
  if (t.isRunning) return;
  const list: Stored[] = [];
  for (const m of t.messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const content: Exclude<ThreadMessageLike['content'], string>[number][] = [];
    for (const p of m.content) {
      if (p.type === 'text') content.push({ type: 'text', text: p.text });
      else if (p.type === 'tool-call') content.push({ type: 'tool-call', toolCallId: p.toolCallId, toolName: p.toolName, args: p.args, argsText: p.argsText, result: p.result });
    }
    if (!content.length) continue;
    list.push({ id: m.id, role: m.role, content });
  }
  try { sessionStorage.setItem(KEY, JSON.stringify(list.slice(-40))); } catch { /* storage full or blocked */ }
};

type Props = Site;

export function Chat(props: Props) {
  /* the server renders a still copy; the live chat takes over once the
     page is running, with whatever this tab already said */
  const [initial, setInitial] = useState<ThreadMessageLike[] | null>(null);
  useEffect(() => { setInitial(load()); }, []);
  const site = useMemo(() => props, [props.all, props.sections, props.open, props.show]);
  return (
    <SiteContext.Provider value={site}>
      {initial ? <Live {...props} initial={initial} /> : <Still open={props.open} />}
    </SiteContext.Provider>
  );
}

/* the chat before it is live: the same box, nothing to do yet (the
   headline is kept blank so a different one never flashes in) */
function Still({ open }: { open: string | null }) {
  return (
    <div id="crt-chat-slot" className="crt-slot" data-mode={open ? 'dock' : 'center'} data-empty="">
      <div className="chat">
        <div className="chat-body">
          <div className="chat-hello"><p className="chat-title">&nbsp;</p></div>
        </div>
        <div className="composer">
          <textarea className="composer-input" rows={1} placeholder="Type a question" aria-label="Message" disabled />
        </div>
        <p className="chat-note">{NOTE}</p>
      </div>
    </div>
  );
}

function Live({ initial, ...site }: Props & { initial: ThreadMessageLike[] }) {
  const siteRef = useRef(site);
  siteRef.current = site;
  const adapter = useMemo(() => chatAdapter({
    page: () => siteRef.current.open,
    act: (name, input) => {
      const s = siteRef.current;
      if (name === 'open_project' && typeof input.slug === 'string' && s.all.some((p) => p.slug === input.slug)) s.show(input.slug);
      if (name === 'close_project') s.show(null);
    },
  }), []);
  const runtime = useLocalRuntime(adapter, { initialMessages: initial });

  useEffect(() => runtime.thread.subscribe(() => save(runtime)), [runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Screen open={site.open} />
    </AssistantRuntimeProvider>
  );
}

function Screen({ open }: { open: string | null }) {
  const slot = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const empty = useAuiState((s) => s.thread.isEmpty);
  const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  const running = useAuiState((s) => s.thread.isRunning);

  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(max-width: 999px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const mode = narrow ? 'bar' : open ? 'dock' : 'center';

  /* in use: focused, answering, or opened on purpose and not yet put away */
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  useEffect(() => { if (running) setPinned(true); }, [running]);
  const expanded = mode === 'center' || focused || pinned;
  const away = () => { setPinned(false); setFocused(false); input.current?.blur(); };

  /* a click outside puts the sheet away (not while answering) */
  useEffect(() => {
    if (mode === 'center' || !pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!running && slot.current && !slot.current.contains(e.target as Node)) setPinned(false);
    };
    addEventListener('pointerdown', onDown);
    return () => removeEventListener('pointerdown', onDown);
  }, [mode, pinned, running]);

  const calm = mode === 'center' ? (empty && !focused ? 0.7 : 1) : expanded ? 1 : 0.6;

  return (
    <div id="crt-chat-slot" ref={slot} className="crt-slot" data-mode={mode}
      data-expanded={expanded && !(mode !== 'center' && empty && !focused) ? '' : undefined}
      data-empty={empty ? '' : undefined}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!slot.current?.contains(e.relatedTarget as Node)) setFocused(false); }}>
      <ThreadPrimitive.Root className="chat" data-calm={calm}>
        {mode === 'bar' && (
          <div className="chat-head">
            <span>Chat</span>
            <button type="button" className="chat-x" onClick={away} aria-label="Close chat">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        <ThreadPrimitive.Viewport className="chat-body">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <div className="chat-hello">
              <h2 className="chat-title">{headline}</h2>
            </div>
          </AuiIf>
          <ThreadPrimitive.Messages>
            {({ message }) => (message.role === 'user' ? <UserMessage /> : <AssistantMessage />)}
          </ThreadPrimitive.Messages>
        </ThreadPrimitive.Viewport>

        <Composer input={input} onEscape={away} />

        <p className="chat-note">{NOTE}</p>
      </ThreadPrimitive.Root>
    </div>
  );
}

function Composer({ input, onEscape }: { input: React.RefObject<HTMLTextAreaElement | null>; onEscape: () => void }) {
  const length = useAuiState((s) => s.composer.text.length);
  return (
    <ComposerPrimitive.Root className="composer">
      <ComposerPrimitive.Input
        ref={input}
        className="composer-input"
        placeholder="Type a question"
        aria-label="Message"
        rows={1}
        maxRows={6}
        maxLength={MAX_CHARS}
        submitMode="enter"
        cancelOnEscape={false}
        addAttachmentOnPaste={false}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onEscape(); } }}
      />
      {length > MAX_CHARS - 160 && <span className="composer-count" aria-live="polite">{length} / {MAX_CHARS}</span>}
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send className="composer-btn" aria-label="Send">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 13V3.5M3.8 7.4 8 3.2l4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel className="composer-btn is-stop" aria-label="Stop">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" /></svg>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </ComposerPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="msg msg-user">
      <MessagePrimitive.Parts>
        {({ part }) => (part.type === 'text' ? <MessagePartPrimitive.Text component="p" smooth={false} /> : null)}
      </MessagePrimitive.Parts>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="msg msg-bot">
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === 'text') return <Text />;
          if (part.type === 'tool-call') return <ToolCard toolName={part.toolName} args={part.args as Record<string, unknown>} />;
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

/* Streaming, the text types out with a cursor. Once complete, links and
   addresses in it become real links and **bold** is bold. */
function Text() {
  const done = useAuiState((s) => s.part.type === 'text' && s.part.status.type !== 'running');
  const text = useAuiState((s) => (s.part.type === 'text' ? s.part.text : ''));
  if (!done) {
    return (
      <p className="msg-text">
        <MessagePartPrimitive.Text />
        <span className="cursor" aria-hidden="true" />
      </p>
    );
  }
  return <p className="msg-text">{rich(text)}</p>;
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
