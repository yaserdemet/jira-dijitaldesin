import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('PostgreSQL yetki politikaları ve revize işlemi',async t=>{
 const db=new PGlite();
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
 const taskId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const login=async(i:number)=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${ids[i]}',false);select set_config('request.jwt.claim.aal','aal2',false)`)};
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',invited_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
 grant usage on schema auth,public,storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 create function storage.extension(text) returns text language sql immutable as $$ select reverse(split_part(reverse($1),'.',1)) $$;`);
 await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/002_disable_mfa.sql',import.meta.url),'utf8'));
 for(let i=0;i<4;i++){
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)`,[ids[i],`user${i}@example.test`,JSON.stringify({name:`User ${i}`})]);
  if(i!==3)await db.query('update auth.users set invited_at=now() where id=$1',[ids[i]]);
 }
 await db.exec(`update public.profiles set role='super_admin' where id='${ids[0]}'`);
 await login(0);
 await db.query(`insert into public.tasks(id,title,description,category,brand,creator_id,assignee_id,due_date,status) values($1,'Görsel hazırla','Kampanya görsellerini hazırla','Grafik İşlemleri','Test',$2,$3,'2026-12-01','Atandı')`,[taskId,ids[0],ids[1]]);
 await t.test('yalnızca e-posta oturumu (aal1) ile aktif üye verilere erişir',async()=>{await login(0);await db.exec("select set_config('request.jwt.claim.aal','aal1',false)");assert.equal((await db.query('select * from public.tasks')).rows.length,1)});
 await t.test('davet edilmemiş hesap tüm verilere kapalı',async()=>{await login(3);assert.equal((await db.query('select * from public.tasks')).rows.length,0);assert.equal((await db.query('select * from public.profiles')).rows.length,0);await assert.rejects(db.query(`insert into public.messages(task_id,author_id,body) values($1,$2,'test')`,[taskId,ids[3]]))});
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
 await t.test('yanıt alıcısı sunucuda asıl yazardır, farklı talebe yanıt engellenir',async()=>{await login(2);const original=(await db.query<{id:string}>("select id from public.messages where body='Kontrol eder misin?'")).rows[0];const reply=await db.query<{recipient_id:string}>(`insert into public.messages(task_id,author_id,body,parent_id,recipient_id) values($1,$2,'Kontrol ettim',$3,$4) returning recipient_id`,[taskId,ids[2],original.id,ids[1]]);assert.equal(reply.rows[0].recipient_id,ids[0]);await login(0);const other=(await db.query<{id:string}>(`insert into public.tasks(title,description,category,brand,creator_id,due_date,status) values('Yeni talep','Başka bir görev','Diğer Talepler','İç Ekip',$1,'2026-12-01','Yeni') returning id`,[ids[0]])).rows[0];await assert.rejects(db.query(`insert into public.messages(task_id,author_id,body,parent_id) values($1,$2,'Hatalı yanıt',$3)`,[other.id,ids[0],original.id]));const before=(await db.query('select * from public.notifications')).rows.length;await db.query(`insert into public.messages(task_id,author_id,body,recipient_id) values($1,$2,'Kendime not',$2)`,[taskId,ids[0]]);assert.equal((await db.query('select * from public.notifications')).rows.length,before)});
 await t.test('rehberler üyelerce paylaşılır, yazar taklidi ve anonim erişim engellenir',async()=>{await login(1);await db.query(`insert into public.guides(title,body,author_id) values('Dosya teslimi','Önce talebi açın ve teslim dosyasını seçin.',$1)`,[ids[1]]);await assert.rejects(db.query(`insert into public.guides(title,body,author_id) values('Sahte rehber','Yazarı taklit etmeyi dene.',$1)`,[ids[0]]));await login(2);assert.equal((await db.query('select * from public.guides')).rows.length,1);await login(0);await db.query('select public.set_employee_active($1,false)',[ids[2]]);await login(2);assert.equal((await db.query('select * from public.notifications')).rows.length,0);assert.equal((await db.query('select * from public.guides')).rows.length,0)});
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/004_department_assignees.sql',import.meta.url),'utf8'));
 await t.test('bölüm sorumlularını yalnızca süper admin yönetir ve yeni atamalar doğrulanır',async()=>{
  await login(1);
  await assert.rejects(db.query('select public.set_department_assignees($1,true,false)',[ids[1]]),/Süper admin/);
  await login(0);
  await assert.rejects(db.query('select public.set_department_assignees($1,true,false)',[ids[2]]),/Aktif kullanıcı/);
  const create="insert into public.tasks(title,description,category,brand,creator_id,assignee_id,due_date) values('Teknik talep','Örnek açıklama','Teknik İşlemler','İç Ekip',$1,$2,'2026-12-01')";
  await assert.rejects(db.query(create,[ids[0],ids[1]]),/aktif sorumluları/);
  await db.query('select public.set_department_assignees($1,true,false)',[ids[1]]);
  await db.query(create,[ids[0],ids[1]]);
  await db.query('select public.set_department_assignees($1,false,false)',[ids[1]]);
  await assert.rejects(db.query(create,[ids[0],ids[1]]),/aktif sorumluları/);
  await db.query("update public.tasks set progress=100 where id=$1",[taskId]);
 });
 }finally{await db.close()}
});
