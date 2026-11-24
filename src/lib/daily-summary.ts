import { createHash, timingSafeEqual } from 'node:crypto';

// Türkiye 2016'dan beri yaz saati uygulamıyor, sabit UTC+3. "Bugün" İstanbul gününe göre sayılır.
export function istanbulDayStart(now: Date): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

// Uzunluk farkı da sızmasın diye iki tarafın özeti karşılaştırılır.
export function tokenMatches(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// Token önce Authorization başlığından, yoksa ?token= parametresinden okunur
// (bazı zamanlanmış görev araçları başlık gönderemiyor).
export function requestToken(req: Request): string | null {
  const header = req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  return header ?? new URL(req.url).searchParams.get('token');
}
