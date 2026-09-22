-- MIGRASI AKAD — jalankan sekali di SQL Editor (aman, aditif)
alter table public.profiles add column if not exists setuju_akad boolean not null default false;
alter table public.profiles add column if not exists setuju_at timestamptz;
alter table public.profiles add column if not exists akad_version text;
-- refresh cache
NOTIFY pgrst, 'reload schema';
