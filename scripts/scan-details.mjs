// দীপ্ত প্লে আর আই স্ক্রিনের প্রতিটা কনটেন্টের পাতা থেকে বিস্তারিত তথ্য নেয়।
// দীপ্ত প্লে: মুক্তির তারিখ, সিজন, মোট পর্ব, ধরন, অভিনয়শিল্পী, পরিচালক, দেশি না বিদেশি।
// আই স্ক্রিন: পাতাটা সিনেমা, সিরিজ না অন্য কিছু (og:type), আর বিবরণের শব্দ দেখে ধরন।
// কাহিনি সংক্ষেপ বা ছবি সংরক্ষণ করে না; শুধু কাঠামোবদ্ধ তথ্য।
// আগে একবার পড়া আই স্ক্রিনের পাতা আবার পড়ে না (data/details.json-এ রাখা থাকে)।
// চালানো: node scripts/scan-details.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { parseSitemap } from './scan-ott.mjs';

const UA = 'CineKhojBot/1.0 (+https://shariful881.github.io/Movie-update/)';
const DATA = new URL('../data/', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) }).catch(() => null);
    await sleep(1000);
    if (res?.ok) return res.text();
    if (res && res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status}`);
    await sleep(4000 * (i + 1));
  }
  throw new Error('বারবার ব্যর্থ');
}

const decode = (s) =>
  s.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const slugTitle = (url) =>
  decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i'));
  return m ? decode(m[1]) : '';
};

const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((m) => {
      try {
        const d = JSON.parse(m[1]);
        return Array.isArray(d) ? d : [d];
      } catch {
        return [];
      }
    })
    .filter((d) => !['BreadcrumbList', 'Organization', 'WebSite'].includes(d['@type']));

// বিবরণের শব্দ দেখে মূল দেশ আন্দাজ (বিবরণ নিজে সংরক্ষণ হয় না)
const ORIGINS = [
  [/turk|turkey|তুর্ক/i, 'তুরস্ক'],
  [/korea|কোরিয়/i, 'দক্ষিণ কোরিয়া'],
  [/\bindian\b|\bhindi\b|bollywood|ভারতীয়|হিন্দি/i, 'ভারত'],
  [/pakistan|\burdu\b|পাকিস্তান/i, 'পাকিস্তান'],
  [/chinese|\bchina\b|চীন/i, 'চীন'],
  [/arab|আরব/i, 'আরব'],
  [/iran|persian|ইরান/i, 'ইরান'],
  [/spanish|\bspain\b|mexic|স্প্যানিশ/i, 'স্পেন/লাতিন আমেরিকা'],
];
const originOf = (text, names = '') => {
  for (const [re, c] of ORIGINS) if (re.test(text)) return c;
  if (/[ğşıİçöüÇÖÜŞĞ]/.test(names)) return 'তুরস্ক';
  return '';
};

// দীপ্ত প্লের পাতার ভেতরের ডেটা (Next.js) থেকে একটা তালিকার নামগুলো
function titlesOf(text, key) {
  const i = text.indexOf(`"${key}":[`);
  if (i < 0) return [];
  let depth = 0;
  let j = i + key.length + 4; // "[" এর ঠিক পরের অক্ষর
  for (; j < text.length; j++) {
    if (text[j] === '[') depth++;
    else if (text[j] === ']') {
      if (depth === 0) break;
      depth--;
    }
  }
  return [...new Set([...text.slice(i, j).matchAll(/"type":"[a-z-]+","slug":"[^"]*","title":"([^"]+)"/g)].map((m) => m[1]))];
}

async function deepto(url, kind) {
  const html = await get(url);
  const text = html.replace(/\\\\"/g, '"').replace(/\\"/g, '"');
  const ld = jsonLd(html)[0] ?? {};
  const m = text.match(/"release_date":"(\d{4}-\d{2}-\d{2})","total_seasons":(\d+),"total_episodes":(\d+),"description":"((?:[^"\\]|\\.)*)"/);
  const casts = titlesOf(text, 'casts');
  const directors = Array.isArray(ld.director) ? ld.director.map((d) => d.name).join(', ') : ld.director || '';
  const desc = m?.[4] ?? ld.description ?? '';
  return {
    platform: 'deeptoplay',
    url,
    kind,
    title: decode(ld.name || meta(html, 'og:title').replace(/^Watch\s+|\s+Full HD online on DeeptoPlay$/gi, '') || slugTitle(url)),
    release: m?.[1] ?? '',
    seasons: m ? Number(m[2]) : '',
    episodes: m ? Number(m[3]) : '',
    genres: titlesOf(text, 'genres').join(', ') || ld.genre || '',
    cast: casts.join(', '),
    directors,
    origin: originOf(desc, `${casts.join(' ')} ${directors}`) || 'বাংলাদেশ',
  };
}

const SKIP = /highlight|\bvs\b|\bodi\b|\bt20\b|\bcup\b|\bmatch\b|\blive\b|\bnews\b|\btv\b|channel|trailer|teaser|promo|top ?10|award|audio test/i;

async function iscreen(url) {
  const html = await get(url);
  const ogType = meta(html, 'og:type');
  const title = meta(html, 'og:title').replace(/\s*—\s*Watch on iScreen\s*$/i, '');
  const desc = meta(html, 'og:description');
  const ld = jsonLd(html)[0] ?? {};
  let kind = 'অন্যান্য';
  if (ogType === 'video.tv_show' || ld['@type'] === 'TVSeries') kind = 'সিরিজ';
  else if (SKIP.test(title)) kind = 'বাদ';
  else if (/\bsong\b|music video|\bgaan\b|গান/i.test(desc + ' ' + title)) kind = 'গান';
  else if (/telefilm|tele-film|টেলিফিল্ম/i.test(desc)) kind = 'টেলিফিল্ম';
  else if (/\bnatok\b|\bdrama\b|নাটক/i.test(desc) && !/\bmovie\b|\bfilm\b|সিনেমা|চলচ্চিত্র/i.test(desc)) kind = 'নাটক';
  else if (ogType === 'video.movie') kind = 'সিনেমা';
  return {
    platform: 'iscreen',
    url,
    kind,
    og_type: ogType,
    title,
    release: (ld.uploadDate || ld.datePublished || '').slice(0, 10),
    access: ld.requiresSubscription === true ? 'পেইড' : ld.requiresSubscription === false ? 'ফ্রি' : '',
    origin: originOf(desc) || '',
  };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  let cache = {};
  try {
    cache = Object.fromEntries(JSON.parse(await readFile(new URL('details.json', DATA), 'utf8')).map((d) => [d.url, d]));
  } catch {}

  const results = [];
  const errors = [];

  // দীপ্ত প্লে: সিরিজ, টিভি শো, মাইক্রো ড্রামা (প্রতিবার নতুন করে, কারণ পর্ব বাড়ে)
  const deep = parseSitemap(await get('https://www.deeptoplay.com/sitemap.xml')).entries;
  const seen = new Set();
  for (const e of deep) {
    const s = new URL(e.loc).pathname.split('/').filter(Boolean);
    if (s.length !== 2 || !['series', 'tv-shows', 'micro-drama'].includes(s[0]) || seen.has(e.loc)) continue;
    seen.add(e.loc);
    try {
      results.push(await deepto(e.loc, { series: 'ধারাবাহিক/সিরিজ', 'tv-shows': 'টিভি শো', 'micro-drama': 'মাইক্রো ড্রামা' }[s[0]]));
    } catch (err) {
      errors.push(`${e.loc}: ${err.message}`);
    }
  }

  // আই স্ক্রিন: শুধু আগে না পড়া পাতা
  const isc = parseSitemap(await get('https://iscreen.com.bd/sitemap.xml')).entries;
  for (const e of isc) {
    const s = new URL(e.loc).pathname.split('/').filter(Boolean);
    if (s[0] !== 'content' || s[1] !== 'details' || s.length !== 4 || seen.has(e.loc)) continue;
    seen.add(e.loc);
    if (cache[e.loc]?.platform === 'iscreen') {
      results.push(cache[e.loc]);
      continue;
    }
    try {
      results.push(await iscreen(e.loc));
    } catch (err) {
      errors.push(`${e.loc}: ${err.message}`);
    }
  }

  await writeFile(new URL('details.json', DATA), JSON.stringify(results, null, 1));
  const cols = ['platform', 'kind', 'title', 'release', 'seasons', 'episodes', 'genres', 'origin', 'access', 'directors', 'cast', 'og_type', 'url'];
  await writeFile(new URL('details.csv', DATA), [cols.join(','), ...results.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
  const count = {};
  for (const r of results) count[`${r.platform} / ${r.kind}`] = (count[`${r.platform} / ${r.kind}`] ?? 0) + 1;
  const report = ['# বিস্তারিত স্ক্যান', '', `সময়: ${new Date().toISOString()}`, '', ...Object.entries(count).sort().map(([k, v]) => `- ${k}: ${v}`), '', `ত্রুটি: ${errors.length}`, ...errors.slice(0, 30).map((e) => `- ${e}`)];
  await writeFile(new URL('details-report.md', DATA), report.join('\n') + '\n');
  console.log(report.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
