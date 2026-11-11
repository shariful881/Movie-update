// বাংলাদেশি ওটিটি প্ল্যাটফর্মগুলোর সাইটম্যাপ পড়ে সিনেমা, নাটক ও সিরিজের তালিকা বানায়।
// - প্রতিটা সাইটের robots.txt আগে দেখে; অনুমতি না থাকলে সেই সাইট বাদ দেয়।
// - শুধু নাম, লিংক আর তারিখ নেয়; বিবরণ বা ছবি নেয় না।
// - আগের তালিকার সাথে মিলিয়ে নতুন যোগ হওয়াগুলো data/new.csv-তে লেখে।
// চালানো: node scripts/scan-ott.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const UA = 'CineKhojBot/1.0 (+https://shariful881.github.io/Movie-update/)';
const DATA_DIR = new URL('../data/', import.meta.url);
const MAX_CHILD_SITEMAPS = 40;

const slugTitle = (slug) =>
  decodeURIComponent(slug)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// দৈর্ঘ্য দেখে আন্দাজ: ৭০ মিনিটের বেশি সিনেমা, ২০-৭০ মিনিট নাটক, এর কম গান বা ক্লিপ
const guessKind = (e, title) => {
  if (/^yes$/i.test(e.live)) return 'live';
  if (/highlight|\bvs\b|\bodi\b|\bt20\b|\bcup\b|\bmatch\b/i.test(title)) return 'sports';
  const sec = Number(e.duration) || 0;
  if (!sec) return 'video';
  if (sec >= 70 * 60) return 'movie';
  if (sec >= 20 * 60) return 'natok';
  return 'short';
};

const segments = (url) => new URL(url).pathname.split('/').filter(Boolean);

const SOURCES = [
  {
    id: 'iscreen',
    name: 'আই স্ক্রিন',
    origin: 'https://iscreen.com.bd',
    sitemap: 'https://iscreen.com.bd/sitemap.xml',
    pick(e) {
      const s = segments(e.loc);
      if (s[0] !== 'content' || s[1] !== 'details' || s.length !== 4) return null;
      const title = e.title || slugTitle(s[3]);
      return { kind: s[2] === 'series' ? 'series' : guessKind(e, title), title };
    },
  },
  {
    id: 'deeptoplay',
    name: 'দীপ্ত প্লে',
    origin: 'https://www.deeptoplay.com',
    sitemap: 'https://www.deeptoplay.com/sitemap.xml',
    pick(e) {
      const s = segments(e.loc);
      if (s.length !== 2) return null; // বিভাগ পাতা আর পর্বের লিংক বাদ
      return { kind: s[0], title: e.title || slugTitle(s[1]) };
    },
  },
  {
    id: 'bongo',
    name: 'বঙ্গ',
    origin: 'https://bongobd.com',
    sitemap: 'https://bongobd.com/sitemap.xml',
    childFilter: (u) => /video/i.test(u),
    pick(e) {
      const s = segments(e.loc);
      if (s[0] !== 'watch' || !e.title) return null; // শর্টস আর নামহীন লিংক বাদ
      return { kind: 'video', title: e.title };
    },
  },
  {
    id: 'hoichoi',
    name: 'হইচই',
    origin: 'https://www.hoichoi.tv',
    sitemap: 'https://www.hoichoi.tv/sitemap.xml',
    pick(e) {
      const s = segments(e.loc);
      if (s.length !== 2) return null;
      if (!/film|movie|series|show|natok|drama|original/i.test(s[0])) return null;
      return { kind: s[0], title: e.title || slugTitle(s[1]) };
    },
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  await sleep(1000); // সাইটের ওপর চাপ না দিতে প্রতিটা অনুরোধের পর বিরতি
  return res.text();
}

// robots.txt-এর "User-agent: *" অংশের Disallow নিয়ম
async function robotsRules(origin) {
  let txt = '';
  try {
    txt = await get(`${origin}/robots.txt`);
  } catch {
    return { allow: [], disallow: [] };
  }
  const allow = [];
  const disallow = [];
  let applies = false;
  let inAgents = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!inAgents) applies = false;
      inAgents = true;
      if (val === '*' || /cinekhoj/i.test(val)) applies = true;
      continue;
    }
    inAgents = false;
    if (!applies) continue;
    if (key === 'disallow' && val) disallow.push(val);
    if (key === 'allow' && val) allow.push(val);
  }
  return { allow, disallow };
}

const ruleMatch = (path, rule) => {
  const re = new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(path);
};

function allowed(rules, url) {
  const path = new URL(url).pathname;
  const best = (list) => Math.max(-1, ...list.filter((r) => ruleMatch(path, r)).map((r) => r.length));
  return best(rules.allow) >= best(rules.disallow);
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
};

