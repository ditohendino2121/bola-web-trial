-- MIGRASI LIGA V9 — absensi pemain per laga. Aditif, aman di-run ulang.
-- Kolom hadir dipakai untuk penghargaan (Pemain/Mid/Bek/Kiper terbaik): syarat minimal laga,
-- bonus hadir penuh, dan clean sheet. Kolom assist sudah ada sejak overhaul, tinggal dipakai lagi.
-- Saat kolom PERTAMA kali dibuat, data lama diisi: kiper dianggap hadir kalau kebobolannya terisi
-- (aturan lama "A/kosong = tidak main"), pemain lain dianggap hadir.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'league_player_stats' and column_name = 'hadir') then
    alter table public.league_player_stats add column hadir boolean not null default false;
    update public.league_player_stats set hadir = case when posisi = 'GK' then kebobolan is not null else true end;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
