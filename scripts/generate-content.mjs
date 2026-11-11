// স্ক্যান করা ডেটা থেকে সাইটের পাতার ফাইল বানায়:
//   src/content/titles/<slug>.md   (সিনেমা, সিরিজ, নাটক, টিভি শো, মাইক্রো ড্রামা)
//   src/content/people/<slug>.md   (২টা বা বেশি যাচাই করা কাজ আছে এমন অভিনেতা, পরিচালক, প্রযোজক, প্রতিষ্ঠান)
// উৎস: data/catalog.json, data/details.json, data/movies-details.json, data/people.json
// নিয়ম: যে ফাইলে "generated: true" নেই (মানে হাতে লেখা বা সম্পাদিত), সেটা কখনো বদলায় না।
// কাহিনি সংক্ষেপ বা প্ল্যাটফর্মের লেখা কপি করে না; শুধু তথ্য।
// চালানো: node scripts/generate-content.mjs

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
  } catch {
    return fallback;
  }
};

const catalog = read('data/catalog.json', { items: [] }).items;
const details = read('data/details.json', []);
const wdMovies = read('data/movies-details.json', []);
const wdPeople = read('data/people.json', []);

const bnDigits = '০১২৩৪৫৬৭৮৯';
const bn = (n) => String(n).replace(/\d/g, (d) => bnDigits[d]);
const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const bnDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${bn(d)} ${bnMonths[m - 1]} ${bn(y)}`;
};
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
const slugify = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
const urlSlug = (url) => slugify(decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || ''));

const PLATFORM_NAME = { iscreen: 'আই স্ক্রিন', deeptoplay: 'দীপ্ত প্লে', addatimes: 'অ্যাডাটাইমস' };
const TYPE_WORD = { movie: 'সিনেমা', series: 'সিরিজ', natok: 'নাটক', tvshow: 'টিভি শো', microdrama: 'মাইক্রো ড্রামা' };
const COUNTRY = { Bangladesh: 'বাংলাদেশ', India: 'ভারত', 'British India': 'ভারত', Pakistan: 'পাকিস্তান' };
const GENRE = {
  drama: 'ড্রামা', comedy: 'কমেডি', entertainment: 'বিনোদন', romance: 'রোমান্স', romantic: 'রোমান্স', thriller: 'থ্রিলার',
  action: 'অ্যাকশন', horror: 'হরর', family: 'পারিবারিক', crime: 'ক্রাইম', history: 'ঐতিহাসিক', historical: 'ঐতিহাসিক',
  mystery: 'রহস্য', fantasy: 'ফ্যান্টাসি', adventure: 'অ্যাডভেঞ্চার', music: 'সংগীত', musical: 'সংগীত', kids: 'শিশুতোষ',
  documentary: 'প্রামাণ্য', 'reality show': 'রিয়েলিটি শো', 'talk show': 'টক শো', religious: 'ধর্মীয়', cooking: 'রান্না',
};
const genreBn = (g) => GENRE[g.trim().toLowerCase()] ?? g.trim();

// উইকিডাটার মিল কতটা ভরসার (enrich-movies.mjs-এর শ্রেণিবিভাগের সাথে মিল রেখে)
const wdOk = (r) => r.status === 'মিলেছে' && !(r.platform === 'iscreen' && !(r.country || '').includes('Bangladesh'));
const wdByUrl = new Map(wdMovies.filter(wdOk).map((r) => [r.url, r]));
const okFilms = new Set([...wdByUrl.values()].map((r) => r.qid));

// ---------- প্রোফাইল পাতা: ২টা বা বেশি যাচাই করা কাজ ----------
const personSlug = new Map(); // qid -> slug
const peopleOut = [];
const usedPersonSlugs = new Set();
for (const p of wdPeople) {
  const films = new Set(p.films.filter((f) => okFilms.has(f.qid)).map((f) => f.qid));
  if (films.size < 2) continue;
  let slug = slugify(p.name) || p.qid.toLowerCase();
  if (usedPersonSlugs.has(slug)) slug = `${slug}-${p.qid.toLowerCase()}`;
  usedPersonSlugs.add(slug);
  personSlug.set(p.qid, slug);
  peopleOut.push({ slug, name: p.bn || p.name, nameEn: p.name, wikidata: p.qid, kind: p.roles.length === 1 && p.roles[0] === 'company' ? 'company' : 'person' });
}
const personByEnName = new Map(peopleOut.map((p) => [norm(p.nameEn), p.slug]));

// ---------- টাইটেল একত্র করা ----------
const records = new Map();
const add = (key, base, avail) => {
  const cur = records.get(key);
  if (!cur) {
    records.set(key, { ...base, availability: [avail] });
    return;
  }
  if (!cur.availability.some((a) => a.platform === avail.platform)) cur.availability.push(avail);
  for (const [k, v] of Object.entries(base)) if (cur[k] === undefined || (Array.isArray(cur[k]) && !cur[k].length)) cur[k] = v;
};

const accessNote = (a) => (a === 'free' || a === 'ফ্রি' ? 'ফ্রি' : a === 'paid' || a === 'পেইড' ? 'সাবস্ক্রিপশন লাগে' : undefined);

function fromWikidata(wd) {
  const crew = [
    ...wd.directors.map((p) => ({ name: p.bn || p.name, job: 'director', id: personSlug.get(p.qid) })),
    ...wd.producers.map((p) => ({ name: p.bn || p.name, job: 'producer', id: personSlug.get(p.qid) })),
    ...wd.companies.map((p) => ({ name: p.bn || p.name, job: 'company', id: personSlug.get(p.qid) })),
  ];
  const full = wd.date && !wd.date.endsWith('-01-01');
  const countries = (wd.country || '').split(', ').map((c) => COUNTRY[c]).filter(Boolean);
  return {
    title: wd.bn || wd.title,
    year: wd.date ? Number(wd.date.slice(0, 4)) : undefined,
    releaseDate: full ? wd.date : undefined,
    cast: wd.cast.map((p) => ({ name: p.bn || p.name, id: personSlug.get(p.qid) })),
    crew,
    origin: countries[0],
    wikidata: wd.qid,
  };
}

const ISCREEN_TYPE = { সিনেমা: 'movie', সিরিজ: 'series', নাটক: 'natok', টেলিফিল্ম: 'natok' };
const DEEPTO_TYPE = { 'ধারাবাহিক/সিরিজ': 'series', 'টিভি শো': 'tvshow', 'মাইক্রো ড্রামা': 'microdrama' };
const ADDA_TYPE = { movie: 'movie', series: 'series' };
const CATALOG_TYPE = { movie: 'movie', natok: 'natok', series: 'series', 'micro-drama': 'microdrama', 'tv-shows': 'tvshow' };

const detailByUrl = new Map(details.map((d) => [d.url, d]));
const sources = [];
for (const d of details) sources.push(d);
for (const c of catalog) if (!detailByUrl.has(c.url)) sources.push({ ...c, fromCatalog: true });

for (const s of sources) {
  let type;
  if (s.platform === 'iscreen') type = s.fromCatalog ? CATALOG_TYPE[s.kind] : ISCREEN_TYPE[s.kind];
  else if (s.platform === 'deeptoplay') type = s.fromCatalog ? CATALOG_TYPE[s.kind] : DEEPTO_TYPE[s.kind];
  else if (s.platform === 'addatimes') type = ADDA_TYPE[s.kind];
  if (!type || !s.title) continue;
  // ট্রেলার, প্রোমো, উদযাপন অনুষ্ঠানের মতো আসল কনটেন্ট নয় এমন জিনিস বাদ
  if (/celebration|trailer|teaser|promo|behind the scenes?|\bbts\b|making of|press meet|premiere show|akhon ki chai|talk show|\bnews\b/i.test(s.title)) continue;

  const wd = type === 'movie' ? wdByUrl.get(s.url) : undefined;
  const base = { type, titleEn: s.title, urlSlug: urlSlug(s.url) };
  if (wd) Object.assign(base, fromWikidata(wd));
  else base.title = s.title;

  if (s.platform === 'deeptoplay' && !s.fromCatalog) {
    if (s.release) base.ottReleaseDate = s.release;
    if (s.seasons) base.seasons = Number(s.seasons);
    if (s.episodes) base.episodes = Number(s.episodes);
    base.genres = (s.genres || '').split(',').map(genreBn).filter(Boolean);
    const names = (s.cast || '').split(', ').filter(Boolean);
    base.cast = base.cast?.length ? base.cast : names.map((n) => ({ name: n, id: personByEnName.get(norm(n)) }));
    const dirs = (s.directors || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!base.crew?.length && dirs.length) base.crew = dirs.map((n) => ({ name: n, job: 'director', id: personByEnName.get(norm(n)) }));
    base.origin = base.origin || s.origin || undefined;
    base.dubbed = Boolean(base.origin && base.origin !== 'বাংলাদেশ');
  }

  let note;
  if (s.platform === 'iscreen') {
    const acc = accessNote(s.access);
    note = [acc, s.release && !s.fromCatalog ? `আই স্ক্রিনে যোগ: ${bnDate(s.release)}` : undefined].filter(Boolean).join(' · ') || undefined;
  }
  const key = base.wikidata ? `wd:${base.wikidata}` : `${type}:${norm(s.title)}`;
  add(key, base, { platform: s.platform, url: s.url, note });
}

// একই সিনেমা এক প্ল্যাটফর্মে উইকিডাটার সাথে মিলেছে আর অন্যটায় মেলেনি: এক পাতায় মেলানো
const wdByName = new Map();
for (const [key, r] of records) if (r.wikidata) wdByName.set(`${r.type}:${norm(r.titleEn)}`, key);
for (const [key, r] of [...records]) {
  if (r.wikidata) continue;
  const target = wdByName.get(`${r.type}:${norm(r.titleEn)}`);
  if (!target) continue;
  const t = records.get(target);
  for (const a of r.availability) if (!t.availability.some((x) => x.platform === a.platform)) t.availability.push(a);
  records.delete(key);
}

// ---------- ফাইল লেখা ----------
const q = (v) => JSON.stringify(v);
function frontmatter(obj) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v) && typeof v[0] === 'object') {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${q(Object.fromEntries(Object.entries(item).filter(([, x]) => x !== undefined && x !== '')))}`);
    } else lines.push(`${k}: ${q(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

const canWrite = (file) => !existsSync(file) || /^generated:\s*true\s*$/m.test(readFileSync(file, 'utf8'));

function faqsFor(r) {
  const word = TYPE_WORD[r.type];
  const where = r.availability.map((a) => PLATFORM_NAME[a.platform]).join(' ও ');
  const f = [{ q: `${r.title} কোথায় দেখা যাবে?`, a: `প্ল্যাটফর্মের তালিকা অনুযায়ী ${r.title} বাংলাদেশ থেকে ${where}-এ দেখা যায়।` }];
  if (r.episodes && r.type !== 'movie') f.push({ q: `${r.title} কত পর্ব?`, a: `মোট ${bn(r.episodes)}টি পর্ব${r.seasons > 1 ? `, ${bn(r.seasons)}টি সিজনে` : ''}।` });
  if (r.dubbed) f.push({ q: `${r.title} কি বাংলায় দেখা যায়?`, a: `হ্যাঁ, ${r.origin}-এর এই ${word} বাংলা ডাবিংয়ে ${where}-এ দেখা যায়।` });
  if (r.releaseDate) f.push({ q: `${r.title} কবে মুক্তি পায়?`, a: `${bnDate(r.releaseDate)} তারিখে।` });
  else if (r.year) f.push({ q: `${r.title} কোন সালের ${word}?`, a: `${bn(r.year)} সালের।` });
  if (r.cast?.length) f.push({ q: `${r.title}-এ কারা অভিনয় করেছেন?`, a: `${r.cast.slice(0, 4).map((c) => c.name).join(', ')}${r.cast.length > 4 ? ' প্রমুখ' : ''}।` });
  return f;
}

const titleDir = new URL('src/content/titles/', ROOT);
const peopleDir = new URL('src/content/people/', ROOT);
mkdirSync(titleDir, { recursive: true });
mkdirSync(peopleDir, { recursive: true });

const usedSlugs = new Map(); // type/slug -> key
const counts = {};
let written = 0;
let kept = 0;
for (const [key, r] of records) {
  // ফাইলের নাম সব ধরন মিলিয়ে ইউনিক হতে হবে, কারণ সব টাইটেল এক ফোল্ডারে থাকে
  let slug = slugify(r.wikidata ? r.titleEn : r.urlSlug || r.titleEn) || 'untitled';
  if (usedSlugs.has(slug) && usedSlugs.get(slug) !== key) slug = `${slug}-${r.year || r.type}`;
  let n = 2;
  const stem = slug;
  while (usedSlugs.has(slug) && usedSlugs.get(slug) !== key) slug = `${stem}-${n++}`;
  usedSlugs.set(slug, key);
  counts[r.type] = (counts[r.type] ?? 0) + 1;

  const file = new URL(`${slug}.md`, titleDir);
  if (!canWrite(file)) {
    kept++;
    continue;
  }
  const sources = [
    ...(r.wikidata ? [{ name: 'উইকিডাটা', url: `https://www.wikidata.org/wiki/${r.wikidata}` }] : []),
    ...r.availability.map((a) => ({ name: PLATFORM_NAME[a.platform], url: a.url })),
  ];
  const fm = {
    title: r.title,
    titleEn: r.titleEn,
    type: r.type,
    year: r.year,
    releaseDate: r.releaseDate,
    ottReleaseDate: r.ottReleaseDate,
    seasons: r.seasons,
    episodes: r.episodes,
    genres: r.genres,
    language: 'বাংলা',
    origin: r.origin,
    dubbed: r.dubbed || undefined,
    cast: r.cast,
    crew: r.crew,
    availability: r.availability,
    faqs: faqsFor(r),
    sources,
    wikidata: r.wikidata,
    generated: true,
  };
  writeFileSync(file, frontmatter(fm));
  written++;
}

for (const p of peopleOut) {
  const file = new URL(`${p.slug}.md`, peopleDir);
  if (!canWrite(file)) continue;
  writeFileSync(file, frontmatter({ name: p.name, nameEn: p.nameEn, kind: p.kind, wikidata: p.wikidata, generated: true }));
}

console.log(`টাইটেল: ${records.size} (লেখা ${written}, হাতে সম্পাদিত বলে রাখা ${kept})`, counts);
console.log(`প্রোফাইল: ${peopleOut.length}`);
console.log(`মোট ফাইল: titles ${readdirSync(titleDir).length}, people ${readdirSync(peopleDir).length}`);
