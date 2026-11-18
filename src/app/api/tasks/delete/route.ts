import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Talebi kalıcı siler. Yetki kontrolü veritabanında (010_delete_task.sql): fonksiyon kullanıcının
// kendi oturumuyla çağrılır, yalnızca talebi açan kişi veya süper admin silebilir.
// Depodaki dosyaları normal kullanıcı silemediği için onları burada yönetici anahtarıyla siliyoruz.
const BUCKET = 'task-files';
const body = z.object({ id: z.uuid('Geçersiz talep.') });

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'Sunucu bağlantısı yapılandırılmadı.' }, { status: 503 });

  const token = req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Geçersiz talep.' }, { status: 400 });

  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const caller = createClient(url, key, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: paths, error } = await caller.rpc('delete_task', { target_id: parsed.data.id });
  if (error) {
    if (error.code === 'PGRST202') return Response.json({ error: 'Önce 010_delete_task.sql geçişini uygulayın.' }, { status: 503 });
    if (error.code?.startsWith('PGRST3')) return Response.json({ error: 'Oturum geçersiz. Yeniden giriş yapın.' }, { status: 401 });
    return Response.json({ error: error.message }, { status: 403 });
  }

  // Kayıtlar silindi; dosyalar en sonda. Bir dosya silinemezse talep yine silinmiş sayılır,
  // kalan dosya depoda sahipsiz kalır ve kullanıcıya bildirilir.
  const files = (paths as string[] | null) ?? [];
  const admin = createClient(url, key, options);
  let fileError = '';
  for (let i = 0; i < files.length; i += 100) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (removeError) fileError = removeError.message;
  }

  return Response.json({ files: files.length, fileError });
}
