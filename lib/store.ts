// Mock store trial — semua data di localStorage, tanpa backend.
// Aturan final: H-2 batas tarik list, belum bayar = blokir, member permanen via paket 90rb.

export type Role = "admin" | "player";
export type Status = "pending" | "approved" | "rejected";
export type RsvpStatus = "confirmed_lunas" | "confirmed_utang" | "confirmed_langsung" | "wajib_bayar" | "cancelled" | "no_show";
export type RsvpMetode = "deposit" | "utang" | "langsung";
export type PosisiMain = "GK" | "Belakang" | "Tengah" | "Depan";
export type ScheduleStatus = "buka" | "tutup" | "full_booked" | "sparing";
export type TxStatus = "pending" | "success" | "rejected";

export interface User { id: string; nama: string; wa: string; pass: string; role: Role; status: Status; is_member: boolean; }
export interface Schedule { id: string; tanggal: string; jam: string; lokasi: string; kuota: number; status: ScheduleStatus; }
export interface Rsvp { id: string; scheduleId: string; userId: string; status: RsvpStatus; posisi: PosisiMain; metode: RsvpMetode; }
export interface Tx {
  id: string; userId: string; label: string;
  kreditPaket: number; kreditReguler: number; rupiah: number;
  metode: string; tanggal: string; status: TxStatus;
  paket?: "1x" | "4x"; bukti?: string; catatan?: string; privateNote?: string;
}
export interface Wallet { paket: number; reguler: number; }
export interface Goal { scorerId: string; }
export interface Match { id: string; home: string; away: string; sh: number | null; sa: number | null; goals: Goal[]; tanggal?: string; jam?: string; lokasi?: string; }
export interface TeamMember { userId: string; posisi: "GK" | "Belakang" | "Tengah" | "Depan"; }

const KEY = "bola_trial_v1";

interface DB {
  users: User[];
  schedules: Schedule[];
  rsvps: Rsvp[];
  txs: Tx[];
  wallets: Record<string, Wallet>;
  teams: Record<string, TeamMember[]>; // A,B,C,D
  matches: Match[];
  leagueLocked: boolean;
  expenses: import("./club").Expense[];
  incomes: import("./club").ManualIncome[];
  settings: { kasAwal: number; kasAwalTanggal: string };
  sessionId: string | null;
}

function seed(): DB {
  return {
    users: [{ id: "u_admin", nama: "Admin", wa: "0800000000", pass: "admin123", role: "admin", status: "approved", is_member: true }],
    schedules: [
      { id: "s1", tanggal: nextDate(2), jam: "20:00-22:00", lokasi: "Lapangan ABC - Rumput", kuota: 28, status: "buka" },
      { id: "s2", tanggal: nextDate(9), jam: "20:00-22:00", lokasi: "Lapangan ABC - Rumput", kuota: 28, status: "buka" },
      { id: "s3", tanggal: nextDate(16), jam: "20:00-22:00", lokasi: "Lapangan XYZ - Mini Soccer", kuota: 28, status: "buka" },
    ],
    rsvps: [], txs: [], wallets: {},
    teams: { A: [], B: [], C: [], D: [] },
    matches: [
      { id: "m1", home: "A", away: "B", sh: null, sa: null, goals: [] },
      { id: "m2", home: "C", away: "D", sh: null, sa: null, goals: [] },
      { id: "m3", home: "A", away: "C", sh: null, sa: null, goals: [] },
      { id: "m4", home: "B", away: "D", sh: null, sa: null, goals: [] },
      { id: "m5", home: "A", away: "D", sh: null, sa: null, goals: [] },
      { id: "m6", home: "B", away: "C", sh: null, sa: null, goals: [] },
    ],
    leagueLocked: false,
    expenses: [],
    incomes: [],
    settings: { kasAwal: 0, kasAwalTanggal: new Date().toISOString().slice(0, 10) },
    sessionId: null,
  };
}

function nextDate(plusDay: number) {
  const d = new Date(); d.setDate(d.getDate() + plusDay);
  return d.toISOString().slice(0, 10);
}

export function load(): DB {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    const db = JSON.parse(raw) as DB;
    // Migrasi field baru
    db.users.forEach((u: any) => { if (u.is_member === undefined) u.is_member = u.role === "admin"; });
    db.schedules.forEach((s: any) => {
      if (s.kuota !== 28 && !s.kuotaCustom) s.kuota = 28;
      if (!s.status) s.status = "buka";
    });
    db.rsvps.forEach((r: any) => {
      if (!r.posisi) r.posisi = "Depan";
      if (!r.metode) r.metode = r.status === "confirmed_utang" ? "utang" : "deposit";
    });
    db.txs.forEach((t: any) => { if (!t.status) t.status = "success"; });
    if ((db as any).leagueLocked === undefined) (db as any).leagueLocked = false;
    if (!(db as any).expenses) (db as any).expenses = [];
    if (!(db as any).incomes) (db as any).incomes = [];
    if (!(db as any).settings) (db as any).settings = { kasAwal: 0, kasAwalTanggal: new Date().toISOString().slice(0, 10) };
    return db;
  } catch { return seed(); }
}

export function save(db: DB) { localStorage.setItem(KEY, JSON.stringify(db)); }
export function reset() { localStorage.removeItem(KEY); location.reload(); }

export function walletOf(db: DB, userId: string): Wallet {
  return db.wallets[userId] || { paket: 0, reguler: 0 };
}
export function totalKredit(w: Wallet) { return w.paket + w.reguler; }

