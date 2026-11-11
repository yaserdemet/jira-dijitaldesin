begin;
-- Keep the original status values and audit history; four states are their UI projection.
alter table public.tasks add column progress integer not null default 0 check(progress between 0 and 100);
alter table public.tasks add column issue_description text not null default '' check(length(issue_description)<=10000);
alter table public.tasks disable trigger guard_task;
alter table public.tasks disable trigger audit_task;
update public.tasks set progress=case when status='Tamamlandı' then 100 when status='Onay Bekliyor' then 95 when status='İşlemde' then 50 else 0 end,
 issue_description=case when status='Bilgi Bekliyor' then 'Ek bilgi bekleniyor.' when status='İptal' then 'Önceki akışta iptal edilmiş talep.' when status='Revize İstendi' then 'Revize bekleniyor.' else '' end;
alter table public.tasks enable trigger guard_task;
alter table public.tasks enable trigger audit_task;
grant update(progress,issue_description) on public.tasks to authenticated;
alter table public.messages add column recipient_id uuid references public.profiles(id);
alter table public.messages add column parent_id uuid references public.messages(id);
create index messages_parent on public.messages(parent_id);

create table public.notifications (
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id),
 task_id uuid not null references public.tasks(id),message_id uuid references public.messages(id),
 body text not null,created_at timestamptz not null default now(),read_at timestamptz
);
create index notifications_inbox on public.notifications(recipient_id,created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy own_notifications on public.notifications for select to authenticated using(public.is_member() and recipient_id=auth.uid());
create policy read_own_notifications on public.notifications for update to authenticated using(public.is_member() and recipient_id=auth.uid()) with check(public.is_member() and recipient_id=auth.uid());

create or replace function public.guard_task() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member() then raise exception 'Üyelik gerekli';end if;
 if new.assignee_id is not null and not exists(select 1 from public.profiles where id=new.assignee_id and active) then raise exception 'Sorumlu aktif olmalı';end if;
 if tg_op='INSERT' then
  if new.creator_id<>auth.uid() or new.status not in ('Yeni','Atandı') then raise exception 'Başlangıç bilgileri geçersiz';end if;
  new.created_at=now();new.completed_at=null;new.revision_count=0;new.progress=0;new.issue_description='';
 else
  if new.id<>old.id or new.number<>old.number or new.creator_id<>old.creator_id or new.created_at<>old.created_at then raise exception 'Sabit alan değiştirilemez';end if;
  if not(old.creator_id=auth.uid() or old.assignee_id=auth.uid() or public.is_super_admin()) then raise exception 'Yetkiniz yok';end if;
  new.revision_count=old.revision_count;new.completed_at=old.completed_at;
  if new.status is distinct from old.status then
   if new.status='Revize İstendi' then
    if not(old.creator_id=auth.uid() or public.is_super_admin()) or current_setting('akis.revision_task',true) is distinct from old.id::text then raise exception 'Revize işlemini kullanın';end if;
    new.revision_count=old.revision_count+1;
    select body into new.issue_description from public.messages where task_id=old.id and kind='revision' order by created_at desc limit 1;
   end if;
   if new.status='Onay Bekliyor' and not exists(select 1 from public.attachments where task_id=old.id and kind='delivery') and not exists(select 1 from public.messages where task_id=old.id and kind='delivery') then raise exception 'Teslim açıklaması veya dosyası gerekli';end if;
   if new.status='Tamamlandı' then new.completed_at=now();else new.completed_at=null;end if;
  end if;
 end if;
 if new.status='Tamamlandı' then new.progress=100;
 elsif new.status in ('Yeni','Atandı') then new.progress=0;
 elsif new.status in ('İşlemde','Onay Bekliyor') then new.progress=greatest(5,least(95,new.progress));end if;
 if new.status='Bilgi Bekliyor' and length(trim(new.issue_description))<3 then raise exception 'Sorunun nedenini açıklayın';end if;
 if new.status not in ('Bilgi Bekliyor','Revize İstendi','İptal') then new.issue_description='';end if;
 new.updated_at=clock_timestamp();return new;
end;$$;

create function public.guard_message_reply() returns trigger language plpgsql security definer set search_path='' as $$
declare original public.messages;
begin
 if new.parent_id is not null then
  select * into original from public.messages where id=new.parent_id;
  if original.id is null or original.task_id<>new.task_id then raise exception 'Yanıt aynı talebe ait olmalı';end if;
  new.recipient_id=original.author_id;
 end if;
 if new.recipient_id is not null and not exists(select 1 from public.profiles where id=new.recipient_id and active) then
  -- Preserve replies to a former employee, without sending an inaccessible notification.
  if new.parent_id is null then raise exception 'Alıcı aktif olmalı';end if;
 end if;
 return new;
end;$$;
create trigger guard_reply before insert on public.messages for each row execute function public.guard_message_reply();
create function public.notify_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.recipient_id is not null and new.recipient_id<>new.author_id and exists(select 1 from public.profiles where id=new.recipient_id and active) then
  insert into public.notifications(recipient_id,task_id,message_id,body) values(new.recipient_id,new.task_id,new.id,(select name from public.profiles where id=new.author_id)||' sana bir yorum yazdı.');
 end if;
 insert into public.task_events(actor_id,task_id,action,details) values(new.author_id,new.task_id,case when new.kind='revision' then 'Revize istendi' when new.kind='delivery' then 'Teslim açıklaması eklendi' else 'Yorum eklendi' end,left(new.body,180));
 return new;
end;$$;
create trigger notify_message after insert on public.messages for each row execute function public.notify_message();
create function public.notify_task() returns trigger language plpgsql security definer set search_path='' as $$
declare targets uuid[]; target uuid; label text;
begin
 if tg_op='INSERT' then targets=array[new.assignee_id];label='Sana yeni bir talep atandı.';
 elsif new.status is distinct from old.status or new.progress is distinct from old.progress or new.assignee_id is distinct from old.assignee_id or new.issue_description is distinct from old.issue_description then
  targets=array[new.creator_id,new.assignee_id];label='Talep güncellendi: '||case when new.status='Tamamlandı' then 'Tamamlandı' when new.status in ('Yeni','Atandı') then 'Bekliyor' when new.status in ('İşlemde','Onay Bekliyor') then 'Yapılıyor' else 'Sorun Var' end||' · %'||new.progress;
 else return new;end if;
 for target in select distinct unnest(targets) loop
  if target is not null and target<>auth.uid() and exists(select 1 from public.profiles where id=target and active) then
   insert into public.notifications(recipient_id,task_id,body) values(target,new.id,label);
  end if;
 end loop;
 return new;
end;$$;
create trigger notify_task after insert or update on public.tasks for each row execute function public.notify_task();
create or replace function public.audit_task() returns trigger language plpgsql security definer set search_path='' as $$
declare label text; detail text;
begin
 if tg_op='INSERT' then label='Talep oluşturuldu';detail=new.title;
 elsif new.status is distinct from old.status then label='Durum değişti';detail=old.status||' → '||new.status||' · %'||new.progress;
 elsif new.progress is distinct from old.progress then label='İlerleme güncellendi';detail='%'||old.progress||' → %'||new.progress;
 elsif new.assignee_id is distinct from old.assignee_id then label='Sorumlu değişti';detail=coalesce((select name from public.profiles where id=new.assignee_id),'Atanmadı');
 else label='Talep güncellendi';detail=new.title;end if;
 if new.issue_description<>'' then detail=detail||' · '||left(new.issue_description,180);end if;
 insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),label,new.id::text,detail);
 insert into public.task_events(actor_id,task_id,action,details) values(auth.uid(),new.id,label,detail);
 return new;
end;$$;

create table public.guides(id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 3 and 180),body text not null check(length(trim(body)) between 10 and 20000),author_id uuid not null references public.profiles(id),created_at timestamptz not null default now());
alter table public.guides enable row level security;
revoke all on public.guides from anon,authenticated;
grant select,insert on public.guides to authenticated;
create policy member_guides on public.guides for select to authenticated using(public.is_member());
create policy create_guides on public.guides for insert to authenticated with check(public.is_member() and author_id=auth.uid());
create function public.audit_guide() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.created_at=now();
 insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),'Rehber yayımlandı',new.id::text,new.title);
 return new;
end;$$;
create trigger audit_guide before insert on public.guides for each row execute function public.audit_guide();
revoke all on function public.guard_message_reply(),public.notify_message(),public.notify_task(),public.audit_guide() from public;
commit;
