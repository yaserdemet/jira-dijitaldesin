-- Talep açıklaması (isteğe bağlı) ve bir işe birden fazla sorumlu.
-- 010_delete_task.sql sonrasında SQL Editor'da bir kez çalıştırın. Tekrar çalıştırılabilir.
--
-- assignee_ids asıl sorumlu listesidir. assignee_id kaldırılmadı: listedeki ilk kişiyi tutar,
-- tetikleyici onu kendisi doldurur. Böylece güncellemeyi henüz almamış açık sekmeler
-- (yalnızca assignee_id yazan eski istemci) bozulmaz.
begin;

-- 1) Serbest açıklama. Talep formundaki yapılandırılmış alanlar (description) ayrı kalır.
alter table public.tasks add column if not exists notes text;
alter table public.tasks drop constraint if exists tasks_notes_length;
alter table public.tasks add constraint tasks_notes_length check (notes is null or length(notes) <= 10000);

-- 2) Sorumlu listesi.
alter table public.tasks add column if not exists assignee_ids uuid[] not null default '{}';
alter table public.tasks drop constraint if exists tasks_assignee_ids_limit;
alter table public.tasks add constraint tasks_assignee_ids_limit check (cardinality(assignee_ids) <= 10);

alter table public.tasks disable trigger user;
update public.tasks set assignee_ids = array[assignee_id] where assignee_id is not null and assignee_ids = '{}';
alter table public.tasks enable trigger user;

create index if not exists tasks_assignee_ids on public.tasks using gin (assignee_ids);
grant update(notes, assignee_ids) on public.tasks to authenticated;

-- Listeyi temizler (boş ve tekrar eden kişiler atılır, sıra korunur) ve assignee_id'yi eşler.
-- Adı "assignees_" ile başlar ki diğer "guard_" tetikleyicilerinden önce çalışsın (Postgres ada göre sıralar).
create or replace function public.sync_task_assignees() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Eski istemci yalnızca assignee_id yazdıysa liste ona göre kurulur.
  if tg_op = 'UPDATE' then
    if new.assignee_ids is not distinct from old.assignee_ids and new.assignee_id is distinct from old.assignee_id then
      new.assignee_ids = case when new.assignee_id is null then '{}'::uuid[] else array[new.assignee_id] end;
    end if;
  elsif coalesce(cardinality(new.assignee_ids), 0) = 0 and new.assignee_id is not null then
    new.assignee_ids = array[new.assignee_id];
  end if;

  new.assignee_ids = coalesce((
    select array_agg(s.assignee order by s.first_seen)
    from (
      select u.assignee, min(u.position) as first_seen
      from unnest(new.assignee_ids) with ordinality as u(assignee, position)
      where u.assignee is not null
      group by u.assignee
    ) s
  ), '{}'::uuid[]);
  new.assignee_id = new.assignee_ids[1];
  return new;
end;
$$;
revoke all on function public.sync_task_assignees() from public, anon, authenticated;
drop trigger if exists assignees_sync on public.tasks;
create trigger assignees_sync before insert or update on public.tasks
for each row execute function public.sync_task_assignees();

-- 3) Düzenleme yetkisi: talep sahibi, sorumlulardan biri veya süper admin.
create or replace function public.can_edit_task(task_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists(
    select 1 from public.tasks t
    where t.id = task_id and (t.creator_id = auth.uid() or auth.uid() = any(t.assignee_ids) or public.is_super_admin())
  );
$$;

-- 003_workflow.sql'deki kurallar aynen; sorumlu kontrolleri listeye göre.
-- Aktiflik yalnızca yeni eklenen kişiler için denetlenir: erişimi kapatılan bir sorumlu işteki diğer güncellemeleri engellemesin.
create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_member() then raise exception 'Üyelik gerekli';end if;
 if exists(
   select 1 from unnest(new.assignee_ids) as u(assignee)
   where (tg_op = 'INSERT' or not (u.assignee = any(old.assignee_ids)))
     and not exists(select 1 from public.profiles p where p.id = u.assignee and p.active)
 ) then raise exception 'Sorumlu aktif olmalı';end if;
 if tg_op='INSERT' then
  if new.creator_id<>auth.uid() or new.status not in ('Yeni','Atandı') then raise exception 'Başlangıç bilgileri geçersiz';end if;
  new.created_at=now();new.completed_at=null;new.revision_count=0;new.progress=0;new.issue_description='';
 else
  if new.id<>old.id or new.number<>old.number or new.creator_id<>old.creator_id or new.created_at<>old.created_at then raise exception 'Sabit alan değiştirilemez';end if;
  if not(old.creator_id=auth.uid() or auth.uid() = any(old.assignee_ids) or public.is_super_admin()) then raise exception 'Yetkiniz yok';end if;
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

-- 4) Bölüm sorumlusu kuralı (005) listedeki her kişi için.
-- Bölüm aynı kaldıysa yalnızca yeni eklenenler denetlenir; bölüm değiştiyse herkes.
create or replace function public.guard_department_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  checked uuid[];
begin
  if new.category not in ('Teknik İşlemler', 'Grafik İşlemleri') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.category = old.category then
    select coalesce(array_agg(u.assignee), '{}'::uuid[]) into checked
    from unnest(new.assignee_ids) as u(assignee)
    where not (u.assignee = any(old.assignee_ids));
  else
    checked = new.assignee_ids;
  end if;
  if cardinality(checked) = 0 then
    return new;
  end if;
  if exists (
      select 1 from public.profiles p
      where p.active and case when new.category = 'Teknik İşlemler' then p.technical_assignee else p.design_assignee end
    )
    and exists (
      select 1 from unnest(checked) as u(assignee)
      where not exists (
        select 1 from public.profiles p
        where p.id = u.assignee and p.active
          and case when new.category = 'Teknik İşlemler' then p.technical_assignee else p.design_assignee end
      )
    ) then
    raise exception 'Bu kişi bölümün aktif sorumluları arasında değil.';
  end if;
  return new;
