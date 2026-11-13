begin;

alter table public.profiles
  add column technical_assignee boolean,
  add column design_assignee boolean;

update public.profiles
set technical_assignee = btrim(name) ~* '^(harun|yaser)([[:space:]]|$)',
    design_assignee = team = 'Grafik Tasarım';

alter table public.profiles
  alter column technical_assignee set default false,
  alter column technical_assignee set not null,
  alter column design_assignee set default false,
  alter column design_assignee set not null;

create function public.set_department_assignees(target_id uuid, technical boolean, design boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'Süper admin yetkisi gerekli.';
  end if;
  update public.profiles
  set technical_assignee = technical, design_assignee = design
  where id = target_id and active;
  if not found then raise exception 'Aktif kullanıcı bulunamadı.'; end if;
  insert into public.audit_logs(actor_id, action, entity_id, details)
  values(auth.uid(), 'Bölüm sorumluları güncellendi', target_id::text,
         'Yazılım Destek: ' || technical::text || ', Grafik Tasarım: ' || design::text);
end;
$$;
revoke all on function public.set_department_assignees(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_department_assignees(uuid, boolean, boolean) to authenticated;

create function public.guard_department_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.assignee_id is not distinct from old.assignee_id and new.category = old.category then
      return new;
    end if;
  end if;
  if new.assignee_id is not null and new.category in ('Teknik İşlemler', 'Grafik İşlemleri')
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
revoke all on function public.guard_department_assignee() from public, anon, authenticated;
create trigger guard_department_assignee
before insert or update of assignee_id, category on public.tasks
for each row execute function public.guard_department_assignee();

commit;
