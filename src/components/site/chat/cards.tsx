/* What the chat can show inside an answer, drawn where the tool call
   happened. Everything comes from the same project data as the guide
   (src/data/work.js, passed down from App), so the cards never drift
   from the site. Choosing a project in a card opens it exactly like
   choosing its channel. They are drawn as attachments under David's
   text (`att` in chat.css): one light container in the bubbles' own
   language, hairline rows, nothing that truncates mid word. */
import { createContext, useContext } from 'react';
import { Mini, type Project } from '../Media';

export type Site = {
  all: Project[];
  sections: { id: string; title: string; items: Project[] }[];
  open: string | null;
  show: (slug: string | null) => void;
};
export const SiteContext = createContext<Site | null>(null);
const useSite = () => useContext(SiteContext)!;

export const CONTACT = {
  email: 'daviddn@usc.edu',
  linkedin: 'https://www.linkedin.com/in/daviddn',
  resume: '/cv/',
};


/* opens a project from inside a card, the way the guide does */
function Open({ p, className, style, children }: { p: Project; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const { show } = useSite();
  return (
    <a className={className} style={style} href={`/projects/${p.slug}/`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        show(p.slug);
      }}>
      {children}
    </a>
  );
}

/* "Jul 2026 to now" reads as "Jul 2026 to now"; a long "Since high
   school, expanded in 2026" keeps only its first part */
const years = (when: string) => when.split(',')[0];
/* the timeline's column wants it shorter still: "2026 to now",
   "2021 to 2025", "until 2022" */
const span = (when: string) => {
  const w = years(when);
  const ys = w.match(/\d{4}/g) ?? [];
  if (!ys.length) return w;
  if (/^until/i.test(w)) return `until ${ys[0]}`;
  if (/now/i.test(w)) return `${ys[0]} to now`;
  return ys.length > 1 && ys[0] !== ys[1] ? `${ys[0]} to ${ys[1]}` : ys[0];
};

/* projects: one attachment, a row per project, the whole row opens it */
function Projects({ slugs }: { slugs?: unknown }) {
  const { all } = useSite();
  const list = (Array.isArray(slugs) ? slugs : []).map((s) => all.find((p) => p.slug === s)).filter(Boolean) as Project[];
  if (!list.length) return null;
  return (
    <ul className="att att-projects">
      {list.map((p, i) => (
        <li key={p.slug} style={{ '--i': i } as React.CSSProperties}>
          <Open p={p} className="att-row">
            <Mini slug={p.slug} />
            <span className="att-main">
              <span className="att-head"><span className="att-name">{p.name}</span><span className="att-meta">{p.role} · {years(p.when)}</span></span>
              <span className="att-line">{p.line}</span>
            </span>
          </Open>
        </li>
      ))}
    </ul>
  );
}

/* everything in order: a thin rail, the dates in their own column */
function Timeline() {
  const { sections } = useSite();
  let i = 0;
  return (
    <div className="att att-timeline">
      {sections.map((s) => (
        <section key={s.id} className="tl-group">
          <h4 className="tl-label">{s.title}</h4>
          <ol className="tl-rail">
            {s.items.map((p) => (
              <li key={p.slug} style={{ '--i': i++ } as React.CSSProperties}>
                <span className="tl-when" title={p.when}>{span(p.when)}</span>
                <Open p={p} className="tl-name"><Mini slug={p.slug} />{p.name}</Open>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const MAIL = 'M2.5 4.5h11v7h-11zM2.8 4.8L8 8.8l5.2-4';
const LINK = 'M6.5 9.5l3-3M7 4.8l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.2l-1 1A2.5 2.5 0 014.5 8.7l1-1';
const DOC = 'M4.5 2.5h5l2 2v9h-7zM6.5 7.5h3M6.5 10h3';

/* how to reach me: a row of actions */
function Contact() {
  return (
    <div className="att att-actions">
      <a className="att-act" href={`mailto:${CONTACT.email}`} style={{ '--i': 0 } as React.CSSProperties}><Icon d={MAIL} />Email<span className="att-act-sub">{CONTACT.email}</span></a>
      <a className="att-act" href={CONTACT.linkedin} target="_blank" rel="noopener" style={{ '--i': 1 } as React.CSSProperties}><Icon d={LINK} />LinkedIn</a>
      <a className="att-act" href={CONTACT.resume} style={{ '--i': 2 } as React.CSSProperties}><Icon d={DOC} />Resume</a>
    </div>
  );
}

function Resume() {
  return (
    <a className="att att-file" href={CONTACT.resume}>
      <span className="att-file-icon"><Icon d={DOC} /></span>
      <span className="att-main">
        <span className="att-name">Resume</span>
        <span className="att-meta">One page, PDF</span>
      </span>
    </a>
  );
}

/* a quiet note where the chat changed the page */
function Note({ name, slug }: { name: string; slug?: unknown }) {
  const { all, show, open } = useSite();
  const p = typeof slug === 'string' ? all.find((x) => x.slug === slug) : undefined;
  if (name === 'open_project' && p) {
    return (
      <p className="chat-note-act">
        pulled up{' '}
        <a href={`/projects/${p.slug}/`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.button !== 0) return; e.preventDefault(); show(p.slug); }}>{p.name}</a>
      </p>
    );
  }
  if (name === 'close_project') return <p className="chat-note-act">took you back to the home screen</p>;
  return null;
}

export function ToolCard({ toolName, args }: { toolName: string; args: Record<string, unknown> }) {
  switch (toolName) {
    case 'show_projects': return <Projects slugs={args.slugs} />;
    case 'show_timeline': return <Timeline />;
    case 'show_contact': return <Contact />;
    case 'show_resume': return <Resume />;
    case 'open_project': return <Note name={toolName} slug={args.slug} />;
    case 'close_project': return <Note name={toolName} />;
    default: return null;
  }
}
