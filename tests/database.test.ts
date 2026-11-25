import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('PostgreSQL yetki politikaları ve revize işlemi',async t=>{
 const db=new PGlite();
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
 const taskId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const login=async(i:number)=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${ids[i]}',false)`)};
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 create function storage.extension(text) returns text language sql immutable as $$ select reverse(split_part(reverse($1),'.',1)) $$;`);
 await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/002_remove_mfa_and_invite.sql',import.meta.url),'utf8'));
 for(let i=0;i<4;i++){
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)`,[ids[i],`user${i}@example.test`,JSON.stringify({name:`User ${i}`})]);
  // Uygulamadaki API gibi: hesap pasif açılır, süper admin işlemiyle etkinleştirilir.
  if(i!==3)await db.query('update public.profiles set active=true where id=$1',[ids[i]]);
 }
 await db.exec(`update public.profiles set role='super_admin' where id='${ids[0]}'`);
 await login(0);
 await db.query(`insert into public.tasks(id,title,description,category,brand,creator_id,assignee_id,status) values($1,'Görsel hazırla','Kampanya görsellerini hazırla','Grafik İşlemleri','Test',$2,$3,'Atandı')`,[taskId,ids[0],ids[1]]);
 await t.test('yeni kayıt pasif açılır; aktif üye ek doğrulama olmadan verilere erişir',async()=>{await db.exec('reset role');assert.equal((await db.query<{active:boolean}>('select active from public.profiles where id=$1',[ids[3]])).rows[0].active,false);await login(0);assert.equal((await db.query('select * from public.tasks')).rows.length,1)});
 await t.test('etkinleştirilmemiş hesap tüm verilere kapalı',async()=>{await login(3);assert.equal((await db.query('select * from public.tasks')).rows.length,0);assert.equal((await db.query('select * from public.profiles')).rows.length,0);await assert.rejects(db.query(`insert into public.messages(task_id,author_id,body) values($1,$2,'test')`,[taskId,ids[3]]))});
 await t.test('çalışan tüm işleri görür ama güvenlik loglarını göremez',async()=>{await login(1);assert.equal((await db.query('select * from public.tasks')).rows.length,1);assert.equal((await db.query('select * from public.audit_logs')).rows.length,0);assert.ok((await db.query('select * from public.task_events')).rows.length>0)});
 await t.test('çalışan kendi rolünü yükseltemez veya sahte log yazamaz',async()=>{await login(1);await assert.rejects(db.exec(`update public.profiles set role='super_admin' where id='${ids[1]}'`));await assert.rejects(db.exec("insert into public.audit_logs(action,entity_id) values('sahte','x')"));await assert.rejects(db.query('select public.set_employee_active($1,false)',[ids[2]]))});
 await t.test('ilgisiz çalışan işi değiştiremez',async()=>{await login(2);const r=await db.query('update public.tasks set status=\'İşlemde\' where id=$1 returning id',[taskId]);assert.equal(r.rows.length,0);await assert.rejects(db.query(`insert into public.messages(task_id,author_id,body,kind) values($1,$2,'Teslim','delivery')`,[taskId,ids[2]]))});
 await t.test('sorumlu işe başlayabilir, teslimsiz onaya gönderemez ve kendisi onaylayamaz',async()=>{await login(1);await db.query("update public.tasks set status='İşlemde' where id=$1",[taskId]);await assert.rejects(db.query("update public.tasks set status='Onay Bekliyor' where id=$1",[taskId]));await assert.rejects(db.query("update public.tasks set status='Tamamlandı' where id=$1",[taskId]));await db.query(`insert into public.messages(task_id,author_id,body,kind) values($1,$2,'Hazırlandı, kontrol edebilirsiniz.','delivery')`,[taskId,ids[1]]);await db.query("update public.tasks set status='Onay Bekliyor' where id=$1",[taskId]);await assert.rejects(db.query("update public.tasks set status='Tamamlandı' where id=$1",[taskId]))});
 await t.test('revize açıklaması ve durum güncellemesi atomik gerçekleşir',async()=>{await login(0);await assert.rejects(db.query("update public.tasks set status='Revize İstendi' where id=$1",[taskId]));const row=(await db.query<{updated_at:string}>('select updated_at from public.tasks where id=$1',[taskId])).rows[0];await db.query('select public.request_revision($1,$2,$3)',[taskId,'Başlık daha büyük olsun.',row.updated_at]);const task=(await db.query<{status:string;revision_count:number}>('select status,revision_count from public.tasks where id=$1',[taskId])).rows[0];assert.equal(task.status,'Revize İstendi');assert.equal(task.revision_count,1);assert.equal((await db.query("select * from public.messages where kind='revision'")).rows.length,1)});
 await t.test('talep sahibi onayı ve güvenlik logu kalıcıdır',async()=>{await login(1);await db.query("update public.tasks set status='Onay Bekliyor' where id=$1",[taskId]);await login(0);await db.query("update public.tasks set status='Tamamlandı' where id=$1",[taskId]);assert.ok((await db.query<{completed_at:string}>('select completed_at from public.tasks')).rows[0].completed_at);assert.ok((await db.query('select * from public.audit_logs')).rows.length>=5);await assert.rejects(db.exec('delete from public.audit_logs'));await assert.rejects(db.exec('delete from public.tasks'))});
 await t.test('dosya yolları korunur ve kaydedilen teslim silinemez',async()=>{
  await login(1);const path=`${ids[1]}/${taskId}/sample.png`;
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['task-files',`${ids[2]}/${taskId}/other.png`]));
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['task-files',`${ids[1]}/${taskId}/script.html`]));
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['task-files',path]);
  await db.query(`insert into public.attachments(task_id,uploader_id,name,size,mime,path,kind) values($1,$2,'sample.png',68,'image/png',$3,'delivery')`,[taskId,ids[1],path]);
  const removed=await db.query('delete from storage.objects where name=$1 returning name',[path]);assert.equal(removed.rows.length,0);
  await assert.rejects(db.exec('delete from public.attachments'));
 });
 await t.test('kapatılan hesap mevcut oturumuyla da verilere erişemez',async()=>{await login(0);await assert.rejects(db.query('select public.set_employee_active($1,false)',[ids[0]]));await db.query('select public.set_employee_active($1,false)',[ids[1]]);await login(1);assert.equal((await db.query('select * from public.tasks')).rows.length,0);assert.equal((await db.query('select * from public.messages')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);await assert.rejects(db.query(`insert into public.messages(task_id,author_id,body) values($1,$2,'test')`,[taskId,ids[1]]))});

 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/003_workflow.sql',import.meta.url),'utf8'));
 await t.test('yeni akış geçişi geçmişi ve tamamlanmayı korur',async()=>{await login(0);const row=(await db.query<{progress:number;revision_count:number}>('select progress,revision_count from public.tasks where id=$1',[taskId])).rows[0];assert.equal(row.progress,100);assert.equal(row.revision_count,1);assert.ok((await db.query('select * from public.audit_logs')).rows.length>0);await db.query('select public.set_employee_active($1,true)',[ids[1]])});
 await t.test('dört durum, sorun açıklaması ve ilerleme sunucuda korunur',async()=>{await login(1);await assert.rejects(db.query("update public.tasks set status='Bilgi Bekliyor',issue_description='' where id=$1",[taskId]));await db.query("update public.tasks set status='İşlemde',progress=40 where id=$1",[taskId]);await db.query("update public.tasks set status='Bilgi Bekliyor',issue_description='Sunucu erişimi gerekiyor' where id=$1",[taskId]);assert.equal((await db.query<{progress:number}>('select progress from public.tasks where id=$1',[taskId])).rows[0].progress,40);await db.query("update public.tasks set status='Tamamlandı',progress=30 where id=$1",[taskId]);assert.equal((await db.query<{progress:number}>('select progress from public.tasks where id=$1',[taskId])).rows[0].progress,100)});
 await t.test('yorum bildirimi yalnızca alıcıya görünür ve yalnızca okundu bilgisi değişir',async()=>{await login(0);await db.query(`insert into public.messages(task_id,author_id,body,recipient_id) values($1,$2,'Kontrol eder misin?',$3)`,[taskId,ids[0],ids[2]]);await login(2);const notices=await db.query<{id:string}>('select id from public.notifications');assert.equal(notices.rows.length,1);await db.query('update public.notifications set read_at=now() where id=$1',[notices.rows[0].id]);await assert.rejects(db.query("update public.notifications set body='sahte' where id=$1",[notices.rows[0].id]));await assert.rejects(db.query("insert into public.notifications(recipient_id,task_id,body) values($1,$2,'sahte')",[ids[0],taskId]));await login(1);assert.equal((await db.query('select * from public.notifications where recipient_id=$1',[ids[2]])).rows.length,0)});
 await t.test('yanıt alıcısı sunucuda asıl yazardır, farklı talebe yanıt engellenir',async()=>{await login(2);const original=(await db.query<{id:string}>("select id from public.messages where body='Kontrol eder misin?'")).rows[0];const reply=await db.query<{recipient_id:string}>(`insert into public.messages(task_id,author_id,body,parent_id,recipient_id) values($1,$2,'Kontrol ettim',$3,$4) returning recipient_id`,[taskId,ids[2],original.id,ids[1]]);assert.equal(reply.rows[0].recipient_id,ids[0]);await login(0);const other=(await db.query<{id:string}>(`insert into public.tasks(title,description,category,brand,creator_id,status) values('Yeni talep','Başka bir görev','Diğer Talepler','İç Ekip',$1,'Yeni') returning id`,[ids[0]])).rows[0];await assert.rejects(db.query(`insert into public.messages(task_id,author_id,body,parent_id) values($1,$2,'Hatalı yanıt',$3)`,[other.id,ids[0],original.id]));const before=(await db.query('select * from public.notifications')).rows.length;await db.query(`insert into public.messages(task_id,author_id,body,recipient_id) values($1,$2,'Kendime not',$2)`,[taskId,ids[0]]);assert.equal((await db.query('select * from public.notifications')).rows.length,before)});
 await t.test('rehberler üyelerce paylaşılır, yazar taklidi ve anonim erişim engellenir',async()=>{await login(1);await db.query(`insert into public.guides(title,body,author_id) values('Dosya teslimi','Önce talebi açın ve teslim dosyasını seçin.',$1)`,[ids[1]]);await assert.rejects(db.query(`insert into public.guides(title,body,author_id) values('Sahte rehber','Yazarı taklit etmeyi dene.',$1)`,[ids[0]]));await login(2);assert.equal((await db.query('select * from public.guides')).rows.length,1);await login(0);await db.query('select public.set_employee_active($1,false)',[ids[2]]);await login(2);assert.equal((await db.query('select * from public.notifications')).rows.length,0);assert.equal((await db.query('select * from public.guides')).rows.length,0)});
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/004_department_assignees.sql',import.meta.url),'utf8'));
 await t.test('bölüm sorumlularını yalnızca süper admin yönetir ve yeni atamalar doğrulanır',async()=>{
  await login(1);
  await assert.rejects(db.query('select public.set_department_assignees($1,true,false)',[ids[1]]),/Süper admin/);
  await login(0);
  await assert.rejects(db.query('select public.set_department_assignees($1,true,false)',[ids[2]]),/Aktif kullanıcı/);
  const create="insert into public.tasks(title,description,category,brand,creator_id,assignee_id) values('Teknik talep','Örnek açıklama','Teknik İşlemler','İç Ekip',$1,$2)";
  await assert.rejects(db.query(create,[ids[0],ids[1]]),/aktif sorumluları/);
  await db.query('select public.set_department_assignees($1,true,false)',[ids[1]]);
  await db.query(create,[ids[0],ids[1]]);
  await db.query('select public.set_department_assignees($1,false,false)',[ids[1]]);
  await assert.rejects(db.query(create,[ids[0],ids[1]]),/aktif sorumluları/);
  await db.query("update public.tasks set progress=100 where id=$1",[taskId]);
 });
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/005_archive_and_rules.sql',import.meta.url),'utf8'));
 const newTask=async(category:string)=>(await db.query<{id:string}>(`insert into public.tasks(title,description,category,brand,creator_id,assignee_id,status,archived_at) values('Yeni iş','Örnek açıklama',$1,'İç Ekip',$2,$3,'Atandı',now()) returning id`,[category,ids[0],ids[1]])).rows[0].id;
 const row=async(id:string)=>(await db.query<{status:string;progress:number;archived_at:string|null;updated_at:string}>('select status,progress,archived_at,updated_at from public.tasks where id=$1',[id])).rows[0];
 await t.test('bölümde işaretli sorumlu yoksa herkes, varsa yalnızca sorumlular atanabilir',async()=>{
  await login(0);
  await newTask('Teknik İşlemler');
  await db.query('select public.set_department_assignees($1,true,false)',[ids[0]]);
  await assert.rejects(newTask('Teknik İşlemler'),/aktif sorumluları/);
  await db.query('select public.set_department_assignees($1,false,false)',[ids[0]]);
 });
 await t.test('yalnızca tamamlanan iş arşivlenir, yeniden açılan iş arşivden çıkar',async()=>{
  await login(0);const id=await newTask('Diğer Talepler');
  assert.equal((await row(id)).archived_at,null,'yeni iş arşivde açılamaz');
  await login(1);
  await assert.rejects(db.query('update public.tasks set archived_at=now() where id=$1',[id]),/arşivlenebilir/);
  await db.query("update public.tasks set status='Tamamlandı' where id=$1",[id]);
  await db.query('update public.tasks set archived_at=now() where id=$1',[id]);
  assert.ok((await row(id)).archived_at);
  await db.query("update public.tasks set status='İşlemde',progress=50 where id=$1",[id]);
  assert.equal((await row(id)).archived_at,null);
 });
 await t.test('talebi yalnızca açan kişi iptal eder ve iptal edilen iş arşive gider',async()=>{
  await login(0);const id=await newTask('Diğer Talepler');
  await login(1);
  await assert.rejects(db.query("update public.tasks set status='İptal',archived_at=now() where id=$1",[id]),/iptal/);
  await login(0);
  await db.query("update public.tasks set status='İptal',archived_at=now() where id=$1",[id]);
  const r=await row(id);assert.equal(r.status,'İptal');assert.ok(r.archived_at);
 });
 await t.test('başlanmamış işe revize istenemez; tamamlanmış işin revizesi onu arşivden çıkarır',async()=>{
  await login(0);const id=await newTask('Diğer Talepler');
  await assert.rejects(db.query('select public.request_revision($1,$2,$3)',[id,'Renkleri değiştir',(await row(id)).updated_at]),/Revize yalnızca/);
  await login(1);
  await db.query("update public.tasks set status='Tamamlandı' where id=$1",[id]);
  await db.query('update public.tasks set archived_at=now() where id=$1',[id]);
  await login(0);
  await db.query('select public.request_revision($1,$2,$3)',[id,'Renkleri değiştir',(await row(id)).updated_at]);
  const r=await row(id);assert.equal(r.status,'Revize İstendi');assert.equal(r.progress,90);assert.equal(r.archived_at,null);
 });
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/006_drop_due_date.sql',import.meta.url),'utf8'));
 await t.test('teslim tarihi kolonu yok ve talep tarihsiz açılır',async()=>{
  assert.equal((await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='due_date'")).rows.length,0);
  await login(0);assert.ok(await newTask('Diğer Talepler'));
 });
 await t.test('toplu temizlik (npm run temizle) sırası yabancı anahtarlara takılmaz',async()=>{
  await login(0);const id=await newTask('Diğer Talepler');
  await db.query(`insert into public.messages(task_id,author_id,body,recipient_id) values($1,$2,'Kontrol eder misin?',$3)`,[id,ids[0],ids[1]]);
  await db.exec('reset role');
  assert.ok((await db.query('select 1 from public.notifications where task_id=$1',[id])).rows.length>0,'bildirim oluşmalı');
  // Eski sıra: bildirimler silinmeden yorum silinemez.
  await assert.rejects(db.query('delete from public.messages where task_id=$1',[id]));
  // scripts/temizle.ts sırası
  for(const table of ['notifications','attachments','messages','task_events']) await db.query(`delete from public.${table} where task_id=$1`,[id]);
  await db.query('delete from public.tasks where id=$1',[id]);
  assert.equal((await db.query('select 1 from public.tasks where id=$1',[id])).rows.length,0);
 });
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/007_delete_employee.sql',import.meta.url),'utf8'));
 await t.test('çalışan kalıcı silinir, geçmişi korunur',async()=>{
  await login(0);
  const open=await newTask('Diğer Talepler'), done=await newTask('Diğer Talepler');
  await login(1);
  await db.query("update public.tasks set status='Tamamlandı' where id=$1",[done]);
  await db.query(`insert into public.messages(task_id,author_id,body) values($1,$2,'Teslim ettim')`,[done,ids[1]]);
  await login(0);
  await db.query(`insert into public.messages(task_id,author_id,body,recipient_id) values($1,$2,'Bakar mısın?',$3)`,[open,ids[0],ids[1]]);
  // Yetki: çalışan silemez, süper admin kendini silemez.
  await login(1);
  await assert.rejects(db.query('select public.delete_employee($1)',[ids[1]]),/Süper admin/);
  await login(0);
  await assert.rejects(db.query('select public.delete_employee($1)',[ids[0]]),/silinemez/);
  await db.query('select public.delete_employee($1)',[ids[1]]);
  await db.query('select public.delete_employee($1)',[ids[1]]); // tekrar çağrı zararsız
  await db.exec('reset role');
  const p=(await db.query<{name:string;email:string;active:boolean;deleted_at:string|null}>('select name,email,active,deleted_at from public.profiles where id=$1',[ids[1]])).rows[0];
  assert.deepEqual([p.name,p.email,p.active,!!p.deleted_at],['Silinmiş kullanıcı','',false,true]);
  assert.equal((await db.query<{assignee_id:string|null}>('select assignee_id from public.tasks where id=$1',[open])).rows[0].assignee_id,null,'açık iş sahipsiz kalır');
  assert.equal((await db.query<{assignee_id:string|null}>('select assignee_id from public.tasks where id=$1',[done])).rows[0].assignee_id,ids[1],'biten işte ad geçmiş olarak kalır');
  assert.equal((await db.query("select 1 from public.messages where body='Teslim ettim'")).rows.length,1,'yorumlar korunur');
  assert.equal((await db.query('select 1 from public.notifications where recipient_id=$1',[ids[1]])).rows.length,0,'bildirimleri silinir');
  assert.ok((await db.query("select 1 from public.audit_logs where action='Kullanıcı kalıcı olarak silindi'")).rows.length);
  // Giriş hesabı artık silinebilir (sunucu bunu Supabase Auth üzerinden yapar).
  await db.query('delete from auth.users where id=$1',[ids[1]]);
  assert.equal((await db.query('select 1 from public.profiles where id=$1',[ids[1]])).rows.length,1,'profil satırı kalır');
 });
 await db.exec('reset role');
 const realtime=await readFile(new URL('../supabase/migrations/008_realtime.sql',import.meta.url),'utf8');
 await t.test('realtime yayını uygulama tablolarını içerir, güvenlik logları hariç; tekrar çalıştırılabilir',async()=>{
  await db.exec(realtime);
  await db.exec(realtime); // ikinci çalıştırma hata vermez, tabloyu iki kez eklemez
  const tables=(await db.query<{tablename:string}>("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename")).rows.map(r=>r.tablename);
  // Güvenlik logları bilerek yayında yok (yalnızca süper admin görür).
  assert.deepEqual(tables,['attachments','guides','messages','notifications','profiles','task_events','tasks']);
  // Not: Realtime'ın RLS süzmesi Supabase sunucusunda olur, PGlite'ta test edilemez.
  // Uygulama yalnızca INSERT/UPDATE dinler; silme olaylarında Supabase RLS uygulamaz.
 });
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/009_clear_audit_logs.sql',import.meta.url),'utf8'));
 await t.test('denetim kayıtlarını yalnızca süper admin temizler ve temizleme iz bırakır',async()=>{
  await db.exec('reset role');
  const before=Number((await db.query<{n:string}>('select count(*) as n from public.audit_logs')).rows[0].n);
  assert.ok(before>1,'temizlenecek kayıt var');
  // Çalışan fonksiyonu çağıramaz, tabloyu doğrudan da silemez.
  await login(2);
  await assert.rejects(db.query('select public.clear_audit_logs()'),/Süper admin/);
  await assert.rejects(db.exec('delete from public.audit_logs'));
  // Süper admin de tabloyu doğrudan silemez; yalnızca fonksiyon izinli.
  await login(0);
  await assert.rejects(db.exec('delete from public.audit_logs'));
  const removed=(await db.query<{clear_audit_logs:number}>('select public.clear_audit_logs()')).rows[0].clear_audit_logs;
  assert.equal(removed,before);
  await db.exec('reset role');
  const rest=(await db.query<{actor_id:string;action:string;details:string}>('select actor_id,action,details from public.audit_logs')).rows;
  assert.deepEqual(rest,[{actor_id:ids[0],action:'Denetim kayıtları silindi',details:`${before} kayıt kalıcı olarak silindi`}]);
 });
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/010_delete_task.sql',import.meta.url),'utf8'));
 await t.test('talebi yalnızca açan kişi veya süper admin kalıcı siler; bağlı kayıtlar da silinir',async()=>{
  // İkinci aktif çalışan: talebi açmamış biri silememeli.
  const other='55555555-5555-4555-8555-555555555555';
  await db.exec('reset role');
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'other@example.test','{"name":"Başka Çalışan"}')`,[other]);
  await db.query('update public.profiles set active=true where id=$1',[other]);
  // Çalışan 2 önceki bir testte pasif yapıldı; talep açabilmesi için yeniden etkinleştir.
  await db.query('update public.profiles set active=true where id=$1',[ids[2]]);
  ids.push(other);
  const otherIndex=ids.length-1;
  const createAs=async(i:number)=>{
   await login(i);
   return (await db.query<{id:string}>(`insert into public.tasks(title,description,category,brand,creator_id,assignee_id,status) values('Silinecek iş','Örnek açıklama','Diğer Talepler','İç Ekip',$1,$2,'Atandı') returning id`,[ids[i],ids[0]])).rows[0].id;
  };
  const counts=async(id:string)=>{
   await db.exec('reset role');
   const n=async(sql:string)=>Number((await db.query<{n:string}>(sql,[id])).rows[0].n);
   return {
    tasks:await n('select count(*) as n from public.tasks where id=$1'),
    messages:await n('select count(*) as n from public.messages where task_id=$1'),
    attachments:await n('select count(*) as n from public.attachments where task_id=$1'),
    events:await n('select count(*) as n from public.task_events where task_id=$1'),
    notifications:await n('select count(*) as n from public.notifications where task_id=$1'),
   };
  };

  // Çalışan 2 talep açar; yorum, bildirim, geçmiş ve dosya kaydı oluşur.
  const own=await createAs(2);
  const path=`${ids[2]}/${own}/brief.png`;
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['task-files',path]);
  await db.query(`insert into public.attachments(task_id,uploader_id,name,size,mime,path,kind) values($1,$2,'brief.png',68,'image/png',$3,'brief')`,[own,ids[2],path]);
  await login(0);
  await db.query(`insert into public.messages(task_id,author_id,body,recipient_id) values($1,$2,'Bakar mısın?',$3)`,[own,ids[0],ids[2]]);
  const before=await counts(own);
  assert.ok(before.messages&&before.attachments&&before.events&&before.notifications,'bağlı kayıtlar var');

  // Talebi açmamış çalışan silemez; tabloyu doğrudan da silemez.
  await login(otherIndex);
  await assert.rejects(db.query('select public.delete_task($1)',[own]),/açan kişi veya süper admin/);
  await assert.rejects(db.query('delete from public.tasks where id=$1',[own]));
  assert.equal((await counts(own)).tasks,1,'talep yerinde');

  // Açan kişi siler; dosya yolu sunucunun depodan silmesi için döner.
  await login(2);
  const paths=(await db.query<{delete_task:string[]}>('select public.delete_task($1)',[own])).rows[0].delete_task;
  assert.deepEqual(paths,[path]);
  assert.deepEqual(await counts(own),{tasks:0,messages:0,attachments:0,events:0,notifications:0});
  await db.exec('reset role');
  assert.equal((await db.query("select 1 from public.audit_logs where action='Talep kalıcı olarak silindi' and entity_id=$1 and actor_id=$2",[own,ids[2]])).rows.length,1,'iz kalır');

  // Süper admin başkasının talebini silebilir.
  const someone=await createAs(otherIndex);
  await login(0);
  assert.deepEqual((await db.query<{delete_task:string[]}>('select public.delete_task($1)',[someone])).rows[0].delete_task,[]);
  assert.equal((await counts(someone)).tasks,0);
  await login(0);
  await assert.rejects(db.query('select public.delete_task($1)',[someone]),/bulunamadı/);
 });
 await db.exec('reset role');
 const migration011=await readFile(new URL('../supabase/migrations/011_notes_and_assignees.sql',import.meta.url),'utf8');
 await db.exec(migration011);
 await db.exec(migration011); // tekrar çalıştırılabilir
 await t.test('talep açıklaması isteğe bağlıdır ve birden fazla sorumlu atanabilir',async()=>{
  const other=ids[4];
  type Row={assignee_id:string|null;assignee_ids:string[];notes:string|null};
  const read=async(id:string)=>{await db.exec('reset role');return (await db.query<Row>('select assignee_id,assignee_ids,notes from public.tasks where id=$1',[id])).rows[0]};
  const create=async(as:number,category:string,assignees:string[],notes:string|null=null)=>{
   await login(as);
   return (await db.query<{id:string}>(`insert into public.tasks(title,description,category,brand,creator_id,assignee_ids,notes,status) values('Ortak iş','Örnek açıklama',$1,'İç Ekip',$2,$3,$4,'Atandı') returning id`,[category,ids[as],assignees,notes])).rows[0].id;
  };

  // Eski kayıtlar listeye taşınmış olmalı.
  await db.exec('reset role');
  assert.equal((await db.query('select 1 from public.tasks where assignee_id is not null and not (assignee_id = any(assignee_ids))')).rows.length,0,'eski sorumlu listeye taşınır');

  // Açıklama boş olabilir; tekrar eden kişi bir kez kalır, ilk kişi assignee_id olur.
  const id=await create(0,'Diğer Talepler',[ids[2],other,ids[2]]);
  assert.deepEqual(await read(id),{assignee_id:ids[2],assignee_ids:[ids[2],other],notes:null});
  await login(0);
  await assert.rejects(db.query(`insert into public.tasks(title,description,category,brand,creator_id,notes) values('Uzun','Örnek açıklama','Diğer Talepler','İç Ekip',$1,$2)`,[ids[0],'a'.repeat(10001)]));
  await assert.rejects(db.query(`insert into public.tasks(title,description,category,brand,creator_id,assignee_ids,status) values('Pasif','Örnek açıklama','Diğer Talepler','İç Ekip',$1,$2,'Atandı')`,[ids[0],[ids[3]]]),/aktif/);

  // İki sorumlu da "atandı" bildirimi alır.
  await db.exec('reset role');
  for(const who of [ids[2],other])assert.equal((await db.query("select 1 from public.notifications where task_id=$1 and recipient_id=$2 and body='Sana yeni bir talep atandı.'",[id,who])).rows.length,1);

  // İkinci sorumlu da işi ilerletebilir ve açıklamayı düzenleyebilir; listede olmayan çalışan değiştiremez.
  await login(4);
  await db.query("update public.tasks set status='İşlemde',progress=30,notes='Ek bilgi' where id=$1",[id]);
  assert.equal((await read(id)).notes,'Ek bilgi');
  await db.exec('reset role');
  await db.query('update public.profiles set active=true where id=$1',[ids[3]]);
  await login(3);
  assert.equal((await db.query("update public.tasks set status='Tamamlandı' where id=$1 returning id",[id])).rows.length,0,'ilgisiz çalışan değiştiremez');

  // Yalnızca assignee_id yazan eski istemci listeyi tek kişiye çevirir.
  await login(0);
  await db.query('update public.tasks set assignee_id=$2 where id=$1',[id,other]);
  assert.deepEqual((await read(id)).assignee_ids,[other]);
  await login(0);
  await db.query('update public.tasks set assignee_ids=$2 where id=$1',[id,[ids[2],other]]);
  assert.equal((await db.query<{details:string}>("select details from public.task_events where task_id=$1 and action='Sorumlu değişti' order by created_at desc limit 1",[id])).rows[0].details,'User 2, Başka Çalışan');

  // Bölümde işaretli sorumlu varsa listedeki herkes işaretli olmalı.
  await db.query('select public.set_department_assignees($1,true,false)',[ids[2]]);
  await assert.rejects(create(0,'Teknik İşlemler',[ids[2],other]),/aktif sorumluları/);
  const technical=await create(0,'Teknik İşlemler',[ids[2]]);
  await assert.rejects(db.query('update public.tasks set assignee_ids=$2 where id=$1',[technical,[ids[2],other]]),/aktif sorumluları/);
  await db.query('select public.set_department_assignees($1,false,false)',[ids[2]]);

  // Silinen çalışan yalnızca kendi adının olduğu listeden çıkar, diğer sorumlu kalır.
  await login(0);
  await db.query('select public.delete_employee($1)',[other]);
  assert.deepEqual(await read(id),{assignee_id:ids[2],assignee_ids:[ids[2]],notes:'Ek bilgi'});
 });
 }finally{await db.close()}
});
