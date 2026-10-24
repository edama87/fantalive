import type { MetadataRoute } from 'next';

/** Manifest PWA: necessario perché iOS/Android installino FantaLive come app (display standalone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FantaLive Bundlesliga',
    short_name: 'FantaLive',
    description: 'Live fantacalcio head-to-head per la Bundlesliga',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f9fafb',
    theme_color: '#059669',
    lang: 'it',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
