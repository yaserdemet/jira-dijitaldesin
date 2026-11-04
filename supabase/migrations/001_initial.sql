-- Yeni Supabase projesinde SQL Editor üzerinden bir kez çalıştırın.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id), name text not null check(length(name) between 1 and 100),
 email text not null, role text not null default 'employee' check(role in ('employee','super_admin')),
 active boolean not null default false, team text not null default 'Ekip', created_at timestamptz not null default now()
);
create function public.is_member() returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.profiles where id=auth.uid() and active);
$$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_member() and exists(select 1 from public.profiles where id=auth.uid() and active and role='super_admin');
$$;
create function public.on_auth_user_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,name,email,team,active) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),100),new.email,left(coalesce(new.raw_user_meta_data->>'team','Ekip'),100),new.invited_at is not null);
 return new;
end;$$;
create trigger auth_user_profile after insert on auth.users for each row execute function public.on_auth_user_created();
-- Auth daveti invited_at alanını kullanıcı insert işleminden sonra doldurabilir.
create function public.on_auth_user_invited() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.invited_at is null and new.invited_at is not null then
  update public.profiles set active=true where id=new.id;
 end if;
 return new;
end;$$;
create trigger auth_user_invited after update of invited_at on auth.users for each row execute function public.on_auth_user_invited();
create table public.tasks (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity(start with 1001) unique,
 title text not null check(length(trim(title)) between 3 and 180), description text not null check(length(trim(description)) between 5 and 10000),
 category text not null check(category in ('Grafik İşlemleri','Teknik İşlemler','Diğer Talepler')),
 brand text not null check(length(trim(brand)) between 1 and 100),
 priority text not null default 'Normal' check(priority in ('Normal','Yüksek','Acil')),
 status text not null default 'Yeni' check(status in ('Yeni','Atandı','İşlemde','Bilgi Bekliyor','Onay Bekliyor','Revize İstendi','Tamamlandı','İptal')),
 creator_id uuid not null references public.profiles(id), assignee_id uuid references public.profiles(id),
 due_date date not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 completed_at timestamptz, revision_count integer not null default 0 check(revision_count>=0)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id), author_id uuid not null references public.profiles(id),
 body text not null check(length(trim(body)) between 1 and 10000), kind text not null default 'comment' check(kind in ('comment','revision','delivery')),
 created_at timestamptz not null default now()
);
create table public.attachments (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id), uploader_id uuid not null references public.profiles(id),
 name text not null check(length(name) between 1 and 255), size bigint not null check(size between 1 and 20971520),
 mime text not null check(mime in ('application/pdf','image/png','image/jpeg','image/webp')),
 path text not null unique, kind text not null check(kind in ('brief','delivery')), created_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null,
 entity_id text not null, details text not null default '', created_at timestamptz not null default now()
);
create table public.task_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), task_id uuid not null references public.tasks(id),
 action text not null, details text not null default '', created_at timestamptz not null default now()
);
create index tasks_assignee on public.tasks(assignee_id,status);
create index tasks_created on public.tasks(created_at desc);
create index messages_task on public.messages(task_id,created_at);
create index attachments_task on public.attachments(task_id,created_at);
create index events_task on public.task_events(task_id,created_at);
create index audit_created on public.audit_logs(created_at desc);
create function public.can_edit_task(task_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_member() and exists(select 1 from public.tasks t where t.id=task_id and (t.creator_id=auth.uid() or t.assignee_id=auth.uid() or public.is_super_admin()));
$$;
create function public.guard_task() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_member() then raise exception 'Üyelik gerekli'; end if;
 if new.assignee_id is not null and not exists(select 1 from public.profiles where id=new.assignee_id and active) then raise exception 'Sorumlu aktif olmalı'; end if;
 if tg_op='INSERT' then
   if new.creator_id<>auth.uid() then raise exception 'Talep sahibi geçersiz'; end if;
   if new.status not in ('Yeni','Atandı') then raise exception 'Başlangıç durumu geçersiz'; end if;
   new.created_at=now();new.completed_at=null;new.revision_count=0;
 else
   if new.id<>old.id or new.number<>old.number or new.creator_id<>old.creator_id or new.created_at<>old.created_at then raise exception 'Sabit alan değiştirilemez';end if;
   if not (old.creator_id=auth.uid() or old.assignee_id=auth.uid() or public.is_super_admin()) then raise exception 'Yetkiniz yok';end if;
   new.revision_count=old.revision_count;new.completed_at=old.completed_at;
   if new.status is distinct from old.status then
    if new.status='Tamamlandı' and old.status<>'Onay Bekliyor' then raise exception 'Önce onaya gönderilmeli';end if;
    if new.status in ('Tamamlandı','Revize İstendi') and not(old.creator_id=auth.uid() or public.is_super_admin()) then raise exception 'Talep sahibi onayı gerekli';end if;
    if new.status='Revize İstendi' then
      if current_setting('akis.revision_task',true) is distinct from old.id::text then raise exception 'Revize açıklaması gerekli; revize işlemini kullanın';end if;
      new.revision_count=old.revision_count+1;
    end if;
    if new.status='Onay Bekliyor' and not exists(select 1 from public.attachments where task_id=old.id and kind='delivery') and not exists(select 1 from public.messages where task_id=old.id and kind='delivery') then raise exception 'Teslim dosyası veya çözüm açıklaması gerekli';end if;
    if new.status='Tamamlandı' then new.completed_at=now();else new.completed_at=null;end if;
   end if;
 end if;
 new.updated_at=clock_timestamp();return new;
end;$$;
create trigger guard_task before insert or update on public.tasks for each row execute function public.guard_task();
create function public.audit_task() returns trigger language plpgsql security definer set search_path = '' as $$
declare action_name text; detail text;
begin
 if tg_op='INSERT' then action_name='Talep oluşturuldu';detail=new.title;
 elsif old.status is distinct from new.status then action_name='Durum değişti';detail=old.status||' → '||new.status;
 elsif old.assignee_id is distinct from new.assignee_id then action_name='Sorumlu değişti';detail=coalesce((select name from public.profiles where id=new.assignee_id),'Atanmadı');
 else action_name='Talep güncellendi';detail=new.title;end if;
 insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),action_name,new.id::text,detail);
 insert into public.task_events(actor_id,task_id,action,details) values(auth.uid(),new.id,action_name,detail);
 return new;
