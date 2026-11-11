// একবারের অনুসন্ধান: দীপ্ত প্লে ও আই স্ক্রিনের সাইটম্যাপের কাঠামো আর কয়েকটা পাতার নমুনা।
// ফলাফল data/discovery/-এ যায়, স্ক্যানার বানানো শেষ হলে মুছে ফেলা হবে।
import { mkdir, writeFile } from 'node:fs/promises';
import { parseSitemap } from './scan-ott.mjs';

const UA = 'CineKhojBot/1.0 (+https://shariful881.github.io/Movie-update/)';
const OUT = new URL('../data/discovery/', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => {
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  await sleep(1000);
  return { status: r.status, text: await r.text() };
};

await mkdir(OUT, { recursive: true });
const report = [];

const deep = parseSitemap((await get('https://www.deeptoplay.com/sitemap.xml')).text).entries;
const stats = new Map();
for (const e of deep) {
  const s = new URL(e.loc).pathname.split('/').filter(Boolean);
  const key = `${s[0] ?? '(root)'} | depth ${s.length} | ${s.slice(2).map((x, i) => (i % 2 === 0 ? x : '*')).join('/')}`;
  const cur = stats.get(key) ?? { n: 0, samples: [] };
  cur.n++;
  if (cur.samples.length < 3) cur.samples.push(e.loc);
  stats.set(key, cur);
}
report.push(`# দীপ্ত প্লে সাইটম্যাপ: মোট ${deep.length}টা লিংক`, '');
for (const [k, v] of [...stats].sort((a, b) => b[1].n - a[1].n).slice(0, 60)) report.push(`- ${v.n} × ${k} → ${v.samples.join(' , ')}`);

const pick = (seg) => deep.find((e) => new URL(e.loc).pathname.split('/').filter(Boolean).length === 2 && e.loc.includes(`/${seg}/`))?.loc;
const samples = {
  'deepto-series.html': 'https://www.deeptoplay.com/series/sultan-suleiman',
  'deepto-series-bd.html': 'https://www.deeptoplay.com/series/bokulpur',
  'deepto-micro.html': pick('micro-drama'),
  'deepto-tvshow.html': pick('tv-shows'),
  'iscreen-movie.html': 'https://iscreen.com.bd/content/details/video/dhaka-attack',
  'iscreen-unknown.html': 'https://iscreen.com.bd/content/details/video/aam-kathaler-chhuti',
  'iscreen-series.html': 'https://iscreen.com.bd/content/details/series/poush-faguner-pala',
};
report.push('', '# নমুনা পাতা', '');
for (const [file, url] of Object.entries(samples)) {
  if (!url) continue;
  const { status, text } = await get(url);
  await writeFile(new URL(file, OUT), text);
  report.push(`- ${file}: ${url} → HTTP ${status}, ${text.length} অক্ষর`);
}
await writeFile(new URL('report.md', OUT), report.join('\n') + '\n');
console.log(report.join('\n'));
