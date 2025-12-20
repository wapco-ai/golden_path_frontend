import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  // base: process.env.BASE_URL || '/',
  base: isProd ? '/' : '/',
  // Add this for PWA  
  publicDir: 'public',
  resolve: {
    alias: {
      'mapbox-gl': 'maplibre-gl'
    }
  },
  server: {
    host: '0.0.0.0'
  },
  preview: {
    port: 80,
  },
  //base: './', // This helps with relative paths in the production build
  plugins: [  
    react(),  
    VitePWA({  
      registerType: 'autoUpdate',  
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],  
      manifest: {  
        name: 'golden path',  
        short_name: 'goldenPath',  
        description: 'اپلیکیشن GPS Validity برای ردیابی موقعیت با دقت بالا',  
        theme_color: '#ffffff',  
        background_color: '#f0f2f5',  
        display: 'standalone',  
        scope: '/',  
        start_url: '/',  
        icons: [  
          {  
            src: '/icons/pwa-192x192.png',  
            sizes: '192x192',  
            type: 'image/png'  
          },  
          {  
            src: '/icons/pwa-512x512.png',  
            sizes: '512x512',  
            type: 'image/png'  
          },  
          {  
            src: '/icons/pwa-512x512.png',  
            sizes: '512x512',  
            type: 'image/png',  
            purpose: 'maskable'  
          }  
        ]  
      },  
      workbox: {  
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],  
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Set to 5 MiB for example
        runtimeCaching: [  
          {  
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/,   
            handler: 'CacheFirst',  
            options: {  
              cacheName: 'mapbox-cache',  
              expiration: {  
                maxEntries: 50,  
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 روز  
              }  
            }  
          },  
          {  
            urlPattern: /^https:\/\/unpkg\.com\/.*/,   
            handler: 'CacheFirst',  
            options: {  
              cacheName: 'unpkg-cache',  
              expiration: {  
                maxEntries: 10,  
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 روز  
              }  
            }  
          },  
          {  
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),  
            handler: 'NetworkFirst',  
            options: {  
              cacheName: 'api-cache',  
              expiration: {  
                maxEntries: 100,  
                maxAgeSeconds: 60 * 60 * 24 // 1 روز  
              },  
              networkTimeoutSeconds: 10  
            }  
          }  
        ]  
      }  
    })  
  ]  
});  