end;$$;
create trigger audit_task after insert or update on public.tasks for each row execute function public.audit_task();
create function public.audit_content() returns trigger language plpgsql security definer set search_path = '' as $$
declare label text; detail text;
begin
 new.created_at=now();
 if tg_table_name='messages' then
  if new.author_id<>auth.uid() then raise exception 'Yazar geçersiz';end if;
  if new.kind='delivery' and not public.can_edit_task(new.task_id) then raise exception 'Teslim yetkisi gerekli';end if;
  if new.kind='revision' and current_setting('akis.revision_task',true) is distinct from new.task_id::text then raise exception 'Revize işlemini kullanın';end if;
  label=case when new.kind='revision' then 'Revize istendi' when new.kind='delivery' then 'Çözüm açıklaması eklendi' else 'Yorum eklendi' end;detail=left(new.body,180);
 else
  if new.uploader_id<>auth.uid() then raise exception 'Yükleyen geçersiz';end if;
  if new.kind='delivery' and not public.can_edit_task(new.task_id) then raise exception 'Teslim yetkisi gerekli';end if;
  if split_part(new.path,'/',1)<>auth.uid()::text or split_part(new.path,'/',2)<>new.task_id::text then raise exception 'Dosya yolu geçersiz';end if;
  if not exists(select 1 from storage.objects where bucket_id='task-files' and name=new.path) then raise exception 'Dosya bulunamadı';end if;
  label='Dosya eklendi';detail=new.name;
 end if;
 insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),label,new.task_id::text,detail);
 return new;
