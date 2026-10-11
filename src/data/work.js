/* Everything on the site. Three lists, `work` (professional roles),
   `projects` (things David is building now) and `earlier`.
   Media files live in public/work/<slug>/. Images have a 1600 and an
   800 wide webp, videos have an mp4 and a poster webp.

   `body` is the article, a list of blocks: a string is a paragraph,
   { h } a small heading, { stats } a row of numbers, anything else a
   screen (image, video, pair, or a before and after `compare`). Written
   in David's voice and kept short. Projects without a body fall back to
   `notes` and `shots`. */

const img = (slug, name, w, h, caption = '', device = '') => ({
  type: 'image',
  src: `/work/${slug}/${name}-1600.webp`,
  small: `/work/${slug}/${name}-800.webp`,
  w, h, caption, device,
});

const vid = (slug, name, w, h, caption = '', device = '') => ({
  type: 'video',
  src: `/work/${slug}/${name}.mp4`,
  poster: `/work/${slug}/${name}-poster.webp`,
  w, h, caption, device,
});

/* Two shots shown side by side, for phone screens. */
const pair = (caption, a, b) => ({ type: 'pair', caption, items: [a, b] });

/* Before and after with a handle to drag. `a` and `b` are the two shots. */
const compare = (caption, a, b, labels) => ({ type: 'compare', caption, before: a, after: b, labels });
/* the marketing captures in public/work/shosoft/compare/, 2880 by 1800 */
const site = (name) => ({
  type: 'image',
  src: `/work/shosoft/compare/${name}.webp`,
  small: `/work/shosoft/compare/${name}-sm.webp`,
  w: 2880, h: 1800,
});

