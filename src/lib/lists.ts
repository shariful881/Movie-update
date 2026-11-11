import type { CollectionEntry } from 'astro:content';
import { bn } from './format';

type T = CollectionEntry<'titles'>;
export interface ListDef {
  slug: string;
  title: string;
  description: string;
  match: (t: T) => boolean;
}

const fixed: ListDef[] = [
  {
    slug: 'bangla-dubbing',
    title: 'বাংলা ডাবিং করা বিদেশি সিরিয়াল ও সিনেমা',
    description: 'তুর্কি, কোরিয়ানসহ যেসব বিদেশি সিরিয়াল ও সিনেমা বাংলা ডাবিংয়ে বাংলাদেশের ওটিটিতে দেখা যায়।',
    match: (t) => t.data.dubbed,
  },
  {
    slug: 'turkish-serial',
    title: 'বাংলা ডাবিং তুর্কি সিরিয়াল',
    description: 'সুলতান সুলেমানসহ যেসব তুর্কি ধারাবাহিক বাংলায় দেখা যায়, পর্ব সংখ্যা আর কোথায় দেখবেন।',
    match: (t) => t.data.origin === 'তুরস্ক',
  },
  {
    slug: 'bangladeshi-cinema',
    title: 'বাংলাদেশি সিনেমা কোথায় দেখবেন',
    description: 'ঢালিউডের যেসব সিনেমা এখন ওটিটিতে দেখা যায়, আর কোনটা কোন প্ল্যাটফর্মে।',
    match: (t) => t.data.type === 'movie' && t.data.origin === 'বাংলাদেশ',
  },
  {
    slug: 'kolkata-cinema',
    title: 'কলকাতার বাংলা সিনেমা কোথায় দেখবেন',
    description: 'টালিগঞ্জের যেসব বাংলা সিনেমা বাংলাদেশের ওটিটি প্ল্যাটফর্মে পাওয়া যায়।',
    match: (t) => t.data.type === 'movie' && t.data.origin === 'ভারত',
  },
  {
    slug: 'free',
    title: 'ফ্রিতে দেখা যায় এমন সিনেমা, নাটক ও সিরিজ',
    description: 'বাংলাদেশের ওটিটিতে বিনা সাবস্ক্রিপশনে বৈধভাবে দেখা যায় এমন কনটেন্ট।',
    match: (t) => t.data.availability.some((a) => a.note?.includes('ফ্রি')),
  },
];

// অন্তত ৩টা সিনেমা আছে এমন প্রতিটা বছরের তালিকা
export function allLists(titles: T[]): ListDef[] {
  const years = new Map<number, number>();
  for (const t of titles) if (t.data.type === 'movie' && t.data.year) years.set(t.data.year, (years.get(t.data.year) ?? 0) + 1);
  const yearLists = [...years]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[0] - a[0])
    .map(([y]) => ({
      slug: `cinema-${y}`,
      title: `${bn(y)} সালের বাংলা সিনেমা কোথায় দেখবেন`,
      description: `${bn(y)} সালে মুক্তি পাওয়া বাংলা সিনেমাগুলো এখন কোন ওটিটিতে দেখা যায়।`,
      match: (t: T) => t.data.type === 'movie' && t.data.year === y,
    }));
  return [...fixed, ...yearLists].filter((l) => titles.some(l.match));
}
