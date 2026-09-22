// Data layer Supabase — menggantikan localStorage.
// Semua fungsi async. Bentuk DB sama seperti lib/store agar halaman minim berubah.
import { supa } from "./supabase";
import type { DB } from "./store";

export { supa };

const mapUser = (p: any) => ({
  id: p.id, nama: p.nama, wa: p.wa, email: p.email,
  role: p.role, status: p.status, is_member: !!p.is_member,
  setuju_akad: !!p.setuju_akad, setuju_at: p.setuju_at, akad_version: p.akad_version,
});
const mapSchedule = (s: any) => ({
  id: s.id, tanggal: s.tanggal, jam: s.jam, lokasi: s.lokasi, kuota: s.kuota, status: s.status,
});
const mapRsvp = (r: any) => ({
  id: r.id, scheduleId: r.schedule_id, userId: r.user_id,
  status: r.status, posisi: r.posisi, metode: r.metode, pakaiGk: !!r.pakai_gk, is_alihan: !!r.is_alihan, alih_dari: r.alih_dari,
});
const mapTx = (t: any) => ({
  id: t.id, userId: t.user_id, label: t.label,
  kreditPaket: t.kredit_paket, kreditReguler: t.kredit_reguler, rupiah: t.rupiah,
  metode: t.metode, tanggal: t.tanggal, status: t.status,
  paket: t.paket, bukti: t.bukti, catatan: t.catatan, privateNote: t.private_note, isGk: !!t.is_gk,
});

export async function sessionId(): Promise<string | null> {
  const { data } = await supa().auth.getSession();
  return data.session?.user?.id || null;
}

export async function fetchAll(): Promise<DB> {
  const sb = supa();
  const sid = await sessionId();
  const [users, schedules, rsvps, txs, wallets, members, matches, meta, expenses, incomes, settings] =
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
    ]);
  const err = [users, schedules, rsvps, txs, wallets, members, matches, expenses, incomes].find((r) => r.error);
  if (err?.error) throw new Error("Gagal ambil data: " + err.error.message);

  const wrec: DB["wallets"] = {};
  (wallets.data || []).forEach((w: any) => { wrec[w.user_id] = { paket: w.paket || 0, reguler: w.reguler || 0, paket_gk: w.paket_gk || 0, reguler_gk: w.reguler_gk || 0 }; });
  const teams: DB["teams"] = { A: [], B: [], C: [], D: [] };
  (members.data || []).forEach((m: any) => { (teams[m.team] = teams[m.team] || []).push({ userId: m.user_id, posisi: m.posisi }); });

  return {
    users: (users.data || []).map(mapUser),
    schedules: (schedules.data || []).map(mapSchedule),
    rsvps: (rsvps.data || []).map(mapRsvp),
    txs: (txs.data || []).map(mapTx),
    wallets: wrec,
    teams,
    matches: (matches.data || []).map((m: any) => ({
      id: m.id, home: m.home, away: m.away, sh: m.sh, sa: m.sa,
      goals: m.goals || [], tanggal: m.tanggal || "", jam: m.jam || "", lokasi: m.lokasi || "",
    })),
    leagueLocked: !!meta.data?.locked,
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

// ---------- klaim top-up ----------
export async function alihSlot(rsvpId: string, penggantiId: string) {
  const { data, error } = await supa().rpc("rpc_alih_slot", { p_rsvp_id: rsvpId, p_pengganti: penggantiId });
  if (error) throw new Error(error.message);
  const r = data as any;
  if (!r?.ok) throw new Error(r?.msg || "Gagal alih slot");
}

export async function kirimKlaim(userId: string, paket: "1x" | "4x", metode: string, rupiah: number, bukti: string, catatan: string, isGK = false) {
  const { error } = await supa().from("txs").insert({
    user_id: userId,
    label: `Klaim top-up ${paket}${isGK ? " (harga GK)" : ""} via ${metode} (Rp${rupiah.toLocaleString("id-ID")})`,
    rupiah, metode: `klaim_${metode}`, status: "pending", paket, bukti, catatan, is_gk: isGK,
  });
  if (error) throw new Error(error.message);
}

// ---------- admin helpers (RLS is_admin) ----------
export async function adminUpdate(table: string, id: string | number, patch: any, idCol = "id") {
  const { error } = await supa().from(table).update(patch).eq(idCol, id);
  if (error) throw new Error(error.message);
}
export async function adminInsert(table: string, row: any) {
  const { data, error } = await supa().from(table).insert(row).select().limit(1);
  if (error) throw new Error(error.message);
  return (data || [])[0];
}
export async function adminDelete(table: string, id: string | number, idCol = "id") {
  const { error } = await supa().from(table).delete().eq(idCol, id);
  if (error) throw new Error(error.message);
}
