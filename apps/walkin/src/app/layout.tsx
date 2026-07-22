import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-barlow-condensed',
});

export const metadata: Metadata = {
  title: 'PlayPK Walk-In Desk',
  description: 'Front-desk walk-in booking for PlayPK venues',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${barlow.variable} ${barlowCondensed.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
