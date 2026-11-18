-- Denetim kayıtlarını temizleme: yalnızca süper admin, yalnızca bu fonksiyonla.
-- Bütün kayıtlar silinir ama yerine "kim, ne zaman, kaç kayıt" bilgisini taşıyan tek bir kayıt kalır;
-- böylece silme işleminin kendisi iz bırakır. Tabloya doğrudan DELETE yetkisi verilmez.
-- 008_realtime.sql sonrasında SQL Editor'da bir kez çalıştırın. Tekrar çalıştırılabilir.
create or replace function public.clear_audit_logs() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  if not public.is_super_admin() then
    raise exception 'Süper admin yetkisi gerekli';
  end if;

  delete from public.audit_logs where true;
  get diagnostics removed = row_count;

  insert into public.audit_logs(actor_id, action, entity_id, details)
    values (auth.uid(), 'Denetim kayıtları silindi', auth.uid()::text, removed || ' kayıt kalıcı olarak silindi');

  return removed;
end;
$$;

revoke all on function public.clear_audit_logs() from public, anon;
grant execute on function public.clear_audit_logs() to authenticated;