/** Tunggakan = utang / wajib_bayar yang belum lunas -> kunci RSVP baru */
export function tunggakanOf(db: DB, userId: string) {
  return db.rsvps.filter((r) => r.userId === userId && (r.status === "confirmed_utang" || r.status === "wajib_bayar"));
}
export function hasUtang(db: DB, userId: string) { return tunggakanOf(db, userId).length > 0; }
export function uid() { return "u_" + Math.random().toString(36).slice(2, 9); }

/** Arus kas bersih semua bulan SEBELUM monthKey (untuk carry-forward saldo awal) */
export function netSebelumBulan(db: DB, monthKey: string) {
  let net = 0;
  db.txs.forEach((t) => { if (t.status === "success" && (t.tanggal || "").slice(0, 7) < monthKey) net += t.rupiah || 0; });
  (db.incomes || []).forEach((e: any) => { if ((e.tanggal || "").slice(0, 7) < monthKey) net += e.nominal || 0; });
  (db.expenses || []).forEach((e: any) => { if ((e.tanggal || "").slice(0, 7) < monthKey) net -= e.nominal || 0; });
  return net;
}
export function saldoAwalBulan(db: DB, monthKey: string) {
  return (db.settings?.kasAwal || 0) + netSebelumBulan(db, monthKey);
}

/** Jadwal game -> Date kickoff (parse "20:00-22:00" ambil jam mulai) */
export function kickoff(s: Schedule): Date {
  const m = (s.jam || "").match(/(\d{1,2}):(\d{2})/);
  const d = new Date(s.tanggal + "T00:00:00");
  if (m) d.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
  return d;
}
/** Batas tarik list = kickoff - 2 hari */
export function batasBatal(s: Schedule): Date {
  const k = kickoff(s); k.setDate(k.getDate() - 2); return k;
}
export function lewatH2(s: Schedule): boolean { return new Date() > batasBatal(s); }
export function fmtBatas(s: Schedule): string {
  const b = batasBatal(s);
  return b.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Klasemen: menang 3, seri 1, kalah 0
export function klasemen(matches: Match[]) {
  const t: Record<string, { M: number; W: number; D: number; L: number; GM: number; GA: number; P: number }> = {};
  ["A", "B", "C", "D"].forEach((k) => (t[k] = { M: 0, W: 0, D: 0, L: 0, GM: 0, GA: 0, P: 0 }));
  matches.forEach((m) => {
    if (m.sh === null || m.sa === null) return;
    t[m.home].M++; t[m.away].M++;
    t[m.home].GM += m.sh!; t[m.home].GA += m.sa!;
    t[m.away].GM += m.sa!; t[m.away].GA += m.sh!;
    if (m.sh! > m.sa!) { t[m.home].W++; t[m.home].P += 3; t[m.away].L++; }
    else if (m.sh! < m.sa!) { t[m.away].W++; t[m.away].P += 3; t[m.home].L++; }
    else { t[m.home].D++; t[m.away].D++; t[m.home].P++; t[m.away].P++; }
  });
  return Object.entries(t)
    .map(([tim, s]) => ({ tim, ...s, GD: s.GM - s.GA }))
    .sort((a, b) => b.P - a.P || b.GD - a.GD || b.GM - a.GM);
}

export function topSkor(db: DB) {
  const c: Record<string, number> = {};
  db.matches.forEach((m) => m.goals.forEach((g) => { c[g.scorerId] = (c[g.scorerId] || 0) + 1; }));
  return Object.entries(c)
    .map(([id, gol]) => {
      const u = db.users.find((x) => x.id === id);
      const tim = Object.entries(db.teams).find(([, arr]) => arr.some((m) => m.userId === id))?.[0] || "-";
      return { nama: u?.nama || id, tim, gol };
    })
    .sort((a, b) => b.gol - a.gol);
}

export const QUOTA_POSISI: Record<string, number> = { GK: 1, Belakang: 2, Tengah: 2, Depan: 2 };

// Kuota posisi per 1x game rutin (total 28); mode sparing = separuh (total 14)
export const QUOTA_MAIN: Record<PosisiMain, number> = { GK: 4, Belakang: 8, Tengah: 8, Depan: 8 };
export const QUOTA_SPARING: Record<PosisiMain, number> = { GK: 2, Belakang: 4, Tengah: 4, Depan: 4 };
export const POSISI_MAIN: PosisiMain[] = ["GK", "Belakang", "Tengah", "Depan"];

export function isSparing(s: Schedule) { return s.status === "sparing"; }
export function kuotaAktif(s: Schedule) { return isSparing(s) ? 14 : s.kuota || 28; }
export function quotaPosisi(s: Schedule, p: PosisiMain) { return isSparing(s) ? QUOTA_SPARING[p] : QUOTA_MAIN[p]; }

export function countPosisi(db: DB, scheduleId: string, posisi: PosisiMain) {
  return db.rsvps.filter(
    (r) => r.scheduleId === scheduleId && (r as any).posisi === posisi && r.status !== "cancelled"
  ).length;
}
export function listAktif(db: DB, scheduleId: string) {
  return db.rsvps.filter((r) => r.scheduleId === scheduleId && r.status !== "cancelled");
}

export const STATUS_LABEL: Record<string, string> = {
  buka: "🟢 Buka",
  tutup: "⏸️ Tutup",
  full_booked: "🔴 Full Booked",
  sparing: "🤝 Sparing (14)",
};
