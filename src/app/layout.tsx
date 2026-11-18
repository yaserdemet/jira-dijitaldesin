import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { themeBootScript } from '@/lib/theme';
import './globals.css';

// Başlıklar için karakterli bir grotesk, arayüz için sakin bir sans. İkisi de Türkçe karakterleri içerir.
const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], variable: '--font-brand-display' });
const ui = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-brand-ui' });

export const metadata: Metadata = {
  title: 'Dijitaldesin | Jira',
  description: 'Ajansın talepleri tek panoda.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Tema betiği <html>'e data-base/data-accent yazar; sunucu çıktısıyla farkı beklenen bir durum.
    <html lang="tr" className={`${display.variable} ${ui.variable}`} suppressHydrationWarning>
      {/* Bazı tarayıcı eklentileri <head>e öznitelik ekliyor; bu uyuşmazlık bizim kodumuzdan değil. */}
      <head suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      {/* Bazı eklentiler (ColorZilla, Grammarly, LastPass) <body>'ye öznitelik ekler; hidrasyon uyarısı bundan çıkar. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
