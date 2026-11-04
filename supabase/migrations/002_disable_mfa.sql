-- İki aşamalı doğrulama (TOTP) zorunluluğunu kaldırır. Giriş yalnızca e-posta bağlantısıyla yapılır.
-- 001_initial.sql çalıştırıldıktan sonra, SQL Editor'da YENİ ve BOŞ bir sorguda bir kez çalıştırın.
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active);
$$;
