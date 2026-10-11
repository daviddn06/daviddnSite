/* The resume, as an article on the screen (opened at /cv/ or from the
   chat, beside it like a project). Transcribed from public/resume.pdf,
   which stays the source: update both together. The phone number on the
   PDF is left out here. `{ role }` is an entry's title line, `{ list }`
   its points. */

export const resume = {
  slug: 'cv',
  name: 'Resume',
  role: 'David (Vinh) Nguyen',
  when: 'daviddn@usc.edu',
  line: 'Business at USC Marshall with a minor in Design for Digital Experiences. Founding AI product engineer at ShoSoft AI.',
  url: 'https://daviddn.dev/resume.pdf',
  tile: { type: 'image', src: '/og.jpg', w: 1200, h: 630 },
  shots: [],
  body: [
    { h: 'Professional experience' },
    { role: ['ShoSoft AI, Los Angeles', 'Founding AI Product Engineer, May 2026 to present'] },
    { list: [
      'Own AI product and engineering for ShoSoft 2.0, a venue management platform (10 microservices, Auth0, Stripe, Postgres); promoted from intern in month one after authoring the AI roadmap and shipping four LLM-driven onboarding and event-creation demos in Next.js.',
      'Replicated the 2.0 stack on a self-managed VPS (10 Node services, 45 seeded events), then shipped a UI overhaul, Cmd+K search, and a 129-finding accessibility audit in Claude Code with Playwright agents verifying every route, cutting the entry bundle from 5.35 MB to 2.48 MB.',
      'Rebuilt the marketing site as a launch page with real product UI running live in scaled iframes (layout shift cut from 0.37 to 0.017, deployed on Vercel and a Caddy-served VPS) and produced the 2.0 launch film and brand motion system in Remotion.',
      'Run go-to-market (GTM) engineering for the COO on agentic research runs: an answer engine optimization (AEO) program (FAQ library, JSON-LD, llms.txt, comparison pages vs Momentus, Tripleseat, Cvent), Claude-run HubSpot enrichment and QC, and paid-channel ranking.',
      'Built an agentic QA workstream against the 2.0 services: agents seeded the staging venue end to end through the API (events, quotes, invoices, tasks) and produced a 15-bug report ranked by impact with reproduction steps for the offshore engineering team.',
    ] },
    { role: ['Reve AI, Palo Alto', 'Growth Engineer Intern (First Intern Hire), Jun 2026 to Jul 2026'] },
    { list: [
      'First intern at Reve, an OpenAI-backed image model lab (~$1.6B raised); ran growth engineering end to end and shipped every deliverable through agentic workflows (Claude Code, Model Context Protocol (MCP), Codex).',
      "Built Reve Internal, the growth team's operations dashboard and system of record (14 views, 12,000-line vanilla JS frontend, Python backend, SQLite, Vercel mirror) unifying Attio CRM outreach for 964 contacts, Luma events, a brand-infringement scanner, and a Claude copilot with budgeted model routing, so overdue follow-ups, failed syncs, and brand threats surface in one Needs-attention view.",
      "Engineered a 13-source social listening engine (7,300 lines) with a Playwright-driven X collector that reads the client's own JSON instead of the paid API, Claude-tagged sentiment, and 12-month backfill, so the team sees how every launch lands across the open web at zero API cost.",
      "Launched the Campus Leader Program, Reve's first ambassador program (~25 schools, 21-page playbook, 12-doc onboarding library), vibe-coding its HQ platform in under 10 days; built an agentic Attio outreach pipeline with a human review gate across 401 CRM contacts and ran three CRM audits (434 companies, 959 people).",
      'Supported the Reve 2.0 launch (#2 on Arena.ai, up 125 Elo over v1.5) with the inspiration gallery and outreach to 25 researched student partners, built the Show Your Layers campaign site for the Reve 2.1 launch, and wrote an org-wide markdown context pack for AI agents.',
    ] },
    { role: ['Wedge Studio, Los Angeles', 'Founder, Jan 2026 to present'] },
    { list: [
      'Founded a design, web development, SEO/AEO, and AI consulting studio (wedgestudio.dev) that ships all client work through agentic tooling.',
      'Built Wedge App, an AI-native client portal and agency OS (Hono, SQLite, React 19, OpenAI tool loop), and Docket, a client project dashboard.',
      "Delivered the flagship engagement for Magic Box LA, a 200,000 sq ft DTLA venue: full redesign, self-hosted headless CMS (Payload 3, Next.js 16), first-party attribution with GA4 and Google Ads conversion tracking, CRM lead forwarding, and 15 audit defects fixed, so every paid lead is attributed correctly and the venue's ads agency can measure spend.",
    ] },
    { h: 'Selected project' },
    { role: ['Vecka, vecka.ai, Los Angeles', 'Founder and Product Engineer, Jul 2026 to present'] },
    { list: [
      'Built a personal workspace in React, TypeScript and Node.js, bringing tasks, notes, Google Calendar and Gmail into a split-pane interface with an AI assistant; deployed the app and a seeded public demo on a self-managed VPS.',
      'Routed assistant edits through the same client-side actions as manual changes, preserving undo history; implemented streaming responses, approval controls and per-call AI usage tracking.',
    ] },
    { h: 'Education and academic awards' },
    { role: ['University of Southern California, Los Angeles', 'Marshall School of Business and Iovine and Young Academy, expected May 2028'] },
    { list: [
      'Bachelor of Science in Business Administration, Minor in Design for Digital Experiences.',
      'Presidential Scholar with Half-Tuition Merit Scholarship (~$150,000), Global Leadership Program.',
      'Sandbox SC (Founder), Spark SC (Board Member), Global Investment Society (Academy Member), Trojan Investing Society (Member).',
    ] },
    { role: ['British International School, Ho Chi Minh City', 'IB Diploma Programme, 2008 to 2024'] },
    { list: [
      'Top 5% of class. SAT 1530/1600 (740 Verbal, 790 Math). IELTS Academic 8/9.',
      '4x Academic Distinctions (2018 to 2021) in IB/IGCSE Computer Science, Junior UK Mathematics Trust (Top 6%).',
    ] },
    { h: 'Skills and interests' },
    { list: [
      'Languages: English (fluent), Vietnamese (fluent).',
      'AI and agentic: AI product management, agentic workflow design, prompt engineering, retrieval-augmented generation (RAG); Claude Code, Codex, MCP servers (Attio, HubSpot, Supabase, Slack, Notion), OpenAI and Anthropic APIs, structured context packs (CLAUDE.md, llms.txt).',
      'Engineering and growth: TypeScript, JavaScript, Python, React, Next.js, Node.js (Hono), Tailwind CSS, SQL (SQLite, Postgres), Supabase, Docker, Vercel, Linux, Git, Playwright, Remotion, Firebase; SEO, AEO, JSON-LD, Google Analytics 4, Google Ads, Figma, Framer, Webflow, Payload CMS.',
      'Interests: diving, computational linguistics, UI/UX design, personal finance, credit cards, entrepreneurship, phở.',
    ] },
  ],
};
