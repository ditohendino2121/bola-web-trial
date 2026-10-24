-- MIGRASI LIGA V7 — status "pertandingan selesai". Aditif, aman di-run ulang.
-- Hanya laga selesai yang masuk klasemen/statistik. Saat kolom PERTAMA kali dibuat, laga lama
-- yang sudah punya skor ditandai selesai (supaya klasemen yang sudah ada tidak hilang).
-- Run ulang tidak menyentuh data (blok update hanya jalan ketika kolom baru dibuat).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'league_matches' and column_name = 'selesai') then
    alter table public.league_matches add column selesai boolean not null default false;
    update public.league_matches set selesai = true where sh is not null and sa is not null;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
