import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { allLists } from '../lib/lists';
import { link, personUrl, titleUrl, typePath, type TitleType } from '../lib/format';

// শুধু যাচাই করা পাতা (বা যাচাই করা পাতা আছে এমন তালিকা) সাইটম্যাপে যায়
export const GET: APIRoute = async ({ site }) => {
  const titles = await getCollection('titles', ({ data }) => !data.draft);
  const verified = titles.filter((t) => t.data.lastVerified);
  const vIds = new Set(verified.map((t) => t.id));
  const people = await getCollection('people');
  const platforms = await getCollection('platforms');

  const paths = [
    '/',
    '/platform/',
    '/person/',
    '/list/',
    '/amader-kotha/',
    '/kivabe-jachai-kori/',
    '/jogajog/',
    '/privacy-policy/',
  ].map(link);
  paths.push(...platforms.map((p) => link(`/platform/${p.id}/`)));
  for (const t of Object.keys(typePath) as TitleType[]) if (verified.some((v) => v.data.type === t)) paths.push(link(`/${typePath[t]}/`));
  paths.push(...verified.map(titleUrl));
  for (const p of people) {
    if (titles.some((t) => vIds.has(t.id) && (t.data.cast.some((c) => c.id === p.id) || t.data.crew.some((c) => c.id === p.id)))) paths.push(personUrl(p.id));
  }
  for (const l of allLists(titles)) if (verified.some(l.match)) paths.push(link(`/list/${l.slug}/`));

  const lastmod = (p: string) => {
    const t = verified.find((v) => titleUrl(v) === p);
    return t?.data.lastVerified ? `<lastmod>${t.data.lastVerified.toISOString().slice(0, 10)}</lastmod>` : '';
  };
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(paths)].map((p) => `<url><loc>${new URL(p, site)}</loc>${lastmod(p)}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
