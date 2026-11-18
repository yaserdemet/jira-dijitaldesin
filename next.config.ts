import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  // Tek derleme işçisi: az RAM'li makinede "Jest worker ... child process exceptions" çökmesini önler.
  // Uygulamada yalnızca birkaç sayfa olduğu için derleme süresi pratikte değişmez.
  experimental: { cpus: 1 },
  async headers() { return [{source: '/(.*)', headers: [
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}
  ]}] }
};
export default config;
