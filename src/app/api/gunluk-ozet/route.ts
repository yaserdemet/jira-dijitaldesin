import { createClient } from '@supabase/supabase-js';
import { istanbulDayStart, requestToken, tokenMatches } from '@/lib/daily-summary';

// Zamanlanmış e-posta görevi için salt okunur günlük özet.
// Yalnızca GUNLUK_OZET_EMAIL ile eşleşen kişinin işlerini döndürür; başlık ve marka dışında alan vermez.
export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.GUNLUK_OZET_TOKEN;
  const email = process.env.GUNLUK_OZET_EMAIL;
  if (!url || !key || !secret || !email) {
    return Response.json({ error: 'Günlük özet yapılandırılmadı.' }, { status: 503 });
  }

  if (!tokenMatches(requestToken(req), secret)) {
    return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!profile) return Response.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 });

  const since = istanbulDayStart(new Date());

  const [done, doing] = await Promise.all([
    db
      .from('tasks')
      .select('title,brand')
      .eq('assignee_id', profile.id)
      .eq('status', 'Tamamlandı')
      .gte('completed_at', since)
      .order('completed_at'),
    // "Yapılıyor" sütunu: İşlemde + Onay Bekliyor (src/lib/workflow.ts).
    db
      .from('tasks')
      .select('title,brand')
      .eq('assignee_id', profile.id)
      .in('status', ['İşlemde', 'Onay Bekliyor'])
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
  ]);
  const error = done.error ?? doing.error;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(
    { tarih: since, tamamlanan: done.data, yapiliyor: doing.data },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
