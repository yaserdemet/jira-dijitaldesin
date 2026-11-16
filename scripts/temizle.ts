// Tamamlanmış talepleri ve onlara ait her şeyi (bildirim, yorum, işlem geçmişi, dosya) kalıcı olarak siler.
// Kimin açtığına veya kime atandığına bakılmaz; arşivdeki tamamlanmış işler de dahildir.
//
// Kullanım:
//   npm run temizle                          tamamlanmış bütün işler (rapor + "SIL" onayıyla silme)
//   npm run temizle -- --deneme              yalnızca rapor, hiçbir şey silmez
//   npm run temizle -- --once 2026-01-01     yalnızca bu tarihten önce tamamlananlar
//   npm run temizle -- --iptal               iptal edilen işleri de dahil et
// Seçenekler birlikte kullanılabilir.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'task-files';
const CHUNK = 50;
// Depodan silinemeyen dosyaların listesi; bir sonraki çalıştırmada önce bunlar silinir.
const PENDING = '.temizle-bekleyen-dosyalar.json';

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const known = new Set(['--deneme', '--iptal', '--once']);
  const unknown = args.filter((a, i) => a.startsWith('--') && !known.has(a) && args[i - 1] !== '--once');
  if (unknown.length) fail(`Bilinmeyen seçenek: ${unknown.join(', ')}. Kullanılabilenler: --deneme, --iptal, --once YYYY-AA-GG`);

  let date: string | undefined, cutoff: string | undefined;
  const i = args.indexOf('--once');
  if (i >= 0) {
    date = args[i + 1];
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`--once için tarih YYYY-AA-GG biçiminde olmalı (örnek 2026-01-01). Girilen: ${date ?? '(boş)'}`);
    const check = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== date) fail(`Geçersiz tarih: ${date}`);
    cutoff = new Date(`${date}T00:00:00+03:00`).toISOString();
  }
  return { date, cutoff, dryRun: args.includes('--deneme'), withCancelled: args.includes('--iptal') };
}

const chunks = <T,>(arr: T[], n = CHUNK) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;

