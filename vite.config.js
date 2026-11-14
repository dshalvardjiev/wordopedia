import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';

// One build per instance: VITE_INSTANCE picks dictionary/instances/<id>.json, VITE_ENV is production or staging.
// scripts/build-all.mjs runs this once per instance; a plain "vite build" builds the "production" instance.
const INSTANCE = process.env.VITE_INSTANCE || 'production';
const ENV = process.env.VITE_ENV || 'production';
const inst = JSON.parse(fs.readFileSync(new URL(`./dictionary/instances/${INSTANCE}.json`, import.meta.url), 'utf8'));
const NAME = (ENV === 'production' ? '' : `[${ENV}] `) + (inst.name || 'Wordopedia');

// base './' lets the same build run from any folder: /wordopedia/production/, /wordopedia/lora/, /wordopedia/staging/.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: NAME,
        short_name: inst.short_name || NAME,
        description: 'Думи на немски, френски и английски с превод на български',
        lang: 'bg',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F2F5FA',
        theme_color: '#F2F5FA',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // No navigation fallback: a service worker whose scope contains another instance's folder would otherwise
        // answer navigations there with its own index.html. Each folder's index.html is precached under its own URL.
        navigateFallback: null,
        runtimeCaching: [{
          urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
        }],
      },
    }),
  ],
});
