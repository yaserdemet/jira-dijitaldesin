-- Realtime: uygulama 30 saniyede bir yoklamak yerine bu tablolardaki değişikliklerden anında haberdar olur.
-- Değişiklik yalnızca "yenile" sinyali olarak kullanılır; veri yine RLS'li sorgularla okunur.
-- Realtime da RLS'e uyar: her kullanıcı yalnızca görebildiği satırların değişikliğini alır.
-- audit_logs bilerek eklenmedi (yalnızca süper admin görür, anlık olması gerekmez).
-- 007_delete_employee.sql sonrasında SQL Editor'da bir kez çalıştırın. Tekrar çalıştırılabilir.
do $$
declare
  t text;
begin
  -- Supabase bu yayını kendisi oluşturur; yoksa (yerel/test veritabanı) oluştur.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['profiles', 'tasks', 'messages', 'attachments', 'task_events', 'notifications', 'guides'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
