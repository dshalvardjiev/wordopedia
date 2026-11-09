import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' works both on GitHub Pages (/wordopedia/) and on any other static host.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Wordopedia',
        short_name: 'Wordopedia',
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
        runtimeCaching: [{
          urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
        }],
      },
    }),
  ],
});
