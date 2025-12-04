import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'prompt',
          includeAssets: ['favicon.ico', 'vite.svg'],
          manifest: {
            name: 'LoanSage - Microfinance Platform',
            short_name: 'LoanSage',
            description: 'Enterprise-grade microfinance SaaS platform',
            theme_color: '#0ea5e9',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            scope: '/',
            icons: [
              {
                src: '/vite.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable',
              },
              {
                src: '/vite.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
              },
              {
                src: '/vite.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'firebase-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24,
                  },
                  networkTimeoutSeconds: 10,
                },
              },
              {
                urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'googleapis-cache',
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 60 * 60 * 24 * 7,
                  },
                },
              },
              {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images-cache',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24 * 30,
                  },
                },
              },
            ],
            skipWaiting: true,
            clientsClaim: true,
          },
          devOptions: {
            enabled: true,
            type: 'module',
          },
        }) as any,
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      css: {
        postcss: './postcss.config.js',
      },
      optimizeDeps: {
        include: ['react-is'],
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'ui-vendor': ['lucide-react', 'framer-motion'],
            },
          },
        },
      },
    };
});
