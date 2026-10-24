-- MIGRASI LIGA V3 — aditif, aman di-run ulang (CHECK constraint + kolom baru, tidak ada DROP/DELETE data)

-- 1. Kartu: tambah state "kuning2" (2 kartu kuning di 1 pertandingan -> otomatis merah).
--    Nilai lama (tidak/kuning/merah) artinya tidak berubah, hanya menambah pilihan baru.
alter table public.league_player_stats drop constraint if exists league_player_stats_kartu_check;
alter table public.league_player_stats add constraint league_player_stats_kartu_check
  check (kartu in ('tidak','kuning','kuning2','merah'));

-- 2. Adu penalti: simpan tim pemenang shootout saat skor akhir imbang (liga ini tidak mengenal hasil seri).
alter table public.league_matches add column if not exists penalti_pemenang text;
alter table public.league_matches drop constraint if exists league_matches_penalti_check;
alter table public.league_matches add constraint league_matches_penalti_check
  check (penalti_pemenang is null or penalti_pemenang in ('A','B','C','D'));

NOTIFY pgrst, 'reload schema';
