// data/catalog.csv-এর প্রতিটা সিনেমার জন্য উইকিডাটা থেকে তথ্য আনে:
// বাংলা নাম, মুক্তির তারিখ, পরিচালক, প্রযোজক, প্রযোজনা প্রতিষ্ঠান, অভিনয়শিল্পী।
// মিল ধরে শুধু তখনই, যখন উইকিডাটার আইটেমটা বাংলা ভাষার চলচ্চিত্র।
// একাধিক বাংলা চলচ্চিত্র একই নামে থাকলে কোনোটা বেছে না নিয়ে "একাধিক মিল" লেখে।
// ফলাফল: data/movies-details.csv
// চালানো: node scripts/enrich-movies.mjs

import { readFile, writeFile } from 'node:fs/promises';

const UA = 'CineKhojBot/1.0 (https://shariful881.github.io/Movie-update/; data enrichment)';
const DATA = new URL('../data/', import.meta.url);
const BENGALI = 'Q9610';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json, application/json' } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * (i + 1)); continue; }
    throw new Error(`${url.slice(0, 120)} → HTTP ${res.status}`);
  }
  throw new Error(`বারবার ব্যর্থ: ${url.slice(0, 120)}`);
}

// উইকিডাটায় নাম দিয়ে খোঁজা (ইংরেজি ও বাংলা দুই ভাষায়)
async function search(title) {
  const ids = new Set();
  for (const lang of ['en', 'bn']) {
    const u = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=10&language=${lang}&uselang=${lang}&search=${encodeURIComponent(title)}`;
    const j = await getJson(u);
    for (const s of j.search ?? []) ids.add(s.id);
    await sleep(300);
  }
  return [...ids];
}

// প্রার্থী আইটেমগুলোর মধ্যে বাংলা ভাষার চলচ্চিত্রগুলোর বিস্তারিত তথ্য
async function details(qids) {
  if (!qids.length) return [];
  const query = `
SELECT ?film ?bn ?en ?date ?country
  (GROUP_CONCAT(DISTINCT ?dirL; separator="|") AS ?directors)
  (GROUP_CONCAT(DISTINCT ?prodL; separator="|") AS ?producers)
  (GROUP_CONCAT(DISTINCT ?coL; separator="|") AS ?companies)
WHERE {
  VALUES ?film { ${qids.map((q) => `wd:${q}`).join(' ')} }
  ?film wdt:P31/wdt:P279* wd:Q11424 .
  ?film wdt:P364 wd:${BENGALI} .
  OPTIONAL { ?film rdfs:label ?bn FILTER(LANG(?bn) = "bn") }
  OPTIONAL { ?film rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?film wdt:P577 ?date }
  OPTIONAL { ?film wdt:P495 ?c . ?c rdfs:label ?country FILTER(LANG(?country) = "en") }
  OPTIONAL { ?film wdt:P57 ?d . ?d rdfs:label ?dirL FILTER(LANG(?dirL) = "en") }
  OPTIONAL { ?film wdt:P162 ?p . ?p rdfs:label ?prodL FILTER(LANG(?prodL) = "en") }
  OPTIONAL { ?film wdt:P272 ?co . ?co rdfs:label ?coL FILTER(LANG(?coL) = "en") }
}
GROUP BY ?film ?bn ?en ?date ?country`;
  const j = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`);
  await sleep(1000);
  const byFilm = new Map();
  for (const b of j.results.bindings) {
    const id = b.film.value.split('/').pop();
    const cur = byFilm.get(id) ?? { qid: id, bn: '', en: '', dates: new Set(), countries: new Set(), directors: '', producers: '', companies: '' };
    if (b.bn) cur.bn = b.bn.value;
    if (b.en) cur.en = b.en.value;
    if (b.date) cur.dates.add(b.date.value.slice(0, 10));
    if (b.country) cur.countries.add(b.country.value);
    if (b.directors?.value) cur.directors = b.directors.value.split('|').join(', ');
    if (b.producers?.value) cur.producers = b.producers.value.split('|').join(', ');
    if (b.companies?.value) cur.companies = b.companies.value.split('|').join(', ');
    byFilm.set(id, cur);
  }
  return [...byFilm.values()];
}

// অভিনয়শিল্পী, উইকিডাটায় যে ক্রমে আছে (ক্রমিক নম্বর থাকলে সেই অনুযায়ী)
async function cast(qid) {
  const query = `
SELECT ?actorL ?ord WHERE {
  wd:${qid} p:P161 ?st . ?st ps:P161 ?a .
  OPTIONAL { ?st pq:P1545 ?ord }
  OPTIONAL { ?a rdfs:label ?actorL FILTER(LANG(?actorL) = "en") }
}`;
  const j = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`);
  await sleep(1000);
  return j.results.bindings
    .map((b, i) => ({ name: b.actorL?.value ?? '', ord: b.ord ? Number(b.ord.value) : 1000 + i }))
    .filter((x) => x.name)
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.name);
}

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const catalog = parseCsv(await readFile(new URL('catalog.csv', DATA), 'utf8'));
  const movies = catalog.filter((r) => r.kind === 'movie');
  const out = [];
  for (const m of movies) {
    const row = { title: m.title, platform: m.platform, url: m.url, status: '', qid: '', bn: '', date: '', country: '', directors: '', producers: '', companies: '', cast: '' };
    try {
      const films = await details(await search(m.title));
      // নামের সাথে হুবহু মেলে এমনগুলো আগে
      const exact = films.filter((f) => norm(f.en) === norm(m.title));
      const pool = exact.length ? exact : films;
      if (!pool.length) row.status = 'উইকিডাটায় পাওয়া যায়নি';
      else if (pool.length > 1) {
        row.status = 'একাধিক মিল';
        row.qid = pool.map((f) => f.qid).join(' ');
      } else {
        const f = pool[0];
        row.status = exact.length ? 'মিলেছে' : 'আংশিক নাম মিলেছে';
        row.qid = f.qid;
        row.bn = f.bn;
        row.date = [...f.dates].sort()[0] ?? '';
        row.country = [...f.countries].join(', ');
        row.directors = f.directors;
        row.producers = f.producers;
        row.companies = f.companies;
        row.cast = (await cast(f.qid)).join(', ');
      }
    } catch (e) {
      row.status = `ত্রুটি: ${e.message}`;
    }
    out.push(row);
    console.log(`${row.status} | ${m.title} | ${row.qid}`);
  }
  const cols = ['title', 'bn', 'platform', 'status', 'date', 'directors', 'producers', 'companies', 'cast', 'country', 'qid', 'url'];
  await writeFile(new URL('movies-details.csv', DATA), [cols.join(','), ...out.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
