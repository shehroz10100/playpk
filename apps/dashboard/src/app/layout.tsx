import type { Metadata } from 'next';
import { Outfit, Syne } from 'next/font/google';
import { QueryProvider } from '@/components/query-provider';
import './globals.css';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'PlayPK — Book courts across Pakistan',
  description: 'Discover venues, book courts, join matches, and climb the ranks with PlayPK.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${syne.variable} font-sans antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
