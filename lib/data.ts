// Lapisan data Supabase. Tidak ada perubahan tabel/kolom/RPC dari versi lama — lihat
// redesign.md bagian 6 untuk kontrak lengkap (baca, auth, RPC, tulis per halaman).
import { supa } from "./supa";

export type Role = "admin" | "player";
export type Status = "pending" | "approved" | "rejected";
export type RsvpStatus = "confirmed_lunas" | "confirmed_utang" | "confirmed_langsung" | "wajib_bayar" | "cancelled" | "no_show";
export type RsvpMetode = "deposit" | "utang" | "langsung";
export type PosisiMain = "GK" | "Belakang" | "Tengah" | "Depan";
export type ScheduleStatus = "buka" | "tutup" | "full_booked" | "sparing";
export type TxStatus = "pending" | "success" | "rejected";

export interface User { id: string; nama: string; wa: string; email: string; role: Role; status: Status; is_member: boolean; setuju_akad?: boolean; setuju_at?: string; akad_version?: string; }
export interface Schedule { id: string; tanggal: string; jam: string; lokasi: string; kuota: number; status: ScheduleStatus; is_liga?: boolean; edition_id?: string | null; liga_match_id?: string | null; }
export interface Rsvp { id: string; scheduleId: string; userId: string; status: RsvpStatus; posisi: PosisiMain; metode: RsvpMetode; pakaiGk?: boolean; is_alihan?: boolean; alih_dari?: string; }
export interface Tx {
  id: string; userId: string; label: string;
  kreditPaket: number; kreditReguler: number; rupiah: number;
  metode: string; tanggal: string; status: TxStatus;
  paket?: "1x" | "4x"; bukti?: string; catatan?: string; privateNote?: string; isGk?: boolean;
}
export interface Wallet { paket: number; reguler: number; paket_gk: number; reguler_gk: number; }
export interface Goal { scorerId: string; }
export interface Match { id: string; home: string; away: string; sh: number | null; sa: number | null; goals: Goal[]; tanggal?: string; jam?: string; lokasi?: string; edition_id?: string | null; penalti_pemenang?: string | null; }
export interface TeamMember { userId: string; posisi: PosisiMain; }
export interface LeagueEdition { id: string; label: string; tanggal: string; created_at: string; }
export interface PlayerStat { id: string; match_id: string; user_id: string; team: string; posisi: string; gol: number; assist: number; aksi_kunci: number; shot_on_target: number; kartu: string; blunder: number; nilai_oto: number | null; override: number | null; catatan_override?: string; kebobolan?: number | null; gol_bunuh_diri?: number; }
export interface Expense { id: string; tanggal: string; jenis: string; keterangan: string; nominal: number; }
export interface ManualIncome { id: string; tanggal: string; sumber: string; keterangan: string; nominal: number; }

export interface DB {
  users: User[];
  schedules: Schedule[];
  rsvps: Rsvp[];
  txs: Tx[];
  wallets: Record<string, Wallet>;
  teams: Record<string, TeamMember[]>;
  pool: TeamMember[]; // belum diassign ke tim (team null)
  matches: Match[];
  leagueLocked: boolean;
  editions: LeagueEdition[];
  playerStats: PlayerStat[];
  expenses: Expense[];
  incomes: ManualIncome[];
  settings: { kasAwal: number; kasAwalTanggal: string };
  sessionId: string | null;
}

const mapUser = (p: any): User => ({
  id: p.id, nama: p.nama, wa: p.wa, email: p.email,
  role: p.role, status: p.status, is_member: !!p.is_member,
  setuju_akad: !!p.setuju_akad, setuju_at: p.setuju_at, akad_version: p.akad_version,
});
const mapSchedule = (s: any): Schedule => ({
  id: s.id, tanggal: s.tanggal, jam: s.jam, lokasi: s.lokasi, kuota: s.kuota, status: s.status,
  is_liga: !!s.is_liga, edition_id: s.edition_id || null, liga_match_id: s.liga_match_id || null,
});
const mapRsvp = (r: any): Rsvp => ({
  id: r.id, scheduleId: r.schedule_id, userId: r.user_id,
  status: r.status, posisi: r.posisi, metode: r.metode, pakaiGk: !!r.pakai_gk, is_alihan: !!r.is_alihan, alih_dari: r.alih_dari,
});
const mapTx = (t: any): Tx => ({
  id: t.id, userId: t.user_id, label: t.label,
  kreditPaket: t.kredit_paket, kreditReguler: t.kredit_reguler, rupiah: t.rupiah,
  metode: t.metode, tanggal: t.tanggal, status: t.status,
  paket: t.paket, bukti: t.bukti, catatan: t.catatan, privateNote: t.private_note, isGk: !!t.is_gk,
});

