/* What the chat can show inside an answer, drawn where the tool call
   happened. Everything comes from the same project data as the guide
   (src/data/work.js, passed down from App), so the cards never drift
   from the site. Choosing a project in a card opens it exactly like
   choosing its channel. The cards are plain class based markup (`card`,
   and the screen's shared `crt-card`), drawn as phosphor outlines on the
   glass by chat.css. */
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

function Projects({ slugs }: { slugs?: unknown }) {
  const { all } = useSite();
  const list = (Array.isArray(slugs) ? slugs : []).map((s) => all.find((p) => p.slug === s)).filter(Boolean) as Project[];
  if (!list.length) return null;
  return (
    <div className="cards">
      {list.map((p, i) => (
        <Open key={p.slug} p={p} className="card crt-card card-project" style={{ '--i': i } as React.CSSProperties}>
          <span className="card-top"><Mini slug={p.slug} /><span className="card-name">{p.name}</span></span>
          <span className="card-meta">{p.role}, {p.when}</span>
          <span className="card-line">{p.line}</span>
        </Open>
      ))}
    </div>
  );
}

function Timeline() {
  const { sections } = useSite();
  return (
    <div className="card crt-card card-list">
      {sections.map((s) => (
        <div key={s.id} className="tl-group">
          <span className="tl-label">{s.title}</span>
          <ul>
            {s.items.map((p) => (
              <li key={p.slug}>
                <Open p={p} className="tl-name"><Mini slug={p.slug} />{p.name}</Open>
                <span className="tl-when">{p.when}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Contact() {
  return (
    <div className="card crt-card card-list">
      <ul className="rows">
        <li><span className="row-label">Email</span><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
        <li><span className="row-label">LinkedIn</span><a href={CONTACT.linkedin} target="_blank" rel="noopener">linkedin.com/in/daviddn</a></li>
        <li><span className="row-label">Resume</span><a href={CONTACT.resume}>daviddn.dev/cv</a></li>
      </ul>
    </div>
  );
}

function Resume() {
  return (
    <a className="card crt-card card-resume" href={CONTACT.resume}>
      <span className="card-name">Resume</span>
      <span className="card-meta">One page, opens as a PDF</span>
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
        {open === p.slug ? 'Showing ' : 'Showed '}
        <a href={`/projects/${p.slug}/`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.button !== 0) return; e.preventDefault(); show(p.slug); }}>{p.name}</a>
      </p>
    );
  }
  if (name === 'close_project') return <p className="chat-note-act">Back to the screen</p>;
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
