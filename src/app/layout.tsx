import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import './globals.css';

// Başlıklar için karakterli bir grotesk, arayüz için sakin bir sans. İkisi de Türkçe karakterleri içerir.
const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], variable: '--font-display' });
const ui = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-ui' });

export const metadata: Metadata = {
  title: 'Akış · dijitaldesin',
  description: 'Ajansın talepleri tek panoda.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