export const mapMatch = (m: any): Match => ({
  id: m.id, home: m.home, away: m.away, sh: m.sh, sa: m.sa,
  goals: m.goals || [], tanggal: m.tanggal || "", jam: m.jam || "", lokasi: m.lokasi || "", edition_id: m.edition_id || null, penalti_pemenang: m.penalti_pemenang || null,
});
export const mapPlayerStat = (p: any): PlayerStat => ({
  id: p.id, match_id: p.match_id, user_id: p.user_id, team: p.team, posisi: p.posisi, gol: p.gol, assist: p.assist, aksi_kunci: p.aksi_kunci, shot_on_target: p.shot_on_target, kartu: p.kartu, blunder: p.blunder, nilai_oto: p.nilai_oto, override: p.override, catatan_override: p.catatan_override, kebobolan: p.kebobolan ?? null, gol_bunuh_diri: p.gol_bunuh_diri ?? 0,
});

/** Ambil ulang 1 laga + catatan pemainnya saja (ringan), lalu gabungkan ke DB yang sudah dimuat. */
export async function loadMatch(matchId: string): Promise<{ match: Match | null; stats: PlayerStat[] }> {
  const sb = supa();
  const [m, ps] = await Promise.all([
    sb.from("league_matches").select("*").eq("id", matchId).maybeSingle(),
    sb.from("league_player_stats").select("*").eq("match_id", matchId),
  ]);
  if (m.error) throw new Error(m.error.message);
  if (ps.error) throw new Error(ps.error.message);
  return { match: m.data ? mapMatch(m.data) : null, stats: (ps.data || []).map(mapPlayerStat) };
}
export function mergeMatch(db: DB, matchId: string, match: Match | null, stats: PlayerStat[]): DB {
  return {
    ...db,
    matches: match ? db.matches.map((x) => (x.id === matchId ? match : x)) : db.matches,
    playerStats: [...db.playerStats.filter((p) => p.match_id !== matchId), ...stats],
  };
}

export async function sessionId(): Promise<string | null> {
  const { data } = await supa().auth.getSession();
  return data.session?.user?.id || null;
}

export async function loadAll(): Promise<DB> {
  const sb = supa();
  const sid = await sessionId();
  const [users, schedules, rsvps, txs, wallets, members, matches, meta, expenses, incomes, settings, editions, playerStats] =
    await Promise.all([
      sb.from("profiles").select("*").order("created_at", { ascending: true }),
      sb.from("schedules").select("*").order("tanggal", { ascending: true }),
      sb.from("rsvps").select("*"),
      sb.from("txs").select("*").order("tanggal", { ascending: true }),
      sb.from("wallets").select("*"),
      sb.from("league_members").select("*"),
      sb.from("league_matches").select("*"),
      sb.from("league_meta").select("*").limit(1).maybeSingle(),
      sb.from("expenses").select("*").order("tanggal", { ascending: false }),
      sb.from("incomes").select("*").order("tanggal", { ascending: false }),
      sb.from("settings").select("*").limit(1).maybeSingle(),
      sb.from("league_editions").select("*").order("tanggal", { ascending: true }),
      sb.from("league_player_stats").select("*"),
    ]);
  const err = [users, schedules, rsvps, txs, wallets, members, matches, expenses, incomes, editions, playerStats].find((r: any) => r.error);
  if (err?.error) throw new Error("Gagal ambil data: " + (err as any).error.message);

  const wrec: DB["wallets"] = {};
  (wallets.data || []).forEach((w: any) => { wrec[w.user_id] = { paket: w.paket || 0, reguler: w.reguler || 0, paket_gk: w.paket_gk || 0, reguler_gk: w.reguler_gk || 0 }; });
  const teams: DB["teams"] = { A: [], B: [], C: [], D: [] };
  const pool: DB["pool"] = [];
  (members.data || []).forEach((m: any) => {
    if (!m.team) pool.push({ userId: m.user_id, posisi: m.posisi });
    else (teams[m.team] = teams[m.team] || []).push({ userId: m.user_id, posisi: m.posisi });
  });

  return {
    users: (users.data || []).map(mapUser),
    schedules: (schedules.data || []).map(mapSchedule),
    rsvps: (rsvps.data || []).map(mapRsvp),
    txs: (txs.data || []).map(mapTx),
    wallets: wrec,
    teams,
    pool,
    matches: (matches.data || []).map(mapMatch),
    leagueLocked: !!meta.data?.locked,
    editions: (editions.data || []).map((e: any) => ({ id: e.id, label: e.label, tanggal: e.tanggal, created_at: e.created_at })),
    playerStats: (playerStats.data || []).map(mapPlayerStat),
    expenses: expenses.data || [],
    incomes: incomes.data || [],
    settings: settings.data
      ? { kasAwal: settings.data.kas_awal, kasAwalTanggal: settings.data.kas_awal_tanggal }
      : { kasAwal: 0, kasAwalTanggal: new Date().toISOString().slice(0, 10) },
    sessionId: sid,
  };
}

