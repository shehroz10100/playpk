import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { QueryProvider } from '@/components/query-provider';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PlayPK — Book courts across Pakistan',
    template: '%s · PlayPK',
  },
  description: 'Discover venues, book courts, join matches, and climb the ranks with PlayPK.',
  applicationName: 'PlayPK',
  authors: [{ name: 'PlayPK' }],
  generator: 'Next.js',
  keywords: ['PlayPK', 'sports', 'court booking', 'Pakistan', 'cricket', 'padel', 'futsal'],
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    title: 'PlayPK',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0B1F3A' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1F3A' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${barlow.variable} ${barlowCondensed.variable} font-sans antialiased touch-manipulation`}
      >
        <QueryProvider>{children}</QueryProvider>
        <PwaRegister />
        <SpeedInsights />
      </body>
    </html>
  );
}
