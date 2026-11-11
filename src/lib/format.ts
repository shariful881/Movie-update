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

export type TitleType = 'movie' | 'series' | 'natok' | 'tvshow' | 'microdrama';

export const typeLabel: Record<TitleType, string> = {
  movie: 'সিনেমা',
  series: 'সিরিজ ও ধারাবাহিক',
  natok: 'নাটক ও টেলিফিল্ম',
  tvshow: 'টিভি শো',
  microdrama: 'মাইক্রো ড্রামা',
};
export const typeSingular: Record<TitleType, string> = {
  movie: 'সিনেমা',
  series: 'সিরিজ',
  natok: 'নাটক',
  tvshow: 'টিভি শো',
  microdrama: 'মাইক্রো ড্রামা',
};
export const typePath: Record<TitleType, string> = {
  movie: 'movie',
  series: 'series',
  natok: 'natok',
  tvshow: 'tv-show',
  microdrama: 'micro-drama',
};

export const accessLabel = { paid: 'সাবস্ক্রিপশন লাগে', free: 'ফ্রি', mixed: 'ফ্রি ও পেইড দুটোই', unknown: 'দাম যাচাই করা বাকি' } as const;

export const jobLabel = { director: 'পরিচালক', producer: 'প্রযোজক', company: 'প্রযোজনা প্রতিষ্ঠান', actor: 'অভিনয়শিল্পী' } as const;

// সাইট সাব-ফোল্ডারে থাকলে (যেমন GitHub Pages) প্রতিটা লিংকের আগে সেই ফোল্ডার যোগ করে
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const link = (path: string) => `${base}${path}`;

export const titleUrl = (t: { id: string; data: { type: TitleType } }) => link(`/${typePath[t.data.type]}/${t.id}/`);
export const personUrl = (id: string) => link(`/person/${id}/`);

// যাচাই হয়েছে (lastVerified আছে) এমন পাতাই গুগলে ইনডেক্স হয়
export const isVerified = (t: { data: { lastVerified?: Date } }) => Boolean(t.data.lastVerified);
