-- MIGRASI LIGA V5 — aktifkan Supabase Realtime untuk skor & catatan pemain (tampilan layar live).
-- Aman di-run ulang: tabel hanya ditambahkan ke publication kalau belum ada. Tidak mengubah data.
-- Hak baca tetap mengikuti RLS (hanya akun login yang menerima perubahan).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_matches') then
    alter publication supabase_realtime add table public.league_matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_player_stats') then
    alter publication supabase_realtime add table public.league_player_stats;
  end if;
end $$;
