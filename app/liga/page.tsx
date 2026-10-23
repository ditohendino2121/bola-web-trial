"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Loading, LoadError, Crest, Empty } from "../../components/ui";
import { supa } from "../../lib/supa";
import { updateRow } from "../../lib/data";
import { teamNama, walletOf, TEAM_CODES, lewatHariHLiga } from "../../lib/rules";

const POSISI = ["GK", "Belakang", "Tengah", "Depan"] as const;

export default function LigaPage() {
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [edTanggal, setEdTanggal] = useState(""); const [edLabel, setEdLabel] = useState("");
  const [manualUser, setManualUser] = useState(""); const [manualPos, setManualPos] = useState(""); const [manualTeam, setManualTeam] = useState("A");
  const [matchForm, setMatchForm] = useState<Record<string, { home: string; away: string }>>({});

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="liga" /></div>;

  const me = db.users.find((u) => u.id === db.sessionId);
  const isAdmin = me?.role === "admin";
  const isMember = !!me?.is_member;
  const locked = !!db.leagueLocked;
  const teams = db.teams || { A: [], B: [], C: [], D: [] };
  const editions = db.editions || [];

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await reload(); } catch (e: any) { alert(e.message); } setBusy(false); };

  const alreadyInTeam = (userId: string) => TEAM_CODES.some((t) => (teams[t] || []).some((m) => m.userId === userId));

  const assignPemain = () => run(async () => {
    if (!manualUser || !manualPos || !manualTeam) return alert("Lengkapi: pilih pemain, posisi, dan tim.");
    if (alreadyInTeam(manualUser)) return alert("Pemain sudah ada di tim lain, keluarkan dulu.");
    const { error: e } = await supa().from("league_members").insert({ team: manualTeam, user_id: manualUser, posisi: manualPos });
    if (e) throw new Error(e.message);
    setManualUser(""); setManualPos(""); setManualTeam("A");
  });

  // Fix dari versi lama: pindah SEKARANG benar-benar memindahkan (hapus baris asal, buat baris
  // tujuan) dan tidak menyentuh RSVP liga pemain (dulu malah menghapus baris tujuan yang tak ada
  // dan membatalkan RSVP + refund, pemain jadi tidak pindah sama sekali).
  const pindahPemain = (fromTeam: string, toTeam: string, userId: string, posisi: string) => run(async () => {
    if (fromTeam === toTeam) return;
    if ((teams[toTeam] || []).length >= 10) return alert(`${teamNama(toTeam)} sudah penuh (10).`);
    const { error: e1 } = await supa().from("league_members").delete().eq("team", fromTeam).eq("user_id", userId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supa().from("league_members").insert({ team: toTeam, user_id: userId, posisi });
    if (e2) throw new Error(e2.message);
  });

  // Fix dari versi lama: refund kredit GK sekarang kembali ke reguler_gk (dulu selalu ke reguler
  // biasa), dan refund dari beberapa edisi aktif dijumlahkan (dulu saling menimpa). Berhenti kalau
  // ada error di tengah jalan, tidak lanjut diam-diam.
  const keluarkanPemain = (team: string, userId: string) => {
    const nama = db.users.find((u) => u.id === userId)?.nama || userId;
    if (!confirm(`Keluarkan ${nama} dari ${teamNama(team)}? RSVP liga aktifnya akan dibatalkan dan kreditnya dikembalikan.`)) return;
    run(async () => {
      const rsvpLiga = db.rsvps.filter((r) => r.userId === userId && r.status !== "cancelled" && db.schedules.find((s) => s.id === r.scheduleId)?.is_liga);
      let addReguler = 0, addRegulerGk = 0;
      for (const r of rsvpLiga) {
        if (r.status === "confirmed_lunas" && r.metode === "deposit") { if (r.pakaiGk) addRegulerGk++; else addReguler++; }
        const { error: e } = await supa().from("rsvps").update({ status: "cancelled" }).eq("id", r.id);
        if (e) throw new Error(e.message);
      }
      if (addReguler > 0 || addRegulerGk > 0) {
        const w = walletOf(db, userId);
        const { error: e } = await supa().from("wallets").upsert({ user_id: userId, paket: w.paket, reguler: w.reguler + addReguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk + addRegulerGk });
        if (e) throw new Error(e.message);
      }
      const { error: e } = await supa().from("league_members").delete().eq("team", team).eq("user_id", userId);
      if (e) throw new Error(e.message);
    });
  };

  const toggleLock = () => {
    if (!locked && !confirm("Kunci skuad? Setelah dikunci, assign manual tidak bisa lagi (keluarkan/pindah tetap bisa).")) return;
    run(() => updateRow("league_meta", 1, { locked: !locked }, "id"));
  };

  // Admin bebas membuat edisi kapan saja (tanpa batas jumlah) — beda dari spek awal yang
  // membatasi 6 edisi, mengikuti permintaan eksplisit saat redesign.
  const buatEdisi = () => run(async () => {
    if (!edTanggal) return alert("Pilih tanggal edisi dulu.");
    const label = edLabel || `Edisi ${edTanggal}`;
    const { data: ed, error: e1 } = await supa().from("league_editions").insert({ label, tanggal: edTanggal }).select().single();
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supa().from("schedules").insert({ tanggal: edTanggal, jam: "20:00-22:00", lokasi: `Liga ${label}`, kuota: 28, status: "buka", is_liga: true, edition_id: ed.id });
    if (e2) throw new Error(e2.message);
    setEdTanggal(""); setEdLabel("");
  });
  const hapusEdisi = (id: string) => { if (!confirm("Hapus edisi ini beserta semua pertandingannya?")) return; run(async () => { const { error: e } = await supa().from("league_editions").delete().eq("id", id); if (e) throw new Error(e.message); }); };

  // Admin pilih sendiri tim yang tanding per pertandingan (bukan auto 6 laga round-robin) —
  // permintaan eksplisit saat redesign.
  const tambahMatch = (edId: string, tanggal: string) => run(async () => {
    const f = matchForm[edId];
    if (!f?.home || !f?.away) return alert("Pilih tim home dan away.");
    if (f.home === f.away) return alert("Home dan away tidak boleh tim yang sama.");
    const { error: e } = await supa().from("league_matches").insert({ home: f.home, away: f.away, edition_id: edId, tanggal });
    if (e) throw new Error(e.message);
    setMatchForm((p) => ({ ...p, [edId]: { home: "", away: "" } }));
  });
  const hapusMatch = (matchId: string) => { if (!confirm("Hapus pertandingan ini?")) return; run(async () => { const { error: e } = await supa().from("league_matches").delete().eq("id", matchId); if (e) throw new Error(e.message); }); };

  const rsvpEdisi = (scheduleId: string, posisi: string, metode: "deposit" | "langsung") => run(async () => {
    const { data, error: e } = await supa().rpc("rpc_rsvp", { p_schedule: scheduleId, p_posisi: posisi, p_metode: metode });
    if (e) throw new Error(e.message);
    if (!(data as any)?.ok) throw new Error((data as any)?.msg || "Gagal konfirmasi.");
  });
  // Liga boleh batal s.d. H-1 (lihat supabase/migration_liga_v2.sql untuk rpc_cancel).
  const batalEdisi = (rsvpId: string) => run(async () => {
    const { data, error: e } = await supa().rpc("rpc_cancel", { p_schedule: rsvpId });
    if (e) throw new Error(e.message);
    if (!(data as any)?.ok) throw new Error((data as any)?.msg || "Gagal batal.");
  });

  const myPos = (() => { for (const t of TEAM_CODES) { const mem = (teams[t] || []).find((x) => x.userId === me?.id); if (mem) return mem.posisi; } return "Depan"; })();

  return (
    <div>
      <PageHead
        title="Liga"
        desc="KIM x DnA Health League — tim, edisi, dan konfirmasi bayar."
        actions={<>
          {isAdmin && <button className="btn dark" disabled={busy || locked} onClick={toggleLock}>{locked ? "Skuad terkunci" : "Kunci skuad"}</button>}
          <Link href="/klasemen"><button className="btn ghost" style={{ borderColor: "var(--black-line)", color: "var(--on-black)" }}>Lihat klasemen</button></Link>
        </>}
      />
      <div className="page wrap">
        {me && !isMember && <div className="note warn">Liga khusus member. Beli paket Rp90.000 di Top-up untuk jadi member.</div>}

        {isAdmin && !locked && (
          <div className="panel" style={{ borderColor: "var(--gold)" }}>
            <h3>Assign pemain ke tim</h3>
            <p className="muted"><small>Pilih pemain, posisi, dan tim tujuan. Maks 10 orang per tim, komposisi posisi bebas (wewenang admin).</small></p>
            <div className="grid2">
              <select value={manualUser} onChange={(e) => setManualUser(e.target.value)}>
                <option value="">— Pilih pemain —</option>
                {db.users.filter((u) => u.status === "approved" && !alreadyInTeam(u.id)).map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
              </select>
              <select value={manualPos} onChange={(e) => setManualPos(e.target.value)}>
                <option value="">— Pilih posisi —</option>
                {POSISI.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={manualTeam} onChange={(e) => setManualTeam(e.target.value)}>
                {TEAM_CODES.map((t) => <option key={t} value={t}>{teamNama(t)}</option>)}
              </select>
              <button className="btn" disabled={busy} onClick={assignPemain}>Assign ke tim</button>
            </div>
          </div>
        )}

        <div className="grid2">
          {TEAM_CODES.map((t) => {
            const list = teams[t] || [];
            const cnt = (p: string) => list.filter((m) => m.posisi === p).length;
            return (
              <div key={t} className="panel" style={{ borderLeft: `3px solid var(--team-${t.toLowerCase()})` }}>
                <div className="clubcell" style={{ marginBottom: 2 }}><Crest team={t} /> <b>{teamNama(t)}</b> <span className="pill neutral">{list.length}/10</span></div>
                <small className="muted">GK {cnt("GK")} &middot; Bel {cnt("Belakang")} &middot; Teng {cnt("Tengah")} &middot; Depan {cnt("Depan")}</small>
                <div className="people" style={{ marginTop: 8 }}>
                  {list.map((m, i) => {
                    const u = db.users.find((x) => x.id === m.userId);
                    return (
                      <div key={i} className="person" style={{ justifyContent: "space-between" }}>
                        <span><span className="pill neutral">{m.posisi}</span> {u?.nama || m.userId}</span>
                        {isAdmin && <button className="btn danger sm" disabled={busy} onClick={() => keluarkanPemain(t, m.userId)}>Keluarkan</button>}
                      </div>
                    );
                  })}
                  {list.length === 0 && <p className="muted"><small>Belum ada pemain.</small></p>}
                </div>
                {isAdmin && list.length < 10 && (
                  <select style={{ marginTop: 8 }} onChange={(e) => { const v = e.target.value; if (!v) return; const [uid, fromTeam, posisi] = v.split("|"); pindahPemain(fromTeam, t, uid, posisi); e.target.value = ""; }}>
                    <option value="">Pindahkan dari tim lain...</option>
                    {TEAM_CODES.filter((x) => x !== t).flatMap((x) => (teams[x] || []).map((m) => ({ ...m, from: x }))).map((m) => (
                      <option key={m.userId} value={`${m.userId}|${m.from}|${m.posisi}`}>{db.users.find((u) => u.id === m.userId)?.nama} — {m.posisi} (dari {teamNama(m.from)})</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel">
          <div className="panel-h"><div><h3>Edisi liga</h3><p>Jadwal dan pembayaran, 1 edisi = 1 kredit.</p></div></div>
          {isAdmin && (
            <div className="panel" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
              <div className="grid2">
                <label className="field"><span>Tanggal edisi</span><input type="date" value={edTanggal} onChange={(e) => setEdTanggal(e.target.value)} /></label>
                <label className="field"><span>Label</span><input placeholder="cth: Hari 1 — 25 Okt 2026" value={edLabel} onChange={(e) => setEdLabel(e.target.value)} /></label>
              </div>
              <button className="btn" disabled={busy || !edTanggal} onClick={buatEdisi}>Buat edisi dan jadwal</button>
            </div>
          )}
          {editions.length === 0 && <Empty title="Belum ada edisi. Admin buat edisi pertama." />}
          {editions.map((ed) => {
            const s = db.schedules.find((x) => x.is_liga && x.edition_id === ed.id);
            const list = s ? db.rsvps.filter((r) => r.scheduleId === s.id && r.status !== "cancelled") : [];
            const mine = s ? list.find((r) => r.userId === me?.id) : null;
            const isSkuad = TEAM_CODES.some((t) => (teams[t] || []).some((m) => m.userId === me?.id));
            const edMatches = db.matches.filter((m) => m.edition_id === ed.id);
            const sudahHariH = s ? lewatHariHLiga(s) : false;
            return (
              <div key={ed.id} className="panel" style={{ margin: "10px 0" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div><b>{ed.label}</b> <span className="pill info">{ed.tanggal}</span> {s && <span className={`pill ${s.status === "buka" ? "ok" : "bad"}`}>{s.status}</span>}</div>
                  {isAdmin && <button className="btn danger sm" onClick={() => hapusEdisi(ed.id)}>Hapus edisi</button>}
                </div>
                {!s ? <p className="muted"><small>Jadwal bayar belum ada.</small></p> : (
                  <>
                    <p className="muted" style={{ marginTop: 6 }}><small>{list.length}/40 konfirmasi</small></p>
                    {!me ? <p className="muted"><small>Login dulu.</small></p> : !isSkuad ? <div className="note warn">Hanya yang sudah diassign ke tim yang bisa konfirmasi edisi ini.</div> : !mine ? (
                      <div className="row">
                        <button className="btn" disabled={busy} onClick={() => rsvpEdisi(s.id, myPos, "deposit")}>{myPos} — potong 1 kredit</button>
                        <button className="btn ghost" disabled={busy} onClick={() => rsvpEdisi(s.id, myPos, "langsung")}>Bayar cash (Rp{myPos === "GK" ? "15.000" : "25.000"})</button>
                      </div>
                    ) : sudahHariH ? (
                      <span className={`pill ${mine.status === "confirmed_lunas" ? "ok" : "info"}`}>{mine.status === "confirmed_lunas" ? "Lunas" : "Di tempat"} ({mine.posisi})</span>
                    ) : (
                      <div className="row" style={{ alignItems: "center" }}>
                        <span className={`pill ${mine.status === "confirmed_lunas" ? "ok" : "info"}`}>{mine.status === "confirmed_lunas" ? "Lunas" : "Di tempat"} ({mine.posisi})</span>
                        <button className="btn danger sm" disabled={busy} onClick={() => batalEdisi(s.id)}>Batal, s.d. H-1</button>
                      </div>
                    )}
                  </>
                )}

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
                  <h4>Pertandingan</h4>
                  {edMatches.length === 0 && <p className="muted"><small>Belum ada pertandingan.</small></p>}
                  {edMatches.map((m) => (
                    <div key={m.id} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}>
                      <Link href={`/liga/${m.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                        <Crest team={m.home} size="sm" /> {teamNama(m.home)} <span className={m.sh === null ? "scorebox time" : "scorebox"}>{m.sh === null ? "vs" : `${m.sh}-${m.sa}`}</span> {teamNama(m.away)} <Crest team={m.away} size="sm" />
                      </Link>
                      {isAdmin && <button className="btn danger sm" onClick={() => hapusMatch(m.id)}>Hapus</button>}
                    </div>
                  ))}
                  {isAdmin && (
                    <div className="row" style={{ marginTop: 8 }}>
                      <select value={matchForm[ed.id]?.home || ""} onChange={(e) => setMatchForm((p) => ({ ...p, [ed.id]: { home: e.target.value, away: p[ed.id]?.away || "" } }))}>
                        <option value="">Tim home</option>
                        {TEAM_CODES.map((t) => <option key={t} value={t}>{teamNama(t)}</option>)}
                      </select>
                      <select value={matchForm[ed.id]?.away || ""} onChange={(e) => setMatchForm((p) => ({ ...p, [ed.id]: { home: p[ed.id]?.home || "", away: e.target.value } }))}>
                        <option value="">Tim away</option>
                        {TEAM_CODES.map((t) => <option key={t} value={t}>{teamNama(t)}</option>)}
                      </select>
                      <button className="btn ghost sm" disabled={busy} onClick={() => tambahMatch(ed.id, ed.tanggal)}>Tambah pertandingan</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