// ---------- auth ----------
export async function signUp(email: string, pass: string, nama: string, wa: string) {
  const sb = supa();
  const dup = await sb.from("profiles").select("id").eq("wa", wa).limit(1);
  if ((dup.data || []).length > 0) throw new Error("No WA sudah terdaftar, pilih Masuk");
  const { error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { nama, wa } },
  });
  if (error) throw new Error(pesanAuth(error.message));
}

export async function setujuAkad(userId: string, version: string) {
  const { error } = await supa().from("profiles").update({ setuju_akad: true, setuju_at: new Date().toISOString(), akad_version: version }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function signIn(email: string, pass: string) {
  const { error } = await supa().auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(pesanAuth(error.message));
}

export async function signOut() { await supa().auth.signOut(); }

function pesanAuth(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "Email/password salah";
  if (/email not confirmed/i.test(msg)) return "Email belum diverifikasi — hubungi admin";
  if (/already registered|already exists/i.test(msg)) return "Email sudah terdaftar, pilih Masuk";
  if (/password/i.test(msg) && /short|length/i.test(msg)) return "Password minimal 6 karakter";
  return msg;
}

// ---------- RSVP (via RPC atomik) ----------
export async function rsvp(scheduleId: string, posisi: string, metode: string): Promise<string> {
  const { data, error } = await supa().rpc("rpc_rsvp", {
    p_schedule: scheduleId, p_posisi: posisi, p_metode: metode,
  });
  if (error) throw new Error(error.message);
  const r = data as any;
  if (!r?.ok) throw new Error(r?.msg || "Gagal RSVP");
  return r.rsvp_id;
}

export async function batalRsvp(scheduleId: string) {
  const { data, error } = await supa().rpc("rpc_cancel", { p_schedule: scheduleId });
  if (error) throw new Error(error.message);
  const r = data as any;
  if (!r?.ok) throw new Error(r?.msg || "Gagal batal");
}

export async function alihSlot(rsvpId: string, penggantiId: string) {
  const { data, error } = await supa().rpc("rpc_alih_slot", { p_rsvp_id: rsvpId, p_pengganti: penggantiId });
  if (error) throw new Error(error.message);
  const r = data as any;
  if (!r?.ok) throw new Error(r?.msg || "Gagal alih slot");
}

// ---------- klaim top-up ----------
export async function klaimTopup(userId: string, paket: "1x" | "4x", metode: string, rupiah: number, bukti: string, catatan: string, isGK = false) {
  const { error } = await supa().from("txs").insert({
    user_id: userId,
    label: `Klaim top-up ${paket}${isGK ? " (harga GK)" : ""} via ${metode} (Rp${rupiah.toLocaleString("id-ID")})`,
    rupiah, metode: `klaim_${metode}`, status: "pending", paket, bukti, catatan, is_gk: isGK,
  });
  if (error) throw new Error(error.message);
}

// ---------- CRUD generik admin (RLS is_admin memvalidasi di server) ----------
export async function updateRow(table: string, id: string | number, patch: any, idCol = "id") {
  const { error } = await supa().from(table).update(patch).eq(idCol, id);
  if (error) throw new Error(error.message);
}
export async function insertRow(table: string, row: any) {
  const { data, error } = await supa().from(table).insert(row).select().limit(1);
  if (error) throw new Error(error.message);
  return (data || [])[0];
}
export async function deleteRow(table: string, id: string | number, idCol = "id") {
  const { error } = await supa().from(table).delete().eq(idCol, id);
  if (error) throw new Error(error.message);
}
