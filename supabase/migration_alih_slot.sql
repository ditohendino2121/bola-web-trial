-- MIGRASI ALIH SLOT — aman di-run ulang, aditif
-- Tambah kolom audit untuk alihan (opsional, untuk cegah oper berantai dan jejak admin)
alter table public.rsvps add column if not exists is_alihan boolean not null default false;
alter table public.rsvps add column if not exists alih_dari uuid references public.profiles(id);
create index if not exists idx_rsvps_alih on public.rsvps (is_alihan);

-- RPC peer-to-peer: pemain alihkan slotnya ke pengganti (user terdaftar, approved)
create or replace function public.rpc_alih_slot(p_rsvp_id uuid, p_pengganti uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_r record;
  v_pengganti record;
  v_sch record;
  v_exists int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'msg', 'Belum login'); end if;
  select * into v_r from public.rsvps where id = p_rsvp_id;
  if not found then return jsonb_build_object('ok', false, 'msg', 'RSVP tidak ditemukan'); end if;
  -- Hanya admin yang boleh alihkan (pemain hubungi admin)
  if not public.is_admin() then return jsonb_build_object('ok', false, 'msg', 'Hanya admin yang bisa alihkan slot'); end if;
  -- v_r.user_id adalah pemilik asli; admin boleh alihkan milik siapa saja
  if v_r.status = 'cancelled' then return jsonb_build_object('ok', false, 'msg', 'Sudah dibatalkan'); end if;
  if v_r.is_alihan then return jsonb_build_object('ok', false, 'msg', 'Slot hasil alihan tidak bisa dialihkan lagi'); end if;
  if v_r.status in ('wajib_bayar','no_show') then return jsonb_build_object('ok', false, 'msg', 'Wajib bayar / no-show tidak bisa dialihkan'); end if;

  select * into v_pengganti from public.profiles where id = p_pengganti;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Pengganti tidak ditemukan'); end if;
  if v_pengganti.status <> 'approved' then return jsonb_build_object('ok', false, 'msg', 'Pengganti belum approved'); end if;
  if v_pengganti.id = v_r.user_id then return jsonb_build_object('ok', false, 'msg', 'Pengganti sama dengan pemilik'); end if;
  -- pengganti tidak punya tunggakan / langsung belum lunas
  if exists (select 1 from public.rsvps where user_id = p_pengganti and status in ('confirmed_utang','wajib_bayar','confirmed_langsung'))
    then return jsonb_build_object('ok', false, 'msg', 'Pengganti masih ada pembayaran belum beres'); end if;
  -- pengganti belum punya RSVP di jadwal yang sama
  select count(*) into v_exists from public.rsvps where schedule_id = v_r.schedule_id and user_id = p_pengganti and status <> 'cancelled';
  if v_exists > 0 then return jsonb_build_object('ok', false, 'msg', 'Pengganti sudah isi list di jadwal itu'); end if;

  -- posisi harus sama? cek kuota posisi setelah swap (cancel dulu, insert kemudian -> aman karena jumlah sama)
  -- simpan audit tx untuk kedua pihak
  update public.rsvps set status = 'cancelled' where id = v_r.id;

  insert into public.rsvps (schedule_id, user_id, status, posisi, metode, pakai_gk, is_alihan, alih_dari)
  values (v_r.schedule_id, p_pengganti, v_r.status, v_r.posisi, v_r.metode, coalesce(v_r.pakai_gk,false), true, v_uid);

  insert into public.txs (user_id, label, metode, status) values
    (v_r.user_id, 'Alih slot ' || (select tanggal from public.schedules where id = v_r.schedule_id) || ' ' || v_r.posisi || ' → ' || v_pengganti.nama || ' (oleh admin)', 'alih_slot', 'success'),
    (p_pengganti, 'Terima alih slot ' || (select tanggal from public.schedules where id = v_r.schedule_id) || ' ' || v_r.posisi || ' dari ' || (select nama from public.profiles where id = v_r.user_id) || ' (oleh admin)', 'alih_slot', 'success');

  return jsonb_build_object('ok', true);
end;
$$;
NOTIFY pgrst, 'reload schema';
