// Belirtilen tarihten önce Tamamlandı / İptal olan işleri ve dosyalarını siler.
// Kullanım:
//   npm run temizle -- --once YYYY-AA-GG            (rapor + onayla silme)
//   npm run temizle -- --once YYYY-AA-GG --deneme   (yalnızca rapor, hiçbir şey silmez)
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'task-files';
const CHUNK = 50;

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--once');
  const date = i >= 0 ? args[i + 1] : undefined;
  if (!date) fail('Tarih gerekli. Örnek: npm run temizle -- --once 2026-01-01');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`Tarih biçimi YYYY-AA-GG olmalı (örnek 2026-01-01). Girilen: ${date}`);
  const d = new Date(`${date}T00:00:00+03:00`);
  const check = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== date) fail(`Geçersiz tarih: ${date}`);
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) fail('Tarih en fazla yarın olabilir.');
  return { date, cutoff: d.toISOString(), dryRun: args.includes('--deneme') };
}

const chunks = <T,>(arr: T[], n = CHUNK) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;

async function main() {
  const { date, cutoff, dryRun } = parseArgs();
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY dolu olmalı.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(`\nSupabase: ${new URL(url).hostname.split('.')[0]}`);
  console.log(`Ölçüt  : ${date} öncesinde Tamamlandı / İptal olan işler${dryRun ? '  (DENEME — hiçbir şey silinmeyecek)' : ''}\n`);

  // 1) Silinecek işler. Tamamlandı → tamamlanma tarihi, İptal → son güncelleme tarihi.
  const tasks: { id: string; number: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('tasks').select('id,number')
      .or(`and(status.eq.Tamamlandı,completed_at.lt.${cutoff}),and(status.eq.İptal,updated_at.lt.${cutoff})`)
      .order('number').range(from, from + 999);
    if (error) fail(`İşler okunamadı: ${error.message}`);
    tasks.push(...data);
    if (data.length < 1000) break;
  }
  const { count: remaining } = await db.from('tasks').select('id', { count: 'exact', head: true });
  if (!tasks.length) { console.log('Bu ölçüte uyan iş yok. Hiçbir şey silinmedi.\n'); return; }

  // 2) İlgili kayıtlar
  const ids = tasks.map(t => t.id);
  const files: { path: string; size: number }[] = [];
  let messages = 0, events = 0;
  for (const part of chunks(ids)) {
    const a = await db.from('attachments').select('path,size').in('task_id', part);
    if (a.error) fail(`Dosya kayıtları okunamadı: ${a.error.message}`);
    files.push(...a.data);
    const m = await db.from('messages').select('id', { count: 'exact', head: true }).in('task_id', part);
    if (m.error) fail(`Yorumlar okunamadı: ${m.error.message}`);
    messages += m.count ?? 0;
    const e = await db.from('task_events').select('id', { count: 'exact', head: true }).in('task_id', part);
    if (e.error) fail(`İşlem geçmişi okunamadı: ${e.error.message}`);
    events += e.count ?? 0;
  }
  const bytes = files.reduce((s, f) => s + Number(f.size), 0);

  console.log('Silinecek:');
  console.log(`  Talep         : ${tasks.length}   (#${tasks[0].number}–#${tasks[tasks.length - 1].number} arası)`);
  console.log(`  Yorum         : ${messages}`);
  console.log(`  İşlem geçmişi : ${events}`);
  console.log(`  Dosya         : ${files.length}   (toplam ${mb(bytes)})`);
  console.log(`\nDokunulmayacak iş: ${(remaining ?? 0) - tasks.length}`);

  if (dryRun) { console.log('\nDeneme modu: hiçbir şey silinmedi.\n'); return; }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nBu işlem GERİ ALINAMAZ. Onaylamak için "SIL" yazın: ')).trim();
  rl.close();
  if (answer !== 'SIL') { console.log('\nOnay verilmedi. Hiçbir şey silinmedi.\n'); return; }

  // 3) Önce dosyalar (kota burada açılır), sonra bağlı tablolar, en son işler.
  for (const part of chunks(files.map(f => f.path), 100)) {
    const { error } = await db.storage.from(BUCKET).remove(part);
    if (error) fail(`Dosyalar silinemedi: ${error.message}. Komutu yeniden çalıştırabilirsiniz; kaldığı yerden devam eder.`);
  }
  console.log(`\n✓ ${files.length} dosya depodan silindi (${mb(bytes)} açıldı)`);

  for (const table of ['attachments', 'messages', 'task_events', 'tasks'] as const) {
    for (const part of chunks(ids)) {
      const { error } = await db.from(table).delete().in(table === 'tasks' ? 'id' : 'task_id', part);
      if (error) fail(`${table} silinemedi: ${error.message}. Komutu yeniden çalıştırabilirsiniz; kaldığı yerden devam eder.`);
    }
  }
  console.log(`✓ ${files.length} dosya kaydı, ${messages} yorum, ${events} geçmiş kaydı, ${tasks.length} talep silindi`);

  const { error: logError } = await db.from('audit_logs').insert({
    actor_id: null, action: 'Toplu temizlik', entity_id: `once-${date}`,
    details: `${tasks.length} talep, ${files.length} dosya (${mb(bytes)}) silindi. #${tasks[0].number}–#${tasks[tasks.length - 1].number}`,
  });
  if (logError) console.warn(`! Denetim kaydı yazılamadı: ${logError.message}`);
  console.log('');
}

main().catch(e => fail(e instanceof Error ? e.message : String(e)));
