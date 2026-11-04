import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Akış — Ajans çalışma alanı',description:'Ajansınızın tüm işleri, aynı akışta.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="tr"><body>{children}</body></html> }
