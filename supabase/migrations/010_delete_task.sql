-- Talebi kalıcı silme: yalnızca talebi açan kişi veya süper admin.
-- Talep, yorumları, geçmişi, bildirimleri ve dosya kayıtlarıyla birlikte silinir; denetim kaydı kalır.
-- Depodaki dosyaları normal kullanıcı silemediği için fonksiyon dosya yollarını döndürür;
-- sunucu ucu (/api/tasks/delete) bunları yönetici anahtarıyla depodan siler.
-- 009_clear_audit_logs.sql sonrasında SQL Editor'da bir kez çalıştırın. Tekrar çalıştırılabilir.
create or replace function public.delete_task(target_id uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  target public.tasks;
  paths text[];
begin
  if not public.is_member() then
    raise exception 'Oturum gerekli';
  end if;

  select * into target from public.tasks where id = target_id for update;
  if target.id is null then
    raise exception 'Talep bulunamadı';
  end if;
  if target.creator_id <> auth.uid() and not public.is_super_admin() then
    raise exception 'Talebi yalnızca açan kişi veya süper admin silebilir';
  end if;

  select coalesce(array_agg(path), '{}') into paths from public.attachments where task_id = target_id;

  -- Bildirimler yorumlara ve talebe, diğerleri talebe bağlı olduğu için bu sırayla.
  delete from public.notifications where task_id = target_id;
  delete from public.attachments where task_id = target_id;
  delete from public.messages where task_id = target_id;
  delete from public.task_events where task_id = target_id;
  delete from public.tasks where id = target_id;

  insert into public.audit_logs(actor_id, action, entity_id, details)
    values (auth.uid(), 'Talep kalıcı olarak silindi', target_id::text,
            '#' || target.number || ' ' || target.title || ' (' || coalesce(array_length(paths, 1), 0) || ' dosya)');

  return paths;
end;
$$;

revoke all on function public.delete_task(uuid) from public, anon;
grant execute on function public.delete_task(uuid) to authenticated;
