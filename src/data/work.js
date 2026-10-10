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
    role: 'Founding AI PM',
    when: 'May 2026 to now',
    line: 'Venue and event management software. I lead the AI work, onboarding, the app and the marketing site.',
    url: 'https://shosoft.ai',
    tile: img('shosoft', 'overhaul-dashboard', 1600, 1000),
    cover: vid('shosoft', 'marketing-hero-scroll', 1440, 900),
    shots: [],
    body: [

      'ShoSoft began as the in-house tool at an event venue in downtown LA and grew into software for independent venues running 30 to 300 events a year. The mission is simple. Replace a venue\'s scattered tools with one place, so every booking turns into a business.',
      'My job is carrying that mission into AI. When I joined, the product was mostly forms and tables. I\'m turning the work venues hate doing by hand into work that does itself.',
      { stats: [['7s', 'to read a venue\'s website'], ['120', 'pages rebuilt'], ['258', 'SEO redirects'], ['450', 'files cleaned up']] },
      { h: 'Onboarding that reads your venue' },
      'Setting up venue software used to mean days of typing in spaces, prices and vendors. Now you paste your website or drop in your venue handbook. ShoSoft reads up to ten pages, pulls out spaces, inventory, vendors and contacts, and keeps only what it can trace back to the source.',
      'Then you check it in the real settings screens, every field marked found or missing. On a real venue it read 10 pages in about 7 seconds and found all 10 spaces, square footage included.',
      vid('shosoft', 'ai-onboarding-flow', 1440, 900, 'Paste a website, get a venue profile'),
      img('shosoft', 'ai-onboarding-spaces', 1600, 1000, 'Spaces read straight from the venue guide'),
      { h: 'The marketing site' },
      'The current site is a Framer build with a purple bar and blurry photos. I rebuilt it around the real product, live app screens instead of mockups, then moved all 120 pages onto a component system with a CMS that edits every one. The latest round added a job board of 598 verified roles from 92 employers, refreshed daily.',
      'Drag the handle to compare. The redesign is in review, shosoft.ai hasn\'t switched over yet.',
      compare('Homepage', site('home-before'), site('home-after'), ['shosoft.ai', 'Redesign']),
      compare('Features', site('features-before'), site('features-after'), ['shosoft.ai', 'Redesign']),
      compare('Blog', site('blog-before'), site('blog-after'), ['shosoft.ai', 'Redesign']),
      { h: 'The app' },
      'Then the product itself. Eleven passes in two days across about 450 files, without touching the API or the data. No shadows, no gradients, one typeface, real charts instead of pies, and a Cmd+K search. The first load got 54% lighter.',
      compare('Dashboard', img('shosoft', 'cleanup-dashboard-before', 1600, 1000), img('shosoft', 'cleanup-dashboard-after', 1600, 1000)),
      compare('Calendar', img('shosoft', 'cleanup-calendar-before', 1600, 1000), img('shosoft', 'cleanup-calendar-after', 1600, 1000)),
      compare('Events', img('shosoft', 'cleanup-events-before', 1600, 1000), img('shosoft', 'cleanup-events-after', 1600, 1000)),
      compare('Inventory', img('shosoft', 'cleanup-inventory-before', 1600, 1000), img('shosoft', 'cleanup-inventory-after', 1600, 1000)),
      vid('shosoft', 'launch-film-built-by-operators', 1440, 810, 'And a launch film, because why not'),
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

      'Reve makes an image model you can actually direct. Every image is built from a layout you can edit region by region. Reve 2.0 launched in June with native 4K and debuted at #2 on Arena.ai.',
      'Then in July, OpenAI invested in Reve, and part of the research team moved over to help lead multimodal research there. That landed four days before my internship ended. Really cool to see a small team get noticed like that, up close.',
      { stats: [['14', 'views in the internal tool'], ['3,923', 'posts tracked'], ['5,290', 'assistant calls'], ['~25', 'campus leaders']] },
      { h: 'The internal tool' },
      'Storytelling HQ started as a scratchpad and became the team\'s home base. Social listening across 13 sources, a mention archive with translation, a brand watch that caught copycat sites selling a fake Reve API, the CRM pipeline, drafts, a content calendar, and an assistant wired into all of it. No framework anywhere, just Python and SQLite.',
      vid('reve', 'internal-view-switching', 1440, 900, 'One tool for the whole Storytelling team (demo data)'),
      img('reve', 'internal-listening-feed', 1600, 1230, 'Social listening'),
      vid('reve', 'internal-ai-copilot', 1440, 900, 'The assistant, with live tools'),
      { h: 'Launches and campaigns' },
      'A launch page for Reve 2.0 with a 4K zoom built from real downsampled images, so the comparison is honest. A landing page and a 35 second coded film for the API. Show Your Layers, which asked people for their edit history and the moment the model fought them, paid in Reve\'s own credits. Keep Creating, a month of Reve Lite for the first 1,000 creators who shared their work.',
      vid('reve', 'blog-4k-zoom-loop', 1280, 720, '4K comparison for the Reve 2.0 launch'),
      vid('reve', 'layers-scroll', 1440, 900, 'Show Your Layers'),
      img('reve', 'keep-creating-hero', 1600, 1200, 'Keep Creating'),
      vid('reve', 'api-launch-film-open', 1440, 810, 'API launch film'),
      'I also co-ran the Campus Leader Program, about 25 students, one per school, with a 17 page hub to run it from.',
      vid('reve', 'hq-card-ceremony', 1040, 650, 'Every campus leader got a welcome card'),
      { h: 'What I learned' },
      'A green status badge can lie. An API change quietly broke our data collection for 53 hours while everything looked healthy. Now I watch what the data says, not whether the job ran.',
      'The hard part is rarely the interface. Getting a CRM to a place a team actually trusts took longer than any page I built.',
      { h: 'Why it stuck with me' },
      'What\'s happening in the art world right now fascinates me. Artists are arguing about authorship while some of the best ones quietly fold these tools into their process. Working with Reve\'s creative partners one on one, I saw that tension up close. I think the tools that win are the ones that keep a person as the director.',
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

      'Vecka is Swedish for week. It started as my own dashboard. This summer I rebuilt my personal setup three times, a finance hub, then a task system modeled on Things, then a suite on my own server with tasks, calendar and mail. In July I pulled the workspace out and made it a product. vecka.ai went live at the end of August.',
      img('vecka', 'v3-split', 1600, 1000, 'Any two apps side by side'),
      { h: 'What I\'m working on' },
      'The assistant. Memory that learns who you are, a reply queue that knows what actually needs you, and mail that files itself into the right project.',
      img('vecka', 'v3-mail', 1600, 1000, 'Mail'),
      vid('vecka', 'suggestion-approve', 1440, 900, 'Suggestions you approve with one tap'),
      { h: 'The mail model' },
      'Every email gets one request to Jev, a decision model from TypeSafe, asking several questions at once. Which project, which of 11 filters, did a person write it, does it need a reply, is there a to-do or an event inside. Vecka only files when Jev is confident twice over. Anything less becomes a maybe you confirm.',
      'My rule was near zero wrong filings, and it had to work for normal inboxes, not just mine. So I built a benchmark of 625 made-up threads from 12 kinds of people, a nurse, a parent, a landlord, someone writing in Spanish, and kept tuning until the numbers held.',
      { stats: [['125 → 232', 'correct project filings'], ['2', 'wrong filings left'], ['98.6%', 'of mail needing a reply caught'], ['~15¢', 'per 1,000 emails']] },
      'On my own inbox the Primary tab went from 51% to 91% precise. It takes about 160 ms an email. One honest caveat, the filter scores measure agreement with a larger model acting as judge, not perfect ground truth.',
      img('vecka', 'v3-home', 1600, 1000, 'Home'),
      pair('On a phone',
        img('vecka', 'v3-mobile-home', 780, 1688, '', 'mobile'),
        img('vecka', 'v3-mobile-tasks', 780, 1688, '', 'mobile')),
      img('vecka', 'brand-exploration', 1600, 995, 'Logo exploration'),
    ],
  },
  {
    slug: 'wedge',
    name: 'Wedge',
    role: 'Founder',
    when: 'Jan 2026 to now',
    line: 'My design and development studio, and the software it runs on.',
    url: 'https://wedgestudio.dev',
    tile: img('wedge', 'app-overview', 1600, 1000),
    cover: vid('wedge', 'site-intro-manifesto', 1600, 1000),
    shots: [],
    body: [

      'Wedge is where I do client work, design, web, SEO and AI. It began in May as an idea for an AI studio, became Wedge in June, and its software went live in August. I didn\'t want to run a studio on spreadsheets and email threads, so I built what it runs on.',
      vid('wedge', 'site-intro-manifesto', 1600, 1000, 'wedgestudio.dev'),
      { h: 'Software that tracks everything' },
      'Every project lives in one place, with an overview, the live build, a timeline, approvals, updates, messages and billing. A client pins a comment on the live site and it becomes a revision I have to close. Status is never typed in. It\'s worked out from the records, because my first version taught me typed status goes stale in a day.',
      img('wedge', 'app-overview', 1600, 1000, 'Project home'),
      vid('wedge', 'app-preview-pin-comment', 1440, 900, 'Comments pinned on the live build'),
      vid('wedge', 'app-feedback-to-revision', 1440, 900, 'A request becomes a tracked revision'),
      'There\'s an assistant with nine tools. It can check a project, file a revision or draft a message, and a person always presses send. Clients only ever see their own work.',
      vid('wedge', 'app-ai-command', 1440, 900, 'The assistant'),
      img('wedge', 'app-billing', 1600, 1000, 'Billing'),
      vid('wedge', 'docket-pipeline-drag', 1440, 900, 'Docket, a version for other agencies'),
      { h: 'Clients' },
      'My first client is a 220,000 square foot event venue in downtown LA. I redesigned and rebuilt their site on a self-hosted CMS, carried their SEO across, set up conversion tracking and sent every lead straight into their CRM.',
      img('wedge', 'client-venue-home-collage', 1600, 1000, 'The venue\'s new site'),
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

      'Handoff started in my technology entrepreneurship class at USC. I surveyed 47 students across four LA campuses. 81% struggled to find someone to take over their lease, and most ended up on Facebook or Craigslist.',
      'So every listing comes from a verified student and shows exactly how much you save against the original lease. That class left me with one line I keep coming back to. Entrepreneurship is something you do rather than something you plan.',
      vid('handoff', 'browse-map', 1600, 1000, 'Browsing by map'),
      img('handoff', 'listing-detail', 1600, 1000, 'Listing page'),
      'It has been rebuilt three times, a Lovable prototype, a Next.js version, and now React and Express on my own server, covering 22 LA campuses.',
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
    line: 'A small web studio that built sites for local businesses and nonprofits.',
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
