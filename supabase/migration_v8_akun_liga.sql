-- MIGRASI V8 — super admin, ganti password, atur admin dari web, RSVP khusus liga.
-- Aman di-run ulang (CREATE OR REPLACE / IF EXISTS). Tidak menghapus data.
create extension if not exists pgcrypto with schema extensions;

-- 1. Role baru "superadmin" (bisa ganti password semua akun). Super admin juga dihitung admin.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('superadmin','admin','player'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'));
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin');
$$;

-- 2. Tutup celah: pemain bisa update baris profilnya sendiri, termasuk kolom role/status/is_member
--    (artinya bisa menjadikan diri admin). Kolom itu sekarang hanya boleh diubah admin.
--    Role superadmin hanya boleh diberikan/dicabut oleh superadmin. SQL Editor (auth.uid() null) tetap bebas.
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.role is distinct from old.role or new.status is distinct from old.status or new.is_member is distinct from old.is_member)
     and not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah role, status, atau member';
  end if;
  if new.role is distinct from old.role and (new.role = 'superadmin' or old.role = 'superadmin') and not public.is_superadmin() then
    raise exception 'Hanya super admin yang boleh mengubah role super admin';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- 3. Super admin ganti password akun lain (untuk pemain yang lupa password).
create or replace function public.rpc_set_password(p_user uuid, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_superadmin() then return jsonb_build_object('ok', false, 'msg', 'Hanya super admin yang boleh mengganti password akun lain'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('ok', false, 'msg', 'Password minimal 6 karakter'); end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    where id = p_user;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Akun tidak ditemukan'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.rpc_set_password(uuid, text) from public, anon;
grant execute on function public.rpc_set_password(uuid, text) to authenticated;

-- 4. RSVP khusus liga: tanpa kuota posisi jadwal reguler (dulu Tengah dibatasi 8 padahal liga 12),
--    posisi diambil dari tim liga, hanya pemain yang terdaftar di tim liga.
create or replace function public.rpc_rsvp_liga(p_schedule uuid, p_metode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_sch record;
  v_mem record;
  v_w record;
  v_rid uuid;
  v_pakai_gk boolean := false;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'msg', 'Belum login'); end if;
  select * into v_sch from public.schedules where id = p_schedule;
  if not found or not coalesce(v_sch.is_liga, false) then return jsonb_build_object('ok', false, 'msg', 'Ini bukan jadwal liga'); end if;
  if v_sch.status in ('tutup','full_booked') then return jsonb_build_object('ok', false, 'msg', 'Jadwal liga ini ditutup admin'); end if;
  if now()::date >= v_sch.tanggal::date then return jsonb_build_object('ok', false, 'msg', 'Sudah hari-H, konfirmasi ditutup'); end if;
  select * into v_mem from public.league_members where user_id = v_uid and team is not null limit 1;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Hanya pemain yang terdaftar di tim liga yang bisa konfirmasi'); end if;
  if exists (select 1 from public.rsvps where schedule_id = p_schedule and user_id = v_uid and status <> 'cancelled')
    then return jsonb_build_object('ok', false, 'msg', 'Kamu sudah konfirmasi edisi ini'); end if;
  if exists (select 1 from public.rsvps where user_id = v_uid and status in ('confirmed_utang','wajib_bayar','confirmed_langsung'))
    then return jsonb_build_object('ok', false, 'msg', 'Masih ada pembayaran yang belum beres (termasuk bayar di tempat yang belum dikonfirmasi admin). Lunasi dulu ke admin.'); end if;

  if p_metode = 'deposit' then
    select * into v_w from public.wallets where user_id = v_uid for update;
    if v_mem.posisi = 'GK' then
      if coalesce(v_w.paket_gk,0) > 0 then update public.wallets set paket_gk = paket_gk - 1 where user_id = v_uid; v_pakai_gk := true;
      elsif coalesce(v_w.reguler_gk,0) > 0 then update public.wallets set reguler_gk = reguler_gk - 1 where user_id = v_uid; v_pakai_gk := true;
      elsif coalesce(v_w.paket,0) > 0 then update public.wallets set paket = paket - 1 where user_id = v_uid;
      elsif coalesce(v_w.reguler,0) > 0 then update public.wallets set reguler = reguler - 1 where user_id = v_uid;
      else return jsonb_build_object('ok', false, 'msg', 'Kredit habis, top-up dulu atau pilih bayar cash'); end if;
    else
      if coalesce(v_w.paket,0) > 0 then update public.wallets set paket = paket - 1 where user_id = v_uid;
      elsif coalesce(v_w.reguler,0) > 0 then update public.wallets set reguler = reguler - 1 where user_id = v_uid;
      else return jsonb_build_object('ok', false, 'msg', 'Kredit habis, top-up dulu atau pilih bayar cash'); end if;
    end if;
    insert into public.rsvps (schedule_id, user_id, status, posisi, metode, pakai_gk)
      values (p_schedule, v_uid, 'confirmed_lunas', v_mem.posisi, 'deposit', v_pakai_gk) returning id into v_rid;
    insert into public.txs (user_id, label, metode, status)
      values (v_uid, 'Liga ' || v_sch.tanggal || ' ' || v_mem.posisi || ' (potong 1 kredit)', 'potong_deposit', 'success');
  else
    insert into public.rsvps (schedule_id, user_id, status, posisi, metode)
      values (p_schedule, v_uid, 'confirmed_langsung', v_mem.posisi, 'langsung') returning id into v_rid;
    insert into public.txs (user_id, label, metode, status)
      values (v_uid, 'Liga ' || v_sch.tanggal || ' ' || v_mem.posisi || ' (bayar cash di tempat)', 'langsung', 'success');
  end if;
  return jsonb_build_object('ok', true, 'rsvp_id', v_rid);
end;
$$;
grant execute on function public.rpc_rsvp_liga(uuid, text) to authenticated;

-- 5. RSVP reguler tidak boleh dipakai untuk jadwal liga (supaya kuota reguler tidak berlaku di liga
--    dan non-pemain liga tidak bisa masuk). Isi lain sama persis dengan versi sebelumnya.
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
  if coalesce(v_sch.is_liga, false) then return jsonb_build_object('ok', false, 'msg', 'Jadwal liga: konfirmasi lewat menu Jadwal liga'); end if;
  if v_sch.status in ('tutup','full_booked') then return jsonb_build_object('ok', false, 'msg', 'Jadwal tutup/full booked'); end if;
  if exists (select 1 from public.rsvps where schedule_id = p_schedule and user_id = v_uid and status <> 'cancelled')
    then return jsonb_build_object('ok', false, 'msg', 'Sudah isi list jadwal ini'); end if;
  if exists (select 1 from public.rsvps where user_id = v_uid and status in ('confirmed_utang','wajib_bayar','confirmed_langsung'))
    then return jsonb_build_object('ok', false, 'msg', 'Masih ada pembayaran belum beres — lunasi dulu'); end if;

  v_kuota := case when v_sch.status = 'sparing' then 14 else coalesce(v_sch.kuota, 28) end;
  select count(*) into v_isi from public.rsvps where schedule_id = p_schedule and status <> 'cancelled';
  if v_isi >= v_kuota then return jsonb_build_object('ok', false, 'msg', 'Kuota penuh'); end if;
  if now()::date >= v_sch.tanggal::date then return jsonb_build_object('ok', false, 'msg', 'Sudah lewat H-day — tidak bisa tarik list'); end if;

  v_qpos := case when v_sch.status = 'sparing'
    then (case p_posisi when 'GK' then 2 when 'Belakang' then 4 when 'Tengah' then 4 else 4 end)
    else (case p_posisi when 'GK' then 4 when 'Belakang' then 8 when 'Tengah' then 8 else 8 end) end;
  select count(*) into v_isipos from public.rsvps
    where schedule_id = p_schedule and posisi = p_posisi and status <> 'cancelled';
  if v_isipos >= v_qpos then return jsonb_build_object('ok', false, 'msg', 'Slot ' || p_posisi || ' penuh'); end if;

  if p_metode = 'deposit' then
    select * into v_w from public.wallets where user_id = v_uid for update;
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

NOTIFY pgrst, 'reload schema';

-- 6. JADIKAN SUPER ADMIN — ganti email di bawah, lalu jalankan baris ini (boleh lebih dari 1 akun).
-- update public.profiles set role = 'superadmin', status = 'approved' where email = 'EMAIL_SUPER_ADMIN@gmail.com';
