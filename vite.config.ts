import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { visualizer } from 'rollup-plugin-visualizer';
import { compression } from 'vite-plugin-compression2';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    solid(),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    // Brotli compression for better compression ratios
    compression({
      algorithm: 'brotliCompress',
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    // PWA with service worker
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.aragon\.org/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'aragon-sdk-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
      manifest: {
        name: 'DAO Deployer',
        short_name: 'DAODeploy',
        description: 'Aragon OSX DAO Deployer with Soul-Bound Token Governance',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    // Bundle visualizer (only in analyze mode)
    process.env.ANALYZE === 'true' && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'vendor-solid': ['solid-js', 'solid-js/store', '@solidjs/router'],
          'vendor-wagmi': ['@wagmi/core', 'viem'],
          'vendor-aragon': ['@aragon/sdk-client'],
          // UI components chunk
          'ui-components': [
            './src/components/LoadingSpinner',
            './src/components/ErrorBoundary',
            './src/components/ToastNotifications',
          ],
        },
        // Asset naming for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff?|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff2?|ttf|otf|eot/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // Code splitting
    cssCodeSplit: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 500,
  },
  optimizeDeps: {
    include: [
      'solid-js',
      'solid-js/store',
      '@solidjs/router',
      '@wagmi/core',
      'viem',
    ],
    exclude: ['@aragon/sdk-client'], // Large package, lazy load
  },
  server: {
    // Enable HTTP/2 push for critical assets
    hmr: {
      overlay: true,
    },
  },
  preview: {
    // Enable compression in preview
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  },
  css: {
    devSourcemap: true,
    postcss: './postcss.config.js',
  },
});
