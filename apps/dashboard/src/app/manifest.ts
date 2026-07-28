import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    lang: 'en',
    name: 'PlayPK',
    short_name: 'PlayPK',
    description: 'Discover venues, book courts, join matches, and climb the ranks across Pakistan.',
    start_url: '/discover',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0B1F3A',
    theme_color: '#0B1F3A',
    categories: ['sports', 'lifestyle'],
    shortcuts: [
      {
        name: 'Discover venues',
        short_name: 'Discover',
        url: '/discover',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'My bookings',
        short_name: 'Bookings',
        url: '/my-bookings',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
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
