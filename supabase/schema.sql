-- ============================================================
-- MUBA FC — Schema Supabase (jalankan di Dashboard → SQL Editor)
-- Project: muba-fc | Region: Singapore
-- Aman di-run ulang (IF NOT EXISTS).
-- ============================================================

-- ---------- 0. Helper admin check (anti rekursi RLS) ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------- 1. profiles (1 baris per auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nama text not null,
  wa text unique not null,
  role text not null default 'player' check (role in ('admin','player')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_member boolean not null default false,
  setuju_akad boolean not null default false,
  setuju_at timestamptz,
  akad_version text,
  created_at timestamptz not null default now()
);

-- Auto-buat profile + wallet tiap user auth baru
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nama, wa)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nama', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'wa', '')
  )
  on conflict (id) do nothing;
  insert into public.wallets (user_id, paket, reguler, paket_gk, reguler_gk)
  values (new.id, 0, 0, 0, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. wallets (bucket normal + khusus GK) ----------
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  paket int not null default 0 check (paket >= 0),
  reguler int not null default 0 check (reguler >= 0),
  paket_gk int not null default 0 check (paket_gk >= 0),
  reguler_gk int not null default 0 check (reguler_gk >= 0)
);

-- ---------- 3. schedules ----------
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  jam text not null default '20:00-22:00',
  lokasi text not null default '',
  kuota int not null default 28,
  status text not null default 'buka' check (status in ('buka','tutup','full_booked','sparing')),
  created_at timestamptz not null default now()
);
create index if not exists idx_schedules_tanggal on public.schedules (tanggal);

-- ---------- 4. rsvps ----------
create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'confirmed_langsung'
    check (status in ('confirmed_lunas','confirmed_utang','confirmed_langsung','wajib_bayar','cancelled','no_show')),
  posisi text not null default 'Depan' check (posisi in ('GK','Belakang','Tengah','Depan')),
  metode text not null default 'langsung' check (metode in ('deposit','utang','langsung')),
  pakai_gk boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_rsvps_schedule on public.rsvps (schedule_id);
create index if not exists idx_rsvps_user on public.rsvps (user_id);
-- 1 pemain max 1 RSVP aktif per jadwal (cancelled boleh ganda)
drop index if exists uq_rsvp_aktif;
create unique index uq_rsvp_aktif on public.rsvps (schedule_id, user_id) where (status <> 'cancelled');

-- ---------- 5. txs (kas + klaim + koreksi) ----------
create table if not exists public.txs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default '',
  kredit_paket int not null default 0,
  kredit_reguler int not null default 0,
  rupiah int not null default 0,
  metode text not null default '',
  tanggal timestamptz not null default now(),
  status text not null default 'success' check (status in ('pending','success','rejected')),
  paket text check (paket in ('1x','4x')),
  bukti text default '',
  catatan text default '',
  private_note text default '',
  is_gk boolean not null default false
);
create index if not exists idx_txs_user on public.txs (user_id);
create index if not exists idx_txs_tanggal on public.txs (tanggal);

-- ---------- 6. expenses & incomes ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  jenis text not null,
  keterangan text not null default '',
  nominal int not null default 0 check (nominal >= 0)
);
create index if not exists idx_expenses_tanggal on public.expenses (tanggal);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  sumber text not null default '',
  keterangan text not null default '',
  nominal int not null default 0 check (nominal >= 0)
);
create index if not exists idx_incomes_tanggal on public.incomes (tanggal);

-- ---------- 7. settings (kas awal) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  kas_awal int not null default 0,
  kas_awal_tanggal date not null default current_date
);
insert into public.settings (id, kas_awal, kas_awal_tanggal)
values (1, 0, current_date) on conflict (id) do nothing;

