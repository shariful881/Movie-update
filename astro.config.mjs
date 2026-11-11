// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL আর BASE_PATH না দিলে ধরে নেয় সাইট নিজের ডোমেইনে চলছে (যেমন Cloudflare Pages)।
// GitHub Pages-এর জন্য এগুলো .github/workflows/deploy.yml থেকে আসে।
// ডোমেইন কেনার পর নিচের ঠিকানাটা আসল ডোমেইন দিয়ে বদলাবেন।
export default defineConfig({
  site: process.env.SITE_URL || 'https://cinekhoj.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
});
