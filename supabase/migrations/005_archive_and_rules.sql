-- Arşiv/iptal, revize kuralı ve bölüm sorumlusu yoksa serbest atama.
-- 004_department_assignees.sql sonrasında SQL Editor'da bir kez çalıştırın.
begin;

-- 1) Arşiv: tamamlanan veya iptal edilen işler panodan kaldırılır, silinmez.
alter table public.tasks add column archived_at timestamptz;
create index tasks_archived on public.tasks(archived_at);
grant update(archived_at) on public.tasks to authenticated;

alter table public.tasks disable trigger user;
update public.tasks set archived_at=coalesce(updated_at,now()) where status='İptal';
alter table public.tasks enable trigger user;

create function public.guard_task_archive() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.archived_at=null;
  return new;
 end if;
 if new.status='İptal' and old.status is distinct from 'İptal' and not(old.creator_id=auth.uid() or public.is_super_admin()) then
  raise exception 'Talebi yalnızca açan kişi veya süper admin iptal edebilir';
 end if;
 if new.status not in ('Tamamlandı','İptal') then
  if old.archived_at is null and new.archived_at is not null then
   raise exception 'Yalnızca tamamlanan veya iptal edilen işler arşivlenebilir';
  end if;
  -- İş yeniden açılırsa arşivden kendiliğinden çıkar.
  new.archived_at=null;
 end if;
 return new;
end;$$;
create trigger guard_task_archive before insert or update on public.tasks for each row execute function public.guard_task_archive();
revoke all on function public.guard_task_archive() from public;

-- 2) Revize yalnızca üzerinde çalışılan veya tamamlanan işe istenir; iş arşivden çıkar, ilerleme %90'ı geçmez.
create or replace function public.request_revision(task_id uuid,reason text,expected_updated_at timestamptz) returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
 if not public.is_member() then raise exception 'Üyelik gerekli';end if;
 select * into t from public.tasks where id=task_id for update;
 if t.id is null or not(t.creator_id=auth.uid() or public.is_super_admin()) then raise exception 'Yetkiniz yok';end if;
 if t.updated_at<>expected_updated_at then raise exception 'İş değişti; listeyi yenileyin';end if;
 if t.status not in ('İşlemde','Onay Bekliyor','Tamamlandı') then raise exception 'Revize yalnızca üzerinde çalışılan veya tamamlanan işler için istenebilir';end if;
 if length(trim(reason))<3 or length(reason)>10000 then raise exception 'Revize açıklaması 3–10000 karakter olmalı';end if;
 perform set_config('akis.revision_task',task_id::text,true);
 insert into public.messages(task_id,author_id,body,kind) values(task_id,auth.uid(),trim(reason),'revision');
 update public.tasks set status='Revize İstendi',progress=least(t.progress,90),archived_at=null where id=task_id;
end;$$;

-- 3) Bölümde işaretli sorumlu yoksa her aktif çalışan atanabilir.
create or replace function public.guard_department_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.assignee_id is not distinct from old.assignee_id and new.category = old.category then
      return new;
    end if;
  end if;
  if new.assignee_id is not null and new.category in ('Teknik İşlemler', 'Grafik İşlemleri')
    and exists (
      select 1 from public.profiles p
      where p.active and case when new.category = 'Teknik İşlemler' then p.technical_assignee else p.design_assignee end
    )
    and not exists (
      select 1 from public.profiles p
      where p.id = new.assignee_id and p.active
        and case when new.category = 'Teknik İşlemler' then p.technical_assignee else p.design_assignee end
    ) then
    raise exception 'Bu kişi bölümün aktif sorumluları arasında değil.';
  end if;
  return new;
end;
$$;

commit;
