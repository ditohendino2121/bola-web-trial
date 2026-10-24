-- MIGRASI LIGA V6 — aditif, aman di-run ulang
-- Gol bunuh diri per pemain (masuk ke skor tim lawan). Default 0, data lama tidak berubah.
alter table public.league_player_stats add column if not exists gol_bunuh_diri int not null default 0;
alter table public.league_player_stats drop constraint if exists league_player_stats_gbd_check;
alter table public.league_player_stats add constraint league_player_stats_gbd_check check (gol_bunuh_diri >= 0);

NOTIFY pgrst, 'reload schema';
