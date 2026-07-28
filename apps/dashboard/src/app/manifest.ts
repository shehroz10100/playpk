import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PlayPK',
    short_name: 'PlayPK',
    description: 'Discover venues, book courts, join matches, and climb the ranks across Pakistan.',
    start_url: '/discover',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0B1F3A',
    theme_color: '#0B1F3A',
    categories: ['sports', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
