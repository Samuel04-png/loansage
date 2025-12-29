import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // For GitHub Pages, use repository name as base path
    // Change 'tengaloans' to your repository name if different
    const base = process.env.GITHUB_PAGES === 'true' ? '/tengaloans/' : '/';
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          // Allow Firebase Auth popups to work correctly
          // These headers prevent COOP policy from blocking popup communication
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
          'Cross-Origin-Embedder-Policy': 'unsafe-none',
        },
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'prompt',
          // Note: Icon files are handled by the manifest.icons config below
          // Don't include them in includeAssets to avoid cache conflicts
          includeAssets: ['logo/tengaloanlogo.png', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
          manifest: {
            name: 'TengaLoans - Microfinance Platform',
            short_name: 'TengaLoans',
            description: 'Enterprise-grade microfinance SaaS platform',
            theme_color: '#006BFF',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            scope: '/',
            icons: [
              {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
              },
              {
                src: '/android-chrome-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/android-chrome-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
            // Note: Don't duplicate entries - icons are already in includeAssets above
            // Using globIgnores to prevent caching conflicts with PWA manifest icons
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
            enabled: false, // Disable service worker in development to avoid connection errors
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
