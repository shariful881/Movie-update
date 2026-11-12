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

// প্রতিটা প্ল্যাটফর্মের নামফলকের রং (ব্র্যান্ডের লোগো নয়, শুধু চেনার সুবিধার জন্য)
export const platformColor: Record<string, string> = {
  chorki: '#c2185b',
  hoichoi: '#d84315',
  iscreen: '#283593',
  deeptoplay: '#00796b',
  addatimes: '#e9a100',
  bongo: '#2e7d32',
  binge: '#6a1b9a',
  toffee: '#ad1457',
  netflix: '#b71c1c',
  primevideo: '#1565c0',
};

// পোস্টার টাইলের রং: টাইটেলের নাম থেকে স্থির একটা রং, যাতে প্রতিবার একই থাকে
const tilePalette = [
  { bg: '#c2185b', fg: '#ffffff', ink: '#ffd54f' },
  { bg: '#00796b', fg: '#ffffff', ink: '#ffcc80' },
  { bg: '#283593', fg: '#ffffff', ink: '#f48fb1' },
  { bg: '#e9a100', fg: '#1c2030', ink: '#b71c1c' },
  { bg: '#2e7d32', fg: '#ffffff', ink: '#fff176' },
  { bg: '#d84315', fg: '#ffffff', ink: '#fff59d' },
  { bg: '#4a148c', fg: '#ffffff', ink: '#80deea' },
  { bg: '#006064', fg: '#ffffff', ink: '#ffab91' },
];
export const tileColors = (key: string) => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return tilePalette[h % tilePalette.length];
};

// যাচাই হয়েছে (lastVerified আছে) এমন পাতাই গুগলে ইনডেক্স হয়
export const isVerified = (t: { data: { lastVerified?: Date } }) => Boolean(t.data.lastVerified);
