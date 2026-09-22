-- MIGRASI KOCOK — pool nullable, kocok per posisi ber-cap
-- 1. Longgarkan team jadi nullable + boleh NULL
alter table public.league_members alter column team drop not null;
alter table public.league_members drop constraint if exists league_members_team_check;
alter table public.league_members add constraint league_members_team_check check (team is null or team in ('A','B','C','D'));

-- 2. Index untuk performa pool
create index if not exists idx_league_members_team_null on public.league_members (team) where team is null;

NOTIFY pgrst, 'reload schema';