-- ---------- 8. liga ----------
create table if not exists public.league_meta (
  id int primary key default 1 check (id = 1),
  locked boolean not null default false
);
insert into public.league_meta (id, locked) values (1, false) on conflict (id) do nothing;

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  team text not null check (team in ('A','B','C','D')),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  posisi text not null check (posisi in ('GK','Belakang','Tengah','Depan'))
);

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  home text not null,
  away text not null,
  sh int,
  sa int,
  goals jsonb not null default '[]',
  tanggal date,
  jam text default '',
  lokasi text default ''
);

-- Seed 6 pertandingan awal (boleh dihapus/ditambah dari web)
insert into public.league_matches (home, away)
select * from (values ('A','B'),('C','D'),('A','C'),('B','D'),('A','D'),('B','C')) v(home, away)
where not exists (select 1 from public.league_matches);

-- ============================================================
-- 9. RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.schedules enable row level security;
alter table public.rsvps enable row level security;
alter table public.txs enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;
alter table public.settings enable row level security;
alter table public.league_meta enable row level security;
alter table public.league_members enable row level security;
alter table public.league_matches enable row level security;

-- profiles: semua user login bisa baca (untuk roster/nama); ubah milik sendiri; admin full
drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists p_profiles_update_own on public.profiles;
create policy p_profiles_update_own on public.profiles for update to authenticated using (id = auth.uid());
drop policy if exists p_profiles_admin on public.profiles;
create policy p_profiles_admin on public.profiles for all to authenticated using (public.is_admin());

-- wallets: baca milik sendiri (+admin); ubah HANYA via RPC / admin
drop policy if exists p_wallets_select on public.wallets;
create policy p_wallets_select on public.wallets for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists p_wallets_admin on public.wallets;
create policy p_wallets_admin on public.wallets for all to authenticated using (public.is_admin());

-- schedules: baca semua login; tulis admin
drop policy if exists p_sch_select on public.schedules;
create policy p_sch_select on public.schedules for select to authenticated using (true);
drop policy if exists p_sch_admin on public.schedules;
create policy p_sch_admin on public.schedules for all to authenticated using (public.is_admin());

-- rsvps: baca semua login (roster); insert sendiri; update/cancel sendiri; admin full
drop policy if exists p_rsvp_select on public.rsvps;
create policy p_rsvp_select on public.rsvps for select to authenticated using (true);
drop policy if exists p_rsvp_insert on public.rsvps;
create policy p_rsvp_insert on public.rsvps for insert to authenticated with check (user_id = auth.uid());
drop policy if exists p_rsvp_update_own on public.rsvps;
create policy p_rsvp_update_own on public.rsvps for update to authenticated using (user_id = auth.uid());
drop policy if exists p_rsvp_admin on public.rsvps;
create policy p_rsvp_admin on public.rsvps for all to authenticated using (public.is_admin());

-- txs: baca milik sendiri (+admin); klaim insert sendiri; admin full
drop policy if exists p_tx_select on public.txs;
create policy p_tx_select on public.txs for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists p_tx_insert on public.txs;
create policy p_tx_insert on public.txs for insert to authenticated with check (user_id = auth.uid());
drop policy if exists p_tx_admin on public.txs;
create policy p_tx_admin on public.txs for all to authenticated using (public.is_admin());

-- keuangan & liga: baca semua login; tulis admin
drop policy if exists p_exp_select on public.expenses;
create policy p_exp_select on public.expenses for select to authenticated using (true);
drop policy if exists p_exp_admin on public.expenses;
create policy p_exp_admin on public.expenses for all to authenticated using (public.is_admin());

drop policy if exists p_inc_select on public.incomes;
create policy p_inc_select on public.incomes for select to authenticated using (true);
drop policy if exists p_inc_admin on public.incomes;
create policy p_inc_admin on public.incomes for all to authenticated using (public.is_admin());

drop policy if exists p_set_select on public.settings;
create policy p_set_select on public.settings for select to authenticated using (true);
drop policy if exists p_set_admin on public.settings;
create policy p_set_admin on public.settings for all to authenticated using (public.is_admin());

