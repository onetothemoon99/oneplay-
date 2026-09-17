import type { MetadataRoute } from 'next';

/* ---------------------------------------------------------
   Served at /manifest.webmanifest, straight from the app root —
   there's no per-locale variant. `proxy.ts` has to let this path
   through unprefixed (see its matcher) or the locale redirect turns
   every fetch of it into a 404 and the app stops being installable.
--------------------------------------------------------- */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OnePlay — play instantly in your browser',
    short_name: 'OnePlay',
    description:
      'A cloud library of arcade titles. Pick a game, press start, play in the browser. No install, no download.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F3EE',
    theme_color: '#1B1D26',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
