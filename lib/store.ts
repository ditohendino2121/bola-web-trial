// Helpers + tipe (pure, tanpa storage). Data diambil via lib/db.ts (Supabase).

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
export interface Match { id: string; home: string; away: string; sh: number | null; sa: number | null; goals: Goal[]; tanggal?: string; jam?: string; lokasi?: string; edition_id?: string | null; }
export interface TeamMember { userId: string; posisi: "GK" | "Belakang" | "Tengah" | "Depan"; }
export interface LeagueEdition { id: string; label: string; tanggal: string; created_at: string; }
export interface PlayerStat { id: string; match_id: string; user_id: string; team: string; posisi: string; gol: number; assist: number; aksi_kunci: number; shot_on_target: number; kartu: string; blunder: number; nilai_oto: number | null; override: number | null; catatan_override?: string; }
export interface Expense { id: string; tanggal: string; jenis: string; keterangan: string; nominal: number; }
export interface ManualIncome { id: string; tanggal: string; sumber: string; keterangan: string; nominal: number; }

export interface DB {
  users: User[];
  schedules: Schedule[];
  rsvps: Rsvp[];
  txs: Tx[];
  wallets: Record<string, Wallet>;
  teams: Record<string, TeamMember[]>;
  pool: TeamMember[]; // menunggu dikocok (team null)
  matches: Match[];
  leagueLocked: boolean;
  editions: LeagueEdition[];
  playerStats: PlayerStat[];
  expenses: Expense[];
  incomes: ManualIncome[];
  settings: { kasAwal: number; kasAwalTanggal: string };
  sessionId: string | null;
}

export function walletOf(db: DB, userId: string): Wallet {
  return db.wallets[userId] || { paket: 0, reguler: 0, paket_gk: 0, reguler_gk: 0 };
}
export function totalKredit(w: Wallet) { return (w.paket || 0) + (w.reguler || 0) + (w.paket_gk || 0) + (w.reguler_gk || 0); }
export function kreditGK(w: Wallet) { return (w.paket_gk || 0) + (w.reguler_gk || 0); }

/** Harga main per posisi: GK 15rb, lainnya 25rb. Paket: GK 50rb/4x, pemain 90rb/4x. */
export const HARGA = {
  sekali: { GK: 15000, pemain: 25000 },
  paket4: { GK: 50000, pemain: 90000 },
};
export function hargaSekali(posisi: string) { return posisi === "GK" ? HARGA.sekali.GK : HARGA.sekali.pemain; }
export function rpissa(n: number) { return "Rp" + (n || 0).toLocaleString("id-ID"); }
/** Nominal tunggakan 1 RSVP berdasarkan posisi */
export function nominalTunggakan(r: { posisi?: string }) { return hargaSekali(r.posisi || ""); }
export function totalTunggakanRp(db: DB, userId: string) {
  return tunggakanOf(db, userId).reduce((a, r) => a + nominalTunggakan(r), 0);
}

export function tunggakanOf(db: DB, userId: string) {
  return db.rsvps.filter((r) => r.userId === userId && (r.status === "confirmed_utang" || r.status === "wajib_bayar"));
}
export function hasUtang(db: DB, userId: string) { return tunggakanOf(db, userId).length > 0; }

/** Bayar-di-tempat yang belum dikonfirmasi lunas oleh admin */
export function langsungBelumLunas(db: DB, userId: string) {
  return db.rsvps.filter((r) => r.userId === userId && r.status === "confirmed_langsung");
}
/** Kunci RSVP baru: ada tunggakan ATAU ada bayar-di-tempat belum lunas */
export function dikunciRSVP(db: DB, userId: string) {
  return hasUtang(db, userId) || langsungBelumLunas(db, userId).length > 0;
}
export function uid() { return "u_" + Math.random().toString(36).slice(2, 9); }

