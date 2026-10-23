-- MIGRASI LIGA V2 — aditif, aman di-run ulang (CREATE OR REPLACE, tidak ada DROP/DELETE data)
-- 1. Cancel RSVP LIGA boleh s.d. H-1 (bukan H-2). Jadwal reguler mingguan TIDAK berubah (tetap H-2).

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

  if v_sch.is_liga then
    -- Liga: boleh batal sampai H-1, ditutup pas hari-H.
    if now()::date >= v_sch.tanggal::date then
      return jsonb_build_object('ok', false, 'msg', 'Sudah hari-H — tidak bisa batal, tetap wajib bayar');
    end if;
  else
    -- Jadwal reguler: aturan lama tidak berubah, batal maks H-2.
    v_kickoff := (v_sch.tanggal::text || ' ' || substring(v_sch.jam from '(\d{1,2}:\d{2})'))::timestamptz;
    if now() > v_kickoff - interval '2 days' then
      return jsonb_build_object('ok', false, 'msg', 'Sudah lewat H-2 — tetap wajib bayar');
    end if;
  end if;

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

NOTIFY pgrst, 'reload schema';
