// Aturan bisnis murni (tanpa I/O): harga, kuota, klasemen, kredit, refund, kas.
// Tidak ada perubahan nilai dari versi lama — hanya dipindah dari lib/store.ts.
import type { DB, Schedule, PosisiMain, Wallet, Match, PlayerStat } from "./data";

/** Admin = role admin atau superadmin. Super admin tambahan: bisa ganti password akun lain. */
export function isAdmin(u?: { role?: string } | null) { return u?.role === "admin" || u?.role === "superadmin"; }
export function isSuperAdmin(u?: { role?: string } | null) { return u?.role === "superadmin"; }

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
export function rupiah(n: number) { return "Rp" + (n || 0).toLocaleString("id-ID"); }
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

export function kickoff(s: Schedule): Date {
  const m = (s.jam || "").match(/(\d{1,2}):(\d{2})/);
  const d = new Date(s.tanggal + "T00:00:00");
  if (m) d.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
  return d;
}
/** Batas tarik list jadwal reguler: H-2 (tidak berubah dari versi lama). */
export function batasBatal(s: Schedule): Date {
  const k = kickoff(s); k.setDate(k.getDate() - 2); return k;
}
export function lewatH2(s: Schedule): boolean { return new Date() > batasBatal(s); }
export function fmtBatas(s: Schedule): string {
  const b = batasBatal(s);
  return b.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
/** Batas tarik list jadwal LIGA: boleh s.d. H-1, ditutup pas hari-H (beda dari jadwal reguler). */
export function lewatHariHLiga(s: Schedule): boolean {
  const todayISO = new Date().toISOString().slice(0, 10);
  return todayISO >= s.tanggal;
}

/** Status laga: belum mulai (belum ada skor), berlangsung (ada skor, belum ditutup admin), selesai. */
export type StatusLaga = "belum" | "live" | "selesai";
export function statusLaga(m: Match): StatusLaga {
  if (m.selesai) return "selesai";
  return m.sh !== null || m.sa !== null ? "live" : "belum";
}

/** Pemenang laga yang SUDAH SELESAI: skor lebih besar, atau pemenang adu penalti kalau imbang. */
export function pemenangLaga(m: Match): { menang: string; kalah: string; penalti: boolean } | null {
  if (!m.selesai || m.sh === null || m.sa === null) return null;
  if (m.sh > m.sa) return { menang: m.home, kalah: m.away, penalti: false };
  if (m.sa > m.sh) return { menang: m.away, kalah: m.home, penalti: false };
  if (m.penalti_pemenang === m.home) return { menang: m.home, kalah: m.away, penalti: true };
  if (m.penalti_pemenang === m.away) return { menang: m.away, kalah: m.home, penalti: true };
  return null; // imbang tapi adu penalti belum diisi
}

/** Poin fair play (makin kecil makin baik): kuning 1, 2x kuning di 1 laga 3, merah langsung 4. */
export const FAIRPLAY_POIN: Record<string, number> = { tidak: 0, kuning: 1, kuning2: 3, merah: 4 };

/**
 * Klasemen ala J-League: menang 3, menang adu penalti 2, kalah adu penalti 1, kalah 0 (tidak ada seri).
 * Urutan: poin, selisih gol, gol dimasukkan (produktivitas), fair play (kartu lebih sedikit di atas).
 */
export function klasemen(matches: Match[], playerStats: PlayerStat[] = []) {
  const t: Record<string, { M: number; W: number; WP: number; LP: number; L: number; GM: number; GA: number; P: number; FP: number }> = {};
  TEAM_CODES.forEach((k) => (t[k] = { M: 0, W: 0, WP: 0, LP: 0, L: 0, GM: 0, GA: 0, P: 0, FP: 0 }));
  matches.forEach((m) => {
    const hasil = pemenangLaga(m);
    if (!hasil) return;
    t[m.home].M++; t[m.away].M++;
    t[m.home].GM += m.sh!; t[m.home].GA += m.sa!;
    t[m.away].GM += m.sa!; t[m.away].GA += m.sh!;
    if (hasil.penalti) { t[hasil.menang].WP++; t[hasil.menang].P += 2; t[hasil.kalah].LP++; t[hasil.kalah].P += 1; }
    else { t[hasil.menang].W++; t[hasil.menang].P += 3; t[hasil.kalah].L++; }
  });
  const ids = new Set(matches.filter((m) => m.selesai).map((m) => m.id));
  playerStats.forEach((ps) => {
    if (!ids.has(ps.match_id) || !t[ps.team]) return;
    t[ps.team].FP += FAIRPLAY_POIN[ps.kartu] || 0;
  });
  return Object.entries(t)
    .map(([tim, s]) => ({ tim, ...s, GD: s.GM - s.GA }))
    .sort((a, b) => b.P - a.P || b.GD - a.GD || b.GM - a.GM || a.FP - b.FP);
}

/** 5 hasil terakhir tiap tim (W/L, adu penalti dihitung sesuai pemenangnya), urut tanggal+jam. */
export function formGuide(matches: Match[], tim: string): ("W" | "D" | "L")[] {
  const ms = matches
    .filter((m) => (m.home === tim || m.away === tim) && pemenangLaga(m))
    .slice()
    .sort((a, b) => `${a.tanggal || ""}${a.jam || ""}`.localeCompare(`${b.tanggal || ""}${b.jam || ""}`));
  return ms.slice(-5).map((m) => (pemenangLaga(m)!.menang === tim ? "W" : "L"));
}

/**
 * Sisa skorsing tiap pemain (jumlah laga tim yang masih harus absen), dihitung dari laga yang sudah berskor:
 * - 2 kartu kuning dari 2 laga berbeda -> skors 1 laga (akumulasi direset setelahnya)
 * - 2 kartu kuning di 1 laga (kuning2) -> skors 1 laga
 * - merah langsung -> skors 2 laga
 * Skorsing berkurang 1 tiap tim pemain itu main, terlepas pemainnya tercatat main atau tidak.
 */
export function hitungSkorsing(matches: Match[], playerStats: PlayerStat[], teams: Record<string, { userId: string }[]>): Record<string, number> {
  const sisa: Record<string, number> = {};
  const akumulasi: Record<string, number> = {};
  for (const team of TEAM_CODES) {
    const squad = new Set((teams[team] || []).map((m) => m.userId));
    const played = matches
      .filter((m) => (m.home === team || m.away === team) && m.selesai)
      .slice()
      .sort((a, b) => `${a.tanggal || ""}${a.jam || ""}`.localeCompare(`${b.tanggal || ""}${b.jam || ""}`));
    for (const m of played) {
      squad.forEach((uid) => { if ((sisa[uid] || 0) > 0) sisa[uid] -= 1; });
      playerStats.filter((p) => p.match_id === m.id && squad.has(p.user_id)).forEach((ps) => {
        const uid = ps.user_id;
        if (ps.kartu === "kuning") {
          akumulasi[uid] = (akumulasi[uid] || 0) + 1;
          if (akumulasi[uid] >= 2) { sisa[uid] = Math.max(sisa[uid] || 0, 1); akumulasi[uid] = 0; }
        } else if (ps.kartu === "kuning2") {
          sisa[uid] = Math.max(sisa[uid] || 0, 1); akumulasi[uid] = 0;
        } else if (ps.kartu === "merah") {
          sisa[uid] = Math.max(sisa[uid] || 0, 2); akumulasi[uid] = 0;
        }
      });
    }
  }
  return sisa;
}

export const TEAM_CODES = ["A", "B", "C", "D"] as const;
export const TEAM_DISPLAY: Record<string, string> = {
  A: "Ampicilin FC",
  B: "Gentamycin FC",
  C: "Ibuprofen FC",
  D: "Paracetamol FC",
};
export const TEAM_SHORT: Record<string, string> = { A: "AMC", B: "GEN", C: "IBU", D: "PCM" };
export const TEAM_COLOR: Record<string, string> = { A: "#D6A230", B: "#0EA5E9", C: "#F59E0B", D: "#7C3AED" };
export const TEAM_INK: Record<string, string> = { A: "#000000", B: "#000000", C: "#000000", D: "#FFFFFF" };
export function teamNama(kode: string) { return TEAM_DISPLAY[kode] || kode; }

// Kuota total pool (6 GK, 10 Belakang, 12 Tengah, 12 Depan = 40). Informasional saja — admin
// bebas menentukan komposisi tiap tim (lihat app/liga), tidak ada penguncian otomatis per posisi.
export const QUOTA_POSISI: Record<string, number> = { GK: 6, Belakang: 10, Tengah: 12, Depan: 12 };
export const QUOTA_MAIN: Record<PosisiMain, number> = { GK: 4, Belakang: 8, Tengah: 8, Depan: 8 };
export const QUOTA_SPARING: Record<PosisiMain, number> = { GK: 2, Belakang: 4, Tengah: 4, Depan: 4 };
export const POSISI_MAIN: PosisiMain[] = ["GK", "Belakang", "Tengah", "Depan"];
const POSISI_ORDER: Record<string, number> = { GK: 0, Belakang: 1, Tengah: 2, Depan: 3 };
/** Urutkan daftar pemain GK -> Belakang -> Tengah -> Depan. Dipakai untuk daftar roster/penilaian,
    BUKAN untuk Top Skor atau Player Stats (itu tetap urut gol/avg). */
export function urutkanPosisi<T extends { posisi: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (POSISI_ORDER[a.posisi] ?? 99) - (POSISI_ORDER[b.posisi] ?? 99));
}

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
  buka: "Buka",
  tutup: "Tutup",
  full_booked: "Full booked",
  sparing: "Sparing (14)",
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
  return (w.paket || 0) * TARIF_KREDIT.paket + (w.reguler || 0) * TARIF_KREDIT.reguler + (w.paket_gk || 0) * TARIF_KREDIT.paket_gk + (w.reguler_gk || 0) * TARIF_KREDIT.reguler_gk;
}
/** Total kredit bantuan gratis (metode bantuan_privat) yg pernah diberi ke user */
export function totalBantuanGranted(db: DB, userId: string) {
  return db.txs.filter((t) => t.userId === userId && t.metode === "bantuan_privat" && t.status === "success").reduce((a, t) => a + (t.kreditReguler || 0) + (t.kreditPaket || 0), 0);
}
/** Total kredit yg pernah masuk (top-up klaim approve + manual cash + koreksi minus), TANPA bantuan gratis */
export function totalMasuk(db: DB, userId: string): { p: number; r: number; pgk: number; rgk: number; bantuan: number; total: number; nominal: number } {
  let p = 0, r = 0, pgk = 0, rgk = 0, bantuan = 0;
  db.txs.filter((t) => t.userId === userId && t.status === "success").forEach((t) => {
    if (t.metode === "bantuan_privat") { bantuan += (t.kreditReguler || 0) + (t.kreditPaket || 0); return; }
    if (t.metode === "koreksi_minus") {
      const m = (t.label || "").match(/kredit\s+(paket_gk|reguler_gk|paket|reguler)/i);
      const kind = (m?.[1] || "").toLowerCase();
      if (kind === "paket") p -= 1; else if (kind === "reguler") r -= 1; else if (kind === "paket_gk") pgk -= 1; else if (kind === "reguler_gk") rgk -= 1;
      return;
    }
    const kp = t.kreditPaket || 0, kr = t.kreditReguler || 0;
    if (!kp && !kr) return;
    if (t.isGk) { pgk += kp; rgk += kr; } else { p += kp; r += kr; }
  });
  p = Math.max(0, p); r = Math.max(0, r); pgk = Math.max(0, pgk); rgk = Math.max(0, rgk);
  const total = p + r + pgk + rgk;
  const nominal = p * TARIF_KREDIT.paket + r * TARIF_KREDIT.reguler + pgk * TARIF_KREDIT.paket_gk + rgk * TARIF_KREDIT.reguler_gk;
  return { p, r, pgk, rgk, bantuan, total, nominal };
}
/** Sisa refundable setelah mengecualikan bantuan (asumsi konservatif: bantuan di R dulu) */
export function refundableWallet(db: DB, userId: string): { sisa: Wallet; refundable: Wallet; bantuanSisa: number; nominal: number } {
  const w = walletOf(db, userId);
  const bantuanTotal = totalBantuanGranted(db, userId);
  const bantuanSisa = Math.min(w.reguler || 0, bantuanTotal);
  const refundable: Wallet = { paket: w.paket || 0, reguler: Math.max(0, (w.reguler || 0) - bantuanSisa), paket_gk: w.paket_gk || 0, reguler_gk: w.reguler_gk || 0 };
  const nominal = nominalWallet(refundable);
  return { sisa: w, refundable, bantuanSisa, nominal };
}
