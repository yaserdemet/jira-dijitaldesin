-- Çalışanı kalıcı silme: giriş hesabı ve kişisel bilgiler silinir, iş geçmişi korunur.
-- Profil satırı kalır (talepler, yorumlar, dosyalar ona bağlı) ama adı "Silinmiş kullanıcı" olur,
-- e-posta ve birim boşaltılır. Giriş hesabı (auth.users) bu fonksiyondan sonra sunucuda silinir.
-- 006_drop_due_date.sql sonrasında SQL Editor'da bir kez çalıştırın. Tekrar çalıştırılabilir.
begin;

-- Profil, silinen giriş hesabından sonra da yaşayabilsin.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function public.delete_employee(target_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
 if not public.is_super_admin() then raise exception 'Süper admin yetkisi gerekli'; end if;
 select * into target from public.profiles where id = target_id for update;
 if target.id is null then raise exception 'Kullanıcı bulunamadı'; end if;
 if target.id = auth.uid() or target.role = 'super_admin' then raise exception 'Bu hesap silinemez'; end if;
 -- Daha önce silinmişse (ör. giriş hesabı silme adımı yarıda kaldıysa) tekrar çağrı zararsızdır.
 if target.deleted_at is not null then return; end if;

 -- Açık işler sahipsiz kalmasın: sorumluluk düşer, iş başkasına atanabilir. Biten işlerde ad geçmiş olarak kalır.
 update public.tasks set assignee_id = null where assignee_id = target_id and status not in ('Tamamlandı', 'İptal');
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
