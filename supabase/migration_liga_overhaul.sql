-- MIGRASI LIGA OVERHAUL — additif, aman di-run ulang
-- Edisi bulanan: 1 tanggal = 6 laga round-robin (tiap tim main 3x), nilai rubrik v1, player stats

-- 1. Edisi bulanan
create table if not exists public.league_editions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  tanggal date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_league_editions_tanggal on public.league_editions (tanggal);

-- 2. Hubungkan match ke edisi + tambah jadwal liga linkage di schedules
alter table public.league_matches add column if not exists edition_id uuid references public.league_editions(id) on delete cascade;
create index if not exists idx_league_matches_edition on public.league_matches (edition_id);
alter table public.schedules add column if not exists is_liga boolean not null default false;
alter table public.schedules add column if not exists edition_id uuid references public.league_editions(id) on delete cascade;
alter table public.schedules add column if not exists liga_match_id uuid references public.league_matches(id) on delete set null;
create index if not exists idx_schedules_edition on public.schedules (edition_id);

-- 3. Player stats per match (gol, assist, aksi, kartu, blunder, nilai oto/override)
create table if not exists public.league_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.league_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team text not null,
  posisi text not null,
  gol int not null default 0 check (gol >= 0),
  assist int not null default 0 check (assist >= 0),
  aksi_kunci int not null default 0 check (aksi_kunci >= 0),
  shot_on_target int not null default 0 check (shot_on_target >= 0),
  kartu text not null default 'tidak' check (kartu in ('tidak','kuning','merah')),
  blunder int not null default 0 check (blunder >= 0),
  nilai_oto numeric(3,1),
  override numeric(3,1),
  catatan_override text default '',
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);
create index if not exists idx_league_player_stats_match on public.league_player_stats (match_id);
create index if not exists idx_league_player_stats_user on public.league_player_stats (user_id);

-- 4. RLS untuk tabel baru
alter table public.league_editions enable row level security;
alter table public.league_player_stats enable row level security;

drop policy if exists p_league_ed_select on public.league_editions;
create policy p_league_ed_select on public.league_editions for select to authenticated using (true);
drop policy if exists p_league_ed_admin on public.league_editions;
create policy p_league_ed_admin on public.league_editions for all to authenticated using (public.is_admin());

drop policy if exists p_league_ps_select on public.league_player_stats;
create policy p_league_ps_select on public.league_player_stats for select to authenticated using (true);
drop policy if exists p_league_ps_admin on public.league_player_stats;
create policy p_league_ps_admin on public.league_player_stats for all to authenticated using (public.is_admin());

-- 5. Migrasi data lama: 6 laga tanpa edition → masuk edisi "Edisi Berjalan"
do $$
declare
  v_ed uuid;
begin
  if exists (select 1 from public.league_matches where edition_id is null limit 1) then
    insert into public.league_editions (label, tanggal) values ('Edisi Berjalan', current_date) returning id into v_ed;
    update public.league_matches set edition_id = v_ed where edition_id is null;
  end if;
end $$;

-- 6. Backfill is_liga untuk schedules yang sudah terhubung (jika ada)
-- tidak ada data awal, future inserts akan set is_liga=true via kode

NOTIFY pgrst, 'reload schema';
