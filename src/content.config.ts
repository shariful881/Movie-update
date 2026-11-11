import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const source = z.object({ name: z.string(), url: z.string().url() });

// প্রতিটা সিনেমা, নাটক, সিরিজ, টিভি শো বা মাইক্রো ড্রামা: src/content/titles/<slug>.md
// generated: true মানে ফাইলটা স্ক্রিপ্ট বানিয়েছে; হাতে সম্পাদনা করলে generated: false করে দিন,
// তাহলে স্ক্রিপ্ট আর কখনো ফাইলটা বদলাবে না।
const titles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/titles' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string(),
    type: z.enum(['movie', 'series', 'natok', 'tvshow', 'microdrama']),
    year: z.number().optional(),
    summary: z.string().optional(),
    releaseDate: z.coerce.date().optional(),
    releaseNote: z.string().optional(),
    ottReleaseDate: z.coerce.date().optional(),
    runtimeMinutes: z.number().optional(),
    seasons: z.number().optional(),
    episodes: z.number().optional(),
    genres: z.array(z.string()).default([]),
    director: z.string().optional(),
    production: z.string().optional(),
    language: z.string().default('বাংলা'),
    origin: z.string().optional(),
    dubbed: z.boolean().default(false),
    ageRating: z.string().optional(),
    // id = src/content/people-এর ফাইলের নাম (প্রোফাইল পাতা থাকলে)
    cast: z.array(z.object({ name: z.string(), role: z.string().optional(), id: z.string().optional() })).default([]),
    crew: z.array(z.object({ name: z.string(), job: z.enum(['director', 'producer', 'company']), id: z.string().optional() })).default([]),
    // যেখানে নিজে যাচাই করে পেয়েছেন শুধু সেগুলো
    availability: z
      .array(
        z.object({
          platform: reference('platforms'),
          url: z.string().url().optional(),
          note: z.string().optional(),
        }),
      )
      .default([]),
    // যেসব জায়গায় খুঁজেছেন (পাওয়া যাক বা না যাক)
    checkedPlatforms: z.array(z.string()).default([]),
    // এই তারিখ না থাকলে পাতাটা গুগলে ইনডেক্স হবে না (noindex) আর সাইটম্যাপে থাকবে না
    lastVerified: z.coerce.date().optional(),
    family: z
      .object({
        verdict: z.enum(['yes', 'caution', 'no']),
        text: z.string(),
        items: z.array(z.object({ label: z.string(), level: z.enum(['low', 'mid', 'high']), text: z.string() })).default([]),
      })
      .optional(),
    facts: z.array(z.object({ heading: z.string(), text: z.string() })).default([]),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    sources: z.array(source).default([]),
    wikidata: z.string().optional(),
    generated: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

// প্রতিটা ওটিটি প্ল্যাটফর্ম: src/content/platforms/<slug>.md
const platforms = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/platforms' }),
  schema: z.object({
    name: z.string(),
    nameEn: z.string(),
    url: z.string().url(),
    affiliateUrl: z.string().url().optional(),
    access: z.enum(['paid', 'free', 'mixed', 'unknown']),
    tagline: z.string(),
    highlights: z.array(z.string()).default([]),
    lastVerified: z.coerce.date().optional(),
    sources: z.array(source).default([]),
    order: z.number().default(100),
  }),
});

// অভিনেতা, পরিচালক, প্রযোজক, প্রযোজনা প্রতিষ্ঠান: src/content/people/<slug>.md
const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string(),
    nameEn: z.string(),
    kind: z.enum(['person', 'company']).default('person'),
    wikidata: z.string().optional(),
    generated: z.boolean().default(false),
  }),
});

export const collections = { titles, platforms, people };