end;
$$;
-- Eski tetikleyici yalnızca "update of assignee_id, category" ile çalışıyordu; liste değişince de çalışsın.
drop trigger if exists guard_department_assignee on public.tasks;
create trigger guard_department_assignee before insert or update on public.tasks
for each row execute function public.guard_department_assignee();

-- 5) Bildirim: yeni eklenen sorumlulara "atandı", talep sahibi ve diğer sorumlulara "güncellendi".
create or replace function public.notify_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  added uuid[];
  targets uuid[] := '{}';
  target uuid;
  label text;
begin
  if tg_op = 'INSERT' then
    added = new.assignee_ids;
  else
    select coalesce(array_agg(u.assignee), '{}'::uuid[]) into added
    from unnest(new.assignee_ids) as u(assignee)
    where not (u.assignee = any(old.assignee_ids));
    if new.status is distinct from old.status or new.progress is distinct from old.progress
       or new.assignee_ids is distinct from old.assignee_ids or new.issue_description is distinct from old.issue_description then
      targets = array[new.creator_id] || new.assignee_ids;
      label = 'Talep güncellendi: ' || case when new.status = 'Tamamlandı' then 'Tamamlandı' when new.status in ('Yeni','Atandı') then 'Bekliyor' when new.status in ('İşlemde','Onay Bekliyor') then 'Yapılıyor' else 'Sorun Var' end || ' · %' || new.progress;
    end if;
  end if;

  for target in select distinct unnest(added) loop
    if target <> auth.uid() and exists(select 1 from public.profiles where id = target and active) then
      insert into public.notifications(recipient_id, task_id, body) values (target, new.id, 'Sana yeni bir talep atandı.');
    end if;
  end loop;
  for target in select distinct x from unnest(targets) as x where not (x = any(added)) loop
    if target is not null and target <> auth.uid() and exists(select 1 from public.profiles where id = target and active) then
      insert into public.notifications(recipient_id, task_id, body) values (target, new.id, label);
    end if;
  end loop;
  return new;
end;
$$;

-- 6) Geçmiş: sorumlu değişince bütün adlar yazılır.
create or replace function public.audit_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare label text; detail text;
begin
 if tg_op='INSERT' then label='Talep oluşturuldu';detail=new.title;
 elsif new.status is distinct from old.status then label='Durum değişti';detail=old.status||' → '||new.status||' · %'||new.progress;
 elsif new.progress is distinct from old.progress then label='İlerleme güncellendi';detail='%'||old.progress||' → %'||new.progress;
 elsif new.assignee_ids is distinct from old.assignee_ids then
  label='Sorumlu değişti';
  detail=coalesce((
   select string_agg(p.name, ', ' order by u.position)
   from unnest(new.assignee_ids) with ordinality as u(assignee, position)
   join public.profiles p on p.id = u.assignee
  ),'Atanmadı');
 else label='Talep güncellendi';detail=new.title;end if;
 if new.issue_description<>'' then detail=detail||' · '||left(new.issue_description,180);end if;
 insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),label,new.id::text,detail);
 insert into public.task_events(actor_id,task_id,action,details) values(auth.uid(),new.id,label,detail);
 return new;
end;$$;

-- 7) Çalışan silinince (007) yalnızca o kişi açık işlerin listesinden çıkar; diğer sorumlular kalır.
create or replace function public.delete_employee(target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
 if not public.is_super_admin() then raise exception 'Süper admin yetkisi gerekli'; end if;
 select * into target from public.profiles where id = target_id for update;
 if target.id is null then raise exception 'Kullanıcı bulunamadı'; end if;
 if target.id = auth.uid() or target.role = 'super_admin' then raise exception 'Bu hesap silinemez'; end if;
 if target.deleted_at is not null then return; end if;

 update public.tasks set assignee_ids = array_remove(assignee_ids, target_id)
   where target_id = any(assignee_ids) and status not in ('Tamamlandı', 'İptal');
 delete from public.notifications where recipient_id = target_id;
 update public.profiles
   set name = 'Silinmiş kullanıcı', email = '', team = '', active = false,
       technical_assignee = false, design_assignee = false, deleted_at = now()
   where id = target_id;
 insert into public.audit_logs(actor_id, action, entity_id, details)
   values (auth.uid(), 'Kullanıcı kalıcı olarak silindi', target_id::text, target.name);
end;$$;
revoke all on function public.delete_employee(uuid) from public, anon;
grant execute on function public.delete_employee(uuid) to authenticated;

commit;
