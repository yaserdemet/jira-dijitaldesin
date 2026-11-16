-- Teslim tarihi kullanılmıyor; kolon ve ona verilen güncelleme yetkisi kaldırılır.
-- 005_archive_and_rules.sql sonrasında SQL Editor'da bir kez çalıştırın. Tekrar çalıştırılabilir.
alter table public.tasks drop column if exists due_date;
