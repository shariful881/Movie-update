import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { personUrl, titleUrl, typeSingular } from '../lib/format';

// হেডারের সার্চ বক্সের জন্য ছোট একটা সূচি: নাম, ইংরেজি নাম, ধরন, বছর, লিংক
export const GET: APIRoute = async () => {
  const titles = await getCollection('titles', ({ data }) => !data.draft);
  const people = await getCollection('people');
  const items = [
    ...titles.map((t) => ({
      t: t.data.title,
      e: t.data.titleEn !== t.data.title ? t.data.titleEn : undefined,
      k2: typeSingular[t.data.type] + (t.data.dubbed ? ', বাংলা ডাবিং' : ''),
      y: t.data.year ? String(t.data.year).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]) : undefined,
      u: titleUrl(t),
    })),
    ...people.map((p) => ({
      t: p.data.name,
      e: p.data.nameEn !== p.data.name ? p.data.nameEn : undefined,
      k2: p.data.kind === 'company' ? 'প্রযোজনা প্রতিষ্ঠান' : 'তারকা ও নির্মাতা',
      u: personUrl(p.id),
    })),
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
