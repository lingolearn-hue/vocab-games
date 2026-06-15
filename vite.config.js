import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Vocab Games',
        short_name: 'VocabGames',
        description: 'Language learning games — Chinese, Japanese, German, Spanish, English',
        theme_color: '#4f7ef8',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache all app assets; vocab/reader JSON files cached on first access
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Cache vocab, grammar, sentences, dialogues, reader JSON
            urlPattern: /\.(json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vocab-data',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
  base: process.env.VITE_BASE ?? './',
})
