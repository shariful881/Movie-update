// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// ডোমেইন কেনার পর নিচের ঠিকানাটা আসল ডোমেইন দিয়ে বদলাবেন।
export default defineConfig({
  site: 'https://cinekhoj.com',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