export function kickoff(s: Schedule): Date {
  const m = (s.jam || "").match(/(\d{1,2}):(\d{2})/);
  const d = new Date(s.tanggal + "T00:00:00");
  if (m) d.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
  return d;
}
export function batasBatal(s: Schedule): Date {
  const k = kickoff(s); k.setDate(k.getDate() - 2); return k;
}
export function lewatH2(s: Schedule): boolean { return new Date() > batasBatal(s); }
export function fmtBatas(s: Schedule): string {
  const b = batasBatal(s);
  return b.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function klasemen(matches: Match[]) {
  const t: Record<string, { M: number; W: number; D: number; L: number; GM: number; GA: number; P: number }> = {};
  TEAM_CODES.forEach((k) => (t[k] = { M: 0, W: 0, D: 0, L: 0, GM: 0, GA: 0, P: 0 }));
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

export const TEAM_CODES = ["A","B","C","D"] as const;
export const TEAM_DISPLAY: Record<string,string> = {
  A: "Ampicilin FC",
  B: "Gentamycin FC",
  C: "Ibuprofen FC",
  D: "Paracetamol FC",
};
export const TEAM_SHORT: Record<string,string> = { A:"AMC", B:"GEN", C:"IBU", D:"PCM" };
export function teamNama(kode: string) { return TEAM_DISPLAY[kode] || kode; }

export const QUOTA_POSISI: Record<string, number> = { GK: 6, Belakang: 10, Tengah: 12, Depan: 12 };
export const QUOTA_MAIN: Record<PosisiMain, number> = { GK: 4, Belakang: 8, Tengah: 8, Depan: 8 };
export const QUOTA_SPARING: Record<PosisiMain, number> = { GK: 2, Belakang: 4, Tengah: 4, Depan: 4 };
export const POSISI_MAIN: PosisiMain[] = ["GK", "Belakang", "Tengah", "Depan"];

export function isSparing(s: Schedule) { return s.status === "sparing"; }
export function kuotaAktif(s: Schedule) { return isSparing(s) ? 14 : s.kuota || 28; }
export function quotaPosisi(s: Schedule, p: PosisiMain) { return isSparing(s) ? QUOTA_SPARING[p] : QUOTA_MAIN[p]; }

export function countPosisi(db: DB, scheduleId: string, posisi: PosisiMain) {
  return db.rsvps.filter((r) => r.scheduleId === scheduleId && (r as any).posisi === posisi && r.status !== "cancelled").length;
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

/** Arus kas bersih semua bulan SEBELUM monthKey (carry-forward saldo awal) */
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

/** Wallet refund — tarif per kredit */
export const TARIF_KREDIT = { paket: 22500, reguler: 25000, paket_gk: 12500, reguler_gk: 15000 } as const;
export function nominalWallet(w: Wallet) {
  return (w.paket||0)*TARIF_KREDIT.paket + (w.reguler||0)*TARIF_KREDIT.reguler + (w.paket_gk||0)*TARIF_KREDIT.paket_gk + (w.reguler_gk||0)*TARIF_KREDIT.reguler_gk;
}
/** Total kredit bantuan gratis (metode bantuan_privat) yg pernah diberi ke user */
export function totalBantuanGranted(db: DB, userId: string) {
  return db.txs.filter(t=> t.userId===userId && t.metode==="bantuan_privat" && t.status==="success").reduce((a,t)=> a + (t.kreditReguler||0)+(t.kreditPaket||0),0);
}
/** Total kredit yg pernah masuk (top-up klaim approve + manual cash + koreksi minus), TANPA bantuan gratis */
export function totalMasuk(db: DB, userId: string): { p: number; r: number; pgk: number; rgk: number; bantuan: number; total: number; nominal: number; } {
  let p=0, r=0, pgk=0, rgk=0, bantuan=0;
  db.txs.filter(t=> t.userId===userId && t.status==="success").forEach(t=>{
    if (t.metode==="bantuan_privat") { bantuan += (t.kreditReguler||0)+(t.kreditPaket||0); return; }
    if (t.metode==="koreksi_minus") {
      const m = (t.label||"").match(/kredit\s+(paket_gk|reguler_gk|paket|reguler)/i);
      const kind = (m?.[1]||"").toLowerCase();
      if (kind==="paket") p-=1; else if (kind==="reguler") r-=1; else if (kind==="paket_gk") pgk-=1; else if (kind==="reguler_gk") rgk-=1;
      return;
    }
    const kp = t.kreditPaket||0, kr = t.kreditReguler||0;
    if (!kp && !kr) return;
    if (t.isGk) { pgk+=kp; rgk+=kr; } else { p+=kp; r+=kr; }
  });
  p=Math.max(0,p); r=Math.max(0,r); pgk=Math.max(0,pgk); rgk=Math.max(0,rgk);
  const total = p+r+pgk+rgk;
  const nominal = p*TARIF_KREDIT.paket + r*TARIF_KREDIT.reguler + pgk*TARIF_KREDIT.paket_gk + rgk*TARIF_KREDIT.reguler_gk;
  return { p, r, pgk, rgk, bantuan, total, nominal };
}
/** Sisa refundable setelah mengecualikan bantuan (asumsi konservatif: bantuan di R dulu) */
export function refundableWallet(db: DB, userId: string): { sisa: Wallet; refundable: Wallet; bantuanSisa: number; nominal: number; } {
  const w = walletOf(db, userId);
  const bantuanTotal = totalBantuanGranted(db, userId);
  const bantuanSisa = Math.min(w.reguler||0, bantuanTotal);
  const refundable: Wallet = { paket: w.paket||0, reguler: Math.max(0,(w.reguler||0)-bantuanSisa), paket_gk: w.paket_gk||0, reguler_gk: w.reguler_gk||0 };
  const nominal = nominalWallet(refundable);
  return { sisa: w, refundable, bantuanSisa, nominal };
}