drop policy if exists p_lm_select on public.league_meta;
create policy p_lm_select on public.league_meta for select to authenticated using (true);
drop policy if exists p_lm_admin on public.league_meta;
create policy p_lm_admin on public.league_meta for all to authenticated using (public.is_admin());

drop policy if exists p_lmb_select on public.league_members;
create policy p_lmb_select on public.league_members for select to authenticated using (true);
drop policy if exists p_lmb_insert on public.league_members;
create policy p_lmb_insert on public.league_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists p_lmb_admin on public.league_members;
create policy p_lmb_admin on public.league_members for all to authenticated using (public.is_admin());

drop policy if exists p_lmt_select on public.league_matches;
create policy p_lmt_select on public.league_matches for select to authenticated using (true);
drop policy if exists p_lmt_admin on public.league_matches;
create policy p_lmt_admin on public.league_matches for all to authenticated using (public.is_admin());

-- ============================================================
-- 10. RPC: RSVP deposit atomik (anti race, anti curang)
-- ============================================================
create or replace function public.rpc_rsvp(p_schedule uuid, p_posisi text, p_metode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof record;
  v_sch record;
  v_kuota int;
  v_qpos int;
  v_isi int;
  v_isipos int;
  v_w record;
  v_rid uuid;
  v_pakai_gk boolean := false;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'msg', 'Belum login'); end if;
  select * into v_prof from public.profiles where id = v_uid;
  if v_prof.status <> 'approved' then return jsonb_build_object('ok', false, 'msg', 'Akun belum di-approve admin'); end if;
  select * into v_sch from public.schedules where id = p_schedule;
  if v_sch.status in ('tutup','full_booked') then return jsonb_build_object('ok', false, 'msg', 'Jadwal tutup/full booked'); end if;
  if exists (select 1 from public.rsvps where schedule_id = p_schedule and user_id = v_uid and status <> 'cancelled')
    then return jsonb_build_object('ok', false, 'msg', 'Sudah isi list jadwal ini'); end if;
  if exists (select 1 from public.rsvps where user_id = v_uid and status in ('confirmed_utang','wajib_bayar','confirmed_langsung'))
    then return jsonb_build_object('ok', false, 'msg', 'Masih ada pembayaran belum beres — lunasi dulu'); end if;

  v_kuota := case when v_sch.status = 'sparing' then 14 else coalesce(v_sch.kuota, 28) end;
  select count(*) into v_isi from public.rsvps where schedule_id = p_schedule and status <> 'cancelled';
  if v_isi >= v_kuota then return jsonb_build_object('ok', false, 'msg', 'Kuota penuh'); end if;

  v_qpos := case when v_sch.status = 'sparing'
    then (case p_posisi when 'GK' then 2 when 'Belakang' then 4 when 'Tengah' then 4 else 4 end)
    else (case p_posisi when 'GK' then 4 when 'Belakang' then 8 when 'Tengah' then 8 else 8 end) end;
  select count(*) into v_isipos from public.rsvps
    where schedule_id = p_schedule and posisi = p_posisi and status <> 'cancelled';
  if v_isipos >= v_qpos then return jsonb_build_object('ok', false, 'msg', 'Slot ' || p_posisi || ' penuh'); end if;

  -- Cara ikut hanya 2: potong deposit ATAU bayar cash di tempat.
  -- (Cabang 'utang' lama dipertahankan untuk kompatibilitas data lama,
  --  tapi UI tidak lagi menawarkannya.)
  if p_metode = 'deposit' then
    select * into v_w from public.wallets where user_id = v_uid for update;
    -- GK pakai kredit GK dulu (paket_gk -> reguler_gk), baru kredit normal.
    -- Non-GK HANYA boleh pakai kredit normal (kredit GK terkunci).
    if p_posisi = 'GK' then
      if coalesce(v_w.paket_gk,0) > 0 then
        update public.wallets set paket_gk = paket_gk - 1 where user_id = v_uid; v_pakai_gk := true;
      elsif coalesce(v_w.reguler_gk,0) > 0 then
        update public.wallets set reguler_gk = reguler_gk - 1 where user_id = v_uid; v_pakai_gk := true;
      elsif coalesce(v_w.paket,0) > 0 then
        update public.wallets set paket = paket - 1 where user_id = v_uid;
      elsif coalesce(v_w.reguler,0) > 0 then
        update public.wallets set reguler = reguler - 1 where user_id = v_uid;
      else return jsonb_build_object('ok', false, 'msg', 'Kredit habis'); end if;
    else
      if coalesce(v_w.paket,0) > 0 then update public.wallets set paket = paket - 1 where user_id = v_uid;
      elsif coalesce(v_w.reguler,0) > 0 then update public.wallets set reguler = reguler - 1 where user_id = v_uid;
      else return jsonb_build_object('ok', false, 'msg', 'Kredit habis'); end if;
    end if;
    insert into public.rsvps (schedule_id, user_id, status, posisi, metode, pakai_gk)
      values (p_schedule, v_uid, 'confirmed_lunas', p_posisi, 'deposit', coalesce(v_pakai_gk, false)) returning id into v_rid;
    insert into public.txs (user_id, label, metode, status)
      values (v_uid, 'Main ' || v_sch.tanggal || ' ' || p_posisi || ' (potong 1 kredit)', 'potong_deposit', 'success');
  elsif p_metode = 'utang' then
    insert into public.rsvps (schedule_id, user_id, status, posisi, metode)
      values (p_schedule, v_uid, 'confirmed_utang', p_posisi, 'utang') returning id into v_rid;
    insert into public.txs (user_id, label, rupiah, metode, status)
      values (v_uid, 'Main ' || v_sch.tanggal || ' ' || p_posisi || ' (utang 25K)', 25000, 'utang', 'success');
  else
    insert into public.rsvps (schedule_id, user_id, status, posisi, metode)
      values (p_schedule, v_uid, 'confirmed_langsung', p_posisi, 'langsung') returning id into v_rid;
    insert into public.txs (user_id, label, metode, status)
      values (v_uid, 'Main ' || v_sch.tanggal || ' ' || p_posisi || ' (bayar cash di tempat)', 'langsung', 'success');
  end if;
  return jsonb_build_object('ok', true, 'rsvp_id', v_rid);