export function parseSitemap(xml) {
  if (/<sitemapindex/i.test(xml)) {
    return { children: [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)].map((m) => tag(m[1], 'loc')).filter(Boolean), entries: [] };
  }
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((m) => ({
    loc: tag(m[1], 'loc'),
    lastmod: tag(m[1], 'lastmod'),
    title: tag(m[1], 'video:title'),
    published: tag(m[1], 'video:publication_date'),
    duration: tag(m[1], 'video:duration'),
    live: tag(m[1], 'video:live'),
    subscription: tag(m[1], 'video:requires_subscription'),
  }));
  return { children: [], entries: entries.filter((e) => e.loc) };
}

async function scanSource(src) {
  const rules = await robotsRules(src.origin);
  if (!allowed(rules, src.sitemap)) throw new Error('robots.txt সাইটম্যাপ পড়ার অনুমতি দেয় না');
  const queue = [src.sitemap];
  const seen = new Set();
  const items = new Map();
  let fetched = 0;
  while (queue.length && fetched <= MAX_CHILD_SITEMAPS) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const { children, entries } = parseSitemap(await get(url));
    fetched++;
    for (const c of children) if (!src.childFilter || src.childFilter(c)) queue.push(c);
    for (const e of entries) {
      if (!allowed(rules, e.loc)) continue;
      const p = src.pick(e);
      if (!p || items.has(e.loc)) continue;
      items.set(e.loc, {
        platform: src.id,
        kind: p.kind,
        title: p.title,
        url: e.loc,
        published: (e.published || e.lastmod || '').slice(0, 10),
        minutes: e.duration ? Math.round(Number(e.duration) / 60) : '',
        access: /^yes$/i.test(e.subscription) ? 'paid' : /^no$/i.test(e.subscription) ? 'free' : '',
      });
    }
  }
  return [...items.values()];
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) =>
  ['platform,kind,title,minutes,access,published,first_seen,url', ...rows.map((r) => [r.platform, r.kind, r.title, r.minutes, r.access, r.published, r.first_seen, r.url].map(csvCell).join(','))].join('\n') + '\n';

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  let previous = null;
  try {
    previous = JSON.parse(await readFile(new URL('catalog.json', DATA_DIR), 'utf8'));
  } catch {}
  const firstSeen = new Map((previous?.items ?? []).map((i) => [i.url, i.first_seen]));
  const today = new Date().toISOString().slice(0, 10);

  const sources = {};
  const all = [];
  for (const src of SOURCES) {
    try {
      const items = await scanSource(src);
      // সাইট থেকে কিছুই না এলে আগের তালিকা রেখে দেয়, যাতে সাময়িক সমস্যায় সব মুছে না যায়
      if (!items.length && previous) {
        all.push(...previous.items.filter((i) => i.platform === src.id));
        sources[src.id] = { name: src.name, status: 'empty-kept-previous', count: 0 };
      } else {
        for (const i of items) i.first_seen = firstSeen.get(i.url) ?? today;
        all.push(...items);
        sources[src.id] = { name: src.name, status: 'ok', count: items.length };
      }
      console.log(`${src.id}: ${sources[src.id].status} ${items.length}`);
    } catch (err) {
      if (previous) all.push(...previous.items.filter((i) => i.platform === src.id));
      sources[src.id] = { name: src.name, status: 'error', error: String(err.message || err) };
      console.log(`${src.id}: error ${err.message || err}`);
    }
  }

  all.sort((a, b) => a.platform.localeCompare(b.platform) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  const fresh = previous ? all.filter((i) => !firstSeen.has(i.url)) : [];

  await writeFile(new URL('catalog.json', DATA_DIR), JSON.stringify({ generated_at: new Date().toISOString(), sources, items: all }, null, 1));
  await writeFile(new URL('catalog.csv', DATA_DIR), toCsv(all));
  await writeFile(new URL('new.csv', DATA_DIR), toCsv(fresh));

  const lines = [
    `# ওটিটি স্ক্যান রিপোর্ট`,
    ``,
    `সর্বশেষ স্ক্যান: ${new Date().toISOString()}`,
    ``,
    `| প্ল্যাটফর্ম | অবস্থা | সংখ্যা |`,
    `|---|---|---|`,
    ...Object.entries(sources).map(([id, s]) => `| ${s.name} (${id}) | ${s.status}${s.error ? `: ${s.error}` : ''} | ${s.count ?? ''} |`),
    ``,
    previous ? `এই স্ক্যানে নতুন যোগ হয়েছে: ${fresh.length}টি (data/new.csv)` : `এটা প্রথম স্ক্যান, তাই নতুনের তালিকা পরের স্ক্যান থেকে শুরু হবে।`,
  ];
  await writeFile(new URL('scan-report.md', DATA_DIR), lines.join('\n') + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