end;$$;
create trigger audit_message before insert on public.messages for each row execute function public.audit_content();
create trigger audit_attachment before insert on public.attachments for each row execute function public.audit_content();
create function public.set_employee_active(target_id uuid,enabled boolean) returns void language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
 if not public.is_super_admin() then raise exception 'Süper admin yetkisi gerekli';end if;
 select * into target from public.profiles where id=target_id for update;
 if target.id is null or target.role='super_admin' or target.id=auth.uid() then raise exception 'Bu hesap değiştirilemez';end if;
 update public.profiles set active=enabled where id=target_id;
 insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),case when enabled then 'Hesap etkinleştirildi' else 'Hesap erişimi kapatıldı' end,target_id::text,target.email);
end;$$;
create function public.request_revision(task_id uuid,reason text,expected_updated_at timestamptz) returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
 if not public.is_member() then raise exception 'Üyelik gerekli';end if;
 select * into t from public.tasks where id=task_id for update;
 if t.id is null or not(t.creator_id=auth.uid() or public.is_super_admin()) then raise exception 'Yetkiniz yok';end if;
 if t.updated_at<>expected_updated_at then raise exception 'İş değişti; listeyi yenileyin';end if;
 if t.status='Revize İstendi' then raise exception 'Zaten revize bekleniyor';end if;
 if length(trim(reason))<3 or length(reason)>10000 then raise exception 'Revize açıklaması 3–10000 karakter olmalı';end if;
 perform set_config('akis.revision_task',task_id::text,true);
 insert into public.messages(task_id,author_id,body,kind) values(task_id,auth.uid(),trim(reason),'revision');
 update public.tasks set status='Revize İstendi' where id=task_id;
end;$$;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.task_events enable row level security;
revoke all on public.profiles,public.tasks,public.messages,public.attachments,public.audit_logs,public.task_events from anon,authenticated;
grant select on public.profiles,public.tasks,public.messages,public.attachments,public.task_events,public.audit_logs to authenticated;
grant insert on public.tasks,public.messages,public.attachments to authenticated;
grant update(title,description,category,brand,priority,status,assignee_id,due_date) on public.tasks to authenticated;
grant usage,select on sequence public.tasks_number_seq to authenticated;
create policy member_profiles on public.profiles for select to authenticated using(public.is_member());
create policy member_tasks on public.tasks for select to authenticated using(public.is_member());
create policy create_tasks on public.tasks for insert to authenticated with check(public.is_member() and creator_id=auth.uid());
create policy update_tasks on public.tasks for update to authenticated using(public.can_edit_task(id)) with check(public.is_member());
create policy member_messages on public.messages for select to authenticated using(public.is_member());
create policy create_messages on public.messages for insert to authenticated with check(public.is_member() and author_id=auth.uid());
create policy member_attachments on public.attachments for select to authenticated using(public.is_member());
create policy create_attachments on public.attachments for insert to authenticated with check(public.is_member() and uploader_id=auth.uid());
create policy admin_logs on public.audit_logs for select to authenticated using(public.is_super_admin());
create policy member_events on public.task_events for select to authenticated using(public.is_member());
revoke all on function public.is_member(),public.is_super_admin(),public.can_edit_task(uuid),public.request_revision(uuid,text,timestamptz),public.set_employee_active(uuid,boolean) from public;
grant execute on function public.is_member(),public.is_super_admin(),public.can_edit_task(uuid),public.request_revision(uuid,text,timestamptz),public.set_employee_active(uuid,boolean) to authenticated;
revoke all on function public.on_auth_user_created(),public.on_auth_user_invited(),public.guard_task(),public.audit_task(),public.audit_content() from public;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('task-files','task-files',false,20971520,array['application/pdf','image/png','image/jpeg','image/webp']);
create policy read_task_files on storage.objects for select to authenticated using(bucket_id='task-files' and public.is_member());
create policy upload_task_files on storage.objects for insert to authenticated with check(
 bucket_id='task-files' and public.is_member() and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.tasks where id::text=(storage.foldername(name))[2])
 and lower(storage.extension(name)) in ('pdf','png','jpg','jpeg','webp')
);
-- Yalnızca metadata kaydı oluşmamış, kendine ait yarım yüklemeler temizlenebilir.
create policy cleanup_task_files on storage.objects for delete to authenticated using(bucket_id='task-files' and public.is_member() and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.attachments a where a.path=storage.objects.name));
commit;