async function main() {
  const { date, cutoff, dryRun, withCancelled } = parseArgs();
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY dolu olmalı.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  async function removeFiles(paths: string[]) {
    let done = 0;
    for (const part of chunks(paths, 100)) {
      const { error } = await db.storage.from(BUCKET).remove(part);
      if (error) {
        writeFileSync(PENDING, JSON.stringify(paths.slice(done), null, 2));
        fail(`Kayıtlar silindi ama ${paths.length - done} dosya depodan silinemedi: ${error.message}. Liste ${PENDING} dosyasına yazıldı; komutu yeniden çalıştırınca önce bunlar silinir.`);
      }
      done += part.length;
    }
  }

  // Önceki çalıştırmadan kalan dosyalar
  if (existsSync(PENDING) && !dryRun) {
    const leftover = JSON.parse(readFileSync(PENDING, 'utf8')) as string[];
    console.log(`\nÖnceki temizlikten kalan ${leftover.length} dosya depodan siliniyor…`);
    await removeFiles(leftover);
    rmSync(PENDING);
    console.log('✓ Kalan dosyalar silindi.');
  }

  const statuses = withCancelled ? ['Tamamlandı', 'İptal'] : ['Tamamlandı'];
  console.log(`\nSupabase: ${new URL(url).hostname.split('.')[0]}`);
  console.log(`Silinecek: ${statuses.join(' ve ')} durumundaki bütün işler${date ? `, ${date} öncesinde bitenler` : ''}${dryRun ? '   (DENEME — hiçbir şey silinmeyecek)' : ''}\n`);

  // 1) Silinecek işler. Tamamlandı → tamamlanma tarihi, İptal → son güncelleme tarihi.
  const tasks: { id: string; number: number }[] = [];
  for (let from = 0; ; from += 1000) {
    let query = db.from('tasks').select('id,number');
    if (cutoff) {
      const parts = [`and(status.eq.Tamamlandı,completed_at.lt.${cutoff})`];
      if (withCancelled) parts.push(`and(status.eq.İptal,updated_at.lt.${cutoff})`);
      query = query.or(parts.join(','));
    } else {
      query = query.in('status', statuses);
    }
    const { data, error } = await query.order('number').range(from, from + 999);
    if (error) fail(`İşler okunamadı: ${error.message}`);
    tasks.push(...data);
    if (data.length < 1000) break;
  }
  const { count: total } = await db.from('tasks').select('id', { count: 'exact', head: true });
  if (!tasks.length) { console.log('Bu ölçüte uyan iş yok. Hiçbir şey silinmedi.\n'); return; }

  // 2) İlgili kayıtlar
  const ids = tasks.map(t => t.id);
  const files: { path: string; size: number }[] = [];
  let messages = 0, events = 0, notices = 0;
  const count = async (table: string, part: string[]) => {
    const { count: n, error } = await db.from(table).select('id', { count: 'exact', head: true }).in('task_id', part);
    if (error) fail(`${table} okunamadı: ${error.message}`);
    return n ?? 0;
  };
  for (const part of chunks(ids)) {
    const a = await db.from('attachments').select('path,size').in('task_id', part);
    if (a.error) fail(`Dosya kayıtları okunamadı: ${a.error.message}`);
    files.push(...a.data);
    messages += await count('messages', part);
    events += await count('task_events', part);
    notices += await count('notifications', part);
  }
  const bytes = files.reduce((s, f) => s + Number(f.size), 0);

  console.log('Silinecek:');
  console.log(`  Talep         : ${tasks.length}   (#${tasks[0].number}–#${tasks[tasks.length - 1].number} arası)`);
  console.log(`  Bildirim      : ${notices}`);
  console.log(`  Yorum         : ${messages}`);
  console.log(`  İşlem geçmişi : ${events}`);
  console.log(`  Dosya         : ${files.length}   (toplam ${mb(bytes)})`);
  console.log(`\nDokunulmayacak iş: ${(total ?? 0) - tasks.length}`);

  if (dryRun) { console.log('\nDeneme modu: hiçbir şey silinmedi.\n'); return; }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nBu işlem GERİ ALINAMAZ. Onaylamak için "SIL" yazın: ')).trim();
  rl.close();
  if (answer !== 'SIL') { console.log('\nOnay verilmedi. Hiçbir şey silinmedi.\n'); return; }

  // 3) Önce kayıtlar: bildirimler yorumlara ve işlere, diğerleri işlere bağlı olduğu için bu sırayla.
  //    Dosyalar en sonda silinir; bir adım takılırsa dosya kaybolmaz, komut yeniden çalıştırılabilir.
  for (const table of ['notifications', 'attachments', 'messages', 'task_events', 'tasks'] as const) {
    for (const part of chunks(ids)) {
      const { error } = await db.from(table).delete().in(table === 'tasks' ? 'id' : 'task_id', part);
      if (error) fail(`${table} silinemedi: ${error.message}. Dosyalara dokunulmadı; komutu yeniden çalıştırabilirsiniz, kaldığı yerden devam eder.`);
    }
  }
  console.log(`\n✓ ${tasks.length} talep, ${notices} bildirim, ${messages} yorum, ${events} geçmiş kaydı ve ${files.length} dosya kaydı silindi`);

  await removeFiles(files.map(f => f.path));
  console.log(`✓ ${files.length} dosya depodan silindi (${mb(bytes)} açıldı)`);

  const { error: logError } = await db.from('audit_logs').insert({
    actor_id: null, action: 'Toplu temizlik', entity_id: date ? `once-${date}` : 'tum-tamamlananlar',
    details: `${tasks.length} talep (${statuses.join(', ')}), ${files.length} dosya (${mb(bytes)}) silindi. #${tasks[0].number}–#${tasks[tasks.length - 1].number}`,
  });
  if (logError) console.warn(`! Denetim kaydı yazılamadı: ${logError.message}`);
  console.log('');
}

main().catch(e => fail(e instanceof Error ? e.message : String(e)));
