-- Daha önce eski 001_initial.sql ile kurulmuş projeler için: iki aşamalı doğrulama (aal2) şartını
-- ve kullanılmayan e-posta daveti tetikleyicisini kaldırır. Birden fazla kez çalıştırılabilir.
-- Yeni kurulumda yalnızca 001_initial.sql yeterlidir.
begin;
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active);
$$;
drop trigger if exists auth_user_invited on auth.users;
drop function if exists public.on_auth_user_invited();
create or replace function public.on_auth_user_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,name,email,team,active) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),100),new.email,left(coalesce(new.raw_user_meta_data->>'team','Ekip'),100),false);
 return new;
end;$$;
revoke all on function public.on_auth_user_created() from public;
commit;