end;
$$;

-- RPC: tarik list (batal) + refund jika masih H-2 & deposit
create or replace function public.rpc_cancel(p_schedule uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_r record;
  v_sch record;
  v_kickoff timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'msg', 'Belum login'); end if;
  select * into v_r from public.rsvps
    where schedule_id = p_schedule and user_id = v_uid and status <> 'cancelled';
  if not found then return jsonb_build_object('ok', false, 'msg', 'Tidak ada RSVP aktif'); end if;
  if v_r.status in ('wajib_bayar','no_show') then return jsonb_build_object('ok', false, 'msg', 'Sudah wajib bayar — hubungi admin'); end if;
  select * into v_sch from public.schedules where id = p_schedule;
  v_kickoff := (v_sch.tanggal::text || ' ' || substring(v_sch.jam from '(\d{1,2}:\d{2})'))::timestamptz;
  if now() > v_kickoff - interval '2 days' then return jsonb_build_object('ok', false, 'msg', 'Sudah lewat H-2 — tetap wajib bayar'); end if;
  if v_r.status = 'confirmed_lunas' and v_r.metode = 'deposit' then
    if coalesce(v_r.pakai_gk, false) then
      update public.wallets set reguler_gk = reguler_gk + 1 where user_id = v_uid;
    else
      update public.wallets set reguler = reguler + 1 where user_id = v_uid;
    end if;
  end if;
  update public.rsvps set status = 'cancelled' where id = v_r.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 11. Jadikan admin (JALANKAN SETELAH user auth dibuat!)
-- Ganti email di bawah dengan email admin.
-- ============================================================
-- update public.profiles
-- set role = 'admin', status = 'approved', is_member = true
-- where email = 'ditohendino2121@gmail.com';