/* Professional roles. */
export const work = [
  {
    slug: 'shosoft',
    name: 'ShoSoft AI',
    role: 'Founding Product Engineer',
    when: 'May 2026 to now',
    line: 'Venue and event management software. I lead the AI work, onboarding, the app and the marketing site.',
    url: 'https://shosoft.ai',
    tile: img('shosoft', 'overhaul-dashboard', 1600, 1000),
    cover: vid('shosoft', 'marketing-hero-scroll', 1440, 900),
    shots: [],
    body: [

      'At ShoSoft I lead the AI work. ShoSoft makes software for independent venues that run 30 to 300 events a year. It began as the in-house tool at one event venue in downtown LA.',
      { h: 'Where I started' },
      'When I joined, the product was mostly forms and tables and the brief was "add AI". I narrowed it to one question. Which part of a venue manager\'s week do they dread? The answer kept coming back to setup. A new venue spends days typing in spaces, prices and vendors before the software does anything for them.',
      { h: 'Onboarding that reads your venue' },
      'So the first thing I built reads it for them. Paste your website or drop in your venue handbook, and ShoSoft pulls out spaces, inventory, vendors and contacts.',
      'The decision I spent the most time on was what it should not do. It keeps only what it can trace back to a source, and every field shows up as found or missing in the real settings screens. A wrong square footage is worse than a blank one, because nobody double checks a field that already looks filled in. On a real venue it read 10 pages in about 7 seconds and found all 10 spaces.',
      vid('shosoft', 'ai-onboarding-flow', 1440, 900, 'Paste a website, get a venue profile'),
      img('shosoft', 'ai-onboarding-spaces', 1600, 1000, 'Spaces read straight from the venue guide'),
      { h: 'The site and the app' },
      'The marketing site showed mockups of a product that already existed. I rebuilt it around live app screens and put all 120 pages on one component system the team edits without me. The new site is live at shosoft.ai.',
      compare('Homepage', site('home-before'), site('home-after'), ['shosoft.ai', 'Redesign']),
      compare('Features', site('features-before'), site('features-after'), ['shosoft.ai', 'Redesign']),
      compare('Blog', site('blog-before'), site('blog-after'), ['shosoft.ai', 'Redesign']),
      'In the app I held one rule. Change how it looks and feels without touching the API or the data, so the engineers never had to review a migration. One typeface, no shadows, real charts, and a Cmd+K search. The first load got 54% lighter.',
      compare('Dashboard', img('shosoft', 'cleanup-dashboard-before', 1600, 1000), img('shosoft', 'cleanup-dashboard-after', 1600, 1000)),
      compare('Calendar', img('shosoft', 'cleanup-calendar-before', 1600, 1000), img('shosoft', 'cleanup-calendar-after', 1600, 1000)),
      compare('Events', img('shosoft', 'cleanup-events-before', 1600, 1000), img('shosoft', 'cleanup-events-after', 1600, 1000)),
      compare('Inventory', img('shosoft', 'cleanup-inventory-before', 1600, 1000), img('shosoft', 'cleanup-inventory-after', 1600, 1000)),
    ],
  },
  {
    slug: 'wedge',
    name: 'Wedge Studio',
    role: 'Founder',
    when: 'Since high school, expanded in 2026',
    line: 'My design and development studio. I\'ve built sites for clients since high school, and in 2026 I expanded it and built the software it runs on.',
    url: 'https://wedgestudio.dev',
    tile: img('wedge', 'app-overview', 1600, 1000),
    cover: vid('wedge', 'site-intro-manifesto', 1600, 1000),
    shots: [],
    body: [

      'I started building websites for local businesses in high school, under the name AVA Media. That studio did more than 50 projects before I left for USC. In 2026 I expanded it into Wedge, design, web, SEO and AI, and built the software it runs on.',
      vid('wedge', 'site-intro-manifesto', 1600, 1000, 'wedgestudio.dev'),
      { h: 'Why software came first' },
      'Running a studio as a teenager showed me where agencies lose clients. It\'s rarely the design. It\'s the two week wait for a small edit, the update nobody sent, the login that left with the last freelancer. That\'s the broken part of the agency market, and it\'s a process problem. So before taking on more clients, I built the process.',
      'Every project lives in one place, with the live build, a timeline, approvals, messages and billing. A client pins a comment on the live site and it becomes a revision I have to close. Status is never typed in. It\'s worked out from the records, because my first version taught me typed status goes stale in a day.',
      img('wedge', 'app-overview', 1600, 1000, 'Project home'),
      vid('wedge', 'app-preview-pin-comment', 1440, 900, 'Comments pinned on the live build'),
      vid('wedge', 'app-feedback-to-revision', 1440, 900, 'A request becomes a tracked revision'),
      'The assistant can check a project, file a revision or draft a message, and a person always presses send. I drew that line on purpose. A client should never get a message nobody read.',
      vid('wedge', 'app-ai-command', 1440, 900, 'The assistant'),
      img('wedge', 'app-billing', 1600, 1000, 'Billing'),
      vid('wedge', 'docket-pipeline-drag', 1440, 900, 'Docket, a version for other agencies'),
      { h: 'The first client' },
      'Magic Box LA, a 220,000 square foot event venue in downtown LA. I redesigned and rebuilt their site on a self-hosted CMS, carried their SEO across, and made sure every paid lead lands in their CRM with its source attached, so they can finally tell which ads book events.',
      img('wedge', 'client-venue-home-collage', 1600, 1000, 'The venue\'s new site'),
    ],
  },
  {
    slug: 'reve',
    name: 'Reve AI',
    role: 'Growth Engineer',
    when: 'Jun 2026 to Jul 2026',
    line: 'An AI image company. I spent the summer on growth, building launch pages, campaigns and the tool the Storytelling team ran on.',
    url: 'https://reve.com',
    tile: img('reve', 'internal-listening-light', 1600, 1000),
    cover: vid('reve', 'blog-4k-zoom-loop', 1280, 720),
    shots: [],
    body: [

      'I was the first intern at Reve, on the growth team. Reve makes an image model you can direct. Every image is built from a layout you can edit region by region. Reve 2.0 launched while I was there and debuted at #2 on Arena.ai.',
      'A note on privacy. The internal tool on this page runs on sample data, and the names and numbers inside it are made up, so nothing internal to Reve is shown.',
      { h: 'The question I started with' },
      'The team was checking how each launch landed across X, Reddit, Discord and a dozen other places by hand, one tab at a time. I asked what they would open first every morning if it existed, built that, and let the rest follow.',
      { h: 'The internal tool' },
      'It grew into the team\'s home base. Social listening, a mention archive with translation, a watch for lookalike sites, the outreach pipeline, drafts, a content calendar, and an assistant wired into all of it. I kept it plain, Python and SQLite with no framework, so it stayed easy to change in an afternoon.',
      { stats: [['12', 'sources watched'], ['~1,000', 'mentions a week'], ['1', 'tab to open each morning']] },
      vid('reve', 'internal-view-switching', 1440, 900, 'One tool for the whole team (sample data)'),
      img('reve', 'internal-listening-feed', 1600, 1230, 'Social listening (sample data)'),
      vid('reve', 'internal-ai-copilot', 1440, 900, 'The assistant, with live tools (sample data)'),
      { h: 'Launches and campaigns' },
      'For the Reve 2.0 launch I built a 4K zoom out of real downsampled images, so the comparison was honest instead of flattering. Then a landing page and a short coded film for the API, Show Your Layers, which asked people to share the moment the model fought them, and Keep Creating, a free month for creators who shared their work.',
      vid('reve', 'blog-4k-zoom-loop', 1280, 720, '4K comparison for the Reve 2.0 launch'),
      vid('reve', 'layers-scroll', 1440, 900, 'Show Your Layers'),
      img('reve', 'keep-creating-hero', 1600, 1200, 'Keep Creating'),
      vid('reve', 'api-launch-film-open', 1440, 810, 'API launch film'),
      'I also co-ran the Campus Leader Program, one student at each school, with a hub to run it from.',
      vid('reve', 'hq-card-ceremony', 1040, 650, 'Every campus leader got a welcome card'),
      { h: 'What I learned' },
      'A green status badge can lie. An API change quietly broke our data collection for days while everything looked healthy. Now I watch what the data says, not whether the job ran.',
      'The hard part is rarely the interface. Getting a CRM to a place a team actually trusts took longer than any page I built.',
      { h: 'Why it stuck with me' },
      'Artists are arguing about authorship while some of the best ones quietly fold these tools into their process. Working with Reve\'s creative partners one on one, I saw that tension up close. I think the tools that win are the ones that keep a person as the director.',
    ],
  },
];

