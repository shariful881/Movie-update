const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

export const bn = (n: number | string) => String(n).replace(/\d/g, (d) => bnDigits[Number(d)]);

export const bnDate = (d?: Date) =>
  d ? `${bn(d.getUTCDate())} ${bnMonths[d.getUTCMonth()]} ${bn(d.getUTCFullYear())}` : '';

export const bnRuntime = (min?: number) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `প্রায় ${h ? `${bn(h)} ঘণ্টা ` : ''}${m ? `${bn(m)} মিনিট` : ''}`.trim();
};

export const typeLabel = { movie: 'সিনেমা', series: 'ওয়েব সিরিজ', natok: 'নাটক' } as const;
export const typePath = { movie: 'movie', series: 'series', natok: 'natok' } as const;

export const accessLabel = { paid: 'সাবস্ক্রিপশন লাগে', free: 'ফ্রি', mixed: 'ফ্রি ও পেইড দুটোই' } as const;

// সাইট সাব-ফোল্ডারে থাকলে (যেমন GitHub Pages) প্রতিটা লিংকের আগে সেই ফোল্ডার যোগ করে
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const link = (path: string) => `${base}${path}`;

export const titleUrl = (t: { id: string; data: { type: 'movie' | 'series' | 'natok' } }) =>
  link(`/${typePath[t.data.type]}/${t.id}/`);
