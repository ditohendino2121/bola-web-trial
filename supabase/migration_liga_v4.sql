-- MIGRASI LIGA V4 — aditif, aman di-run ulang
-- Kebobolan kiper diinput manual per kiper (tim bisa punya 2 kiper, belum tentu dua-duanya main).
alter table public.league_player_stats add column if not exists kebobolan int;
alter table public.league_player_stats drop constraint if exists league_player_stats_kebobolan_check;
alter table public.league_player_stats add constraint league_player_stats_kebobolan_check
  check (kebobolan is null or kebobolan >= 0);

NOTIFY pgrst, 'reload schema';