/* Things David founded or built. */
export const projects = [
  {
    slug: 'vecka',
    name: 'Vecka',
    role: 'Founder',
    when: 'Jul 2026 to now',
    line: 'A workspace that puts tasks, notes, calendar and Gmail side by side, with mail that sorts itself.',
    url: 'https://vecka.ai',
    tile: img('vecka', 'v3-split', 1600, 1000),
    cover: img('vecka', 'v3-split', 1600, 1000),
    shots: [],
    body: [

      'Vecka is the workspace I build and use every day. Vecka is Swedish for week. It started as my own dashboard. This summer I rebuilt my personal setup three times, a finance hub, then a task system modeled on Things, then a suite on my own server. Each time the useful part was the same, everything I need for the week side by side. In July I pulled that out and made it a product, and vecka.ai went live at the end of August.',
      img('vecka', 'v3-split', 1600, 1000, 'Any two apps side by side'),
      { h: 'The mail model' },
      'Mail was the part I cared about most, because it\'s where a week goes to die. Every email gets one request to Jev, a decision model from TypeSafe, asking several questions at once. Which project, which of 11 filters, did a person write it, does it need a reply, is there a to-do or an event inside.',
      'My rule was near zero wrong filings. A missed email you can find, a misfiled one you never see again. So Vecka only files when Jev is confident twice over, and anything less becomes a maybe you confirm. It also had to work for normal inboxes, not just mine, so I built a benchmark of 625 made-up threads from 12 kinds of people, a nurse, a parent, a landlord, someone writing in Spanish, and kept tuning until the numbers held.',
      { stats: [['125 → 232', 'correct project filings'], ['2', 'wrong filings left'], ['98.6%', 'of mail needing a reply caught'], ['~15¢', 'per 1,000 emails']] },
      'One honest caveat. The filter scores measure agreement with a larger model acting as judge, not perfect ground truth.',
      img('vecka', 'v3-mail', 1600, 1000, 'Mail'),
      vid('vecka', 'suggestion-approve', 1440, 900, 'Suggestions you approve with one tap'),
      { h: 'What I\'m working on' },
      'The assistant. Memory that learns who you are, a reply queue that knows what actually needs you, and mail that files itself into the right project.',
      img('vecka', 'v3-home', 1600, 1000, 'Home'),
      pair('On a phone',
        img('vecka', 'v3-mobile-home', 780, 1688, '', 'mobile'),
        img('vecka', 'v3-mobile-tasks', 780, 1688, '', 'mobile')),
      img('vecka', 'brand-exploration', 1600, 995, 'Logo exploration'),
    ],
  },
  {
    slug: 'handoff',
    name: 'Handoff',
    role: 'Co-founder',
    when: 'Mar 2026 to now',
    line: 'A sublease marketplace for students that shows how much you save on every listing.',
    url: 'https://handofflease.com',
    tile: img('handoff', 'browse-split-view', 1600, 1000),
    cover: vid('handoff', 'browse-map', 1600, 1000),
    shots: [],
    body: [

      'I co-founded Handoff in my technology entrepreneurship class at USC. Before building anything we surveyed 47 students across four LA campuses. 81% struggled to find someone to take over their lease, and most ended up on Facebook or Craigslist, where you can\'t tell a real student from a scam.',
      'That set the two rules. Every listing comes from a verified student, and every listing shows exactly how much you save against the original lease, because that number is what makes someone message you.',
      vid('handoff', 'browse-map', 1600, 1000, 'Browsing by map'),
      img('handoff', 'listing-detail', 1600, 1000, 'Listing page'),
      'It has been rebuilt three times, a Lovable prototype, a Next.js version, and now React and Express on my own server, covering 22 LA campuses. Each rebuild came from something the last one couldn\'t do. The class left me with one line I keep coming back to. Entrepreneurship is something you do rather than something you plan.',
      pair('On a phone',
        img('handoff', 'mobile-listing-detail', 780, 1688, '', 'mobile'),
        img('handoff', 'savings-request-card', 680, 1044)),
      img('handoff', 'pitch-deck-problem-survey', 1600, 900, 'The survey that started it'),
    ],
  },
];

/* Earlier ventures, from high school and the first years of college. */
export const earlier = [
  {
    slug: 'digital-enterprise',
    name: 'Digital Enterprise',
    role: 'Co-founder and director',
    when: 'Aug 2021 to Jul 2025',
    line: 'A student-run entrepreneurship nonprofit and business plan competition.',
    url: 'https://digitalenterprise.vn',
    tile: img('digital-enterprise', 'site-today', 1600, 1000),
    cover: img('digital-enterprise', 'finals-pitch', 1600, 1600),
    shots: [],
    body: [
      'We started it in high school to get more students building things. It grew to 400+ members across 20+ schools, with chapters in Ho Chi Minh City, Hanoi and Seoul, and raised $20K+ in sponsorship. I built the website.',
      img('digital-enterprise', 'finals-pitch', 1600, 1600, 'The 2023 final'),
      vid('digital-enterprise', 'site-2023-scroll', 1440, 900, 'The website I built, 2023'),
      img('digital-enterprise', 'competition-carousel', 1600, 1600, 'Competition launch post'),
      img('digital-enterprise', 'workshop-crowd', 1600, 1200, 'An event'),
      img('digital-enterprise', 'year-one-stats', 1600, 1600, 'First year in numbers'),
    ],
  },
  {
    slug: 'hyre',
    name: 'HYRE',
    role: 'Co-founder, front end',
    when: 'Sep 2022 to Jan 2024',
    line: 'A tutoring marketplace pairing high school tutors with students.',
    url: 'https://web.archive.org/web/20230410094608/https://www.hyre.vn/',
    tile: img('hyre', 'pricing-page', 1600, 1126),
    cover: img('hyre', 'pricing-page', 1600, 1126),
    shots: [],
    body: [
      'Tutoring at about a third of the market price, $19 to $30 an hour, taught by high schoolers who had just aced the same classes. 80+ mentors and students and $3,500+ in revenue.',
      img('hyre', 'pricing-page', 1600, 1126, 'Pricing page, 2023'),
      img('hyre', 'homepage-design', 1600, 1451, 'Homepage design'),
      img('hyre', 'dashboard-design', 1600, 1103, 'Tutor dashboard design'),
      img('hyre', 'social-posts', 1600, 780, 'Launch posts'),
    ],
  },
  {
    slug: 'swire',
    name: 'Swire',
    role: 'Co-founder, full stack',
    when: 'Sep 2022 to Jan 2024',
    line: 'An iOS app concept that matched students with internships by swiping.',
    url: '',
    tile: img('swire', 'app-home-screen', 818, 1790, '', 'mobile'),
    cover: img('swire', 'app-screens', 1600, 900),
    shots: [],
    body: [
      'Swipe to hire, for students and internships. Built in Swift with Node and Firebase, and a finalist in the 2022 Diamond Challenge.',
      vid('swire', 'app-flow', 1440, 810, 'App walkthrough'),
      img('swire', 'app-screens', 1600, 900, 'Sign in, feed and a match'),
      img('swire', 'deck-solution', 1600, 900, 'Pitch deck'),
    ],
  },
  {
    slug: 'ava-media',
    name: 'AVA Media',
    role: 'Founder',
    when: 'Until Oct 2022',
    line: 'The web studio I ran in high school, building sites for local businesses and nonprofits. It grew into Wedge.',
    url: '',
    tile: img('ava-media', 'site-live-2022', 1600, 882),
    cover: img('ava-media', 'site-live-2022', 1600, 882),
    shots: [],
    body: [
      'My first studio, and where I learned to ship for clients. 50+ projects and $30K+ grossed building sites and content for local businesses.',
      img('ava-media', 'site-live-2022', 1600, 882, 'The studio site, 2022'),
      img('ava-media', 'homepage-design', 1600, 2749, 'Homepage design'),
      img('ava-media', 'stats-posts', 1600, 518, 'Launch posts'),
    ],
  },
];

export const all = [...work, ...projects, ...earlier];

/* Every file a page references, used to prune unused media from the build. */
export const mediaFiles = () => {
  const out = new Set();
  const add = (m) => {
    if (!m) return;
    if (typeof m !== 'object' || !m.type) return;
    if (m.type === 'pair') return m.items.forEach(add);
    if (m.type === 'compare') { add(m.before); add(m.after); return; }
    for (const k of ['src', 'small', 'poster']) if (m[k]) out.add(m[k]);
  };
  for (const p of all) { add(p.cover); add(p.tile); p.shots.forEach(add); (p.body ?? []).forEach(add); }
  return out;
};
