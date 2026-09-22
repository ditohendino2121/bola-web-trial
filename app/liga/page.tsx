"use client";
import { useEffect, useState } from "react";
import { QUOTA_POSISI, dikunciRSVP, lewatH2, teamNama } from "../../lib/store";
import { fetchAll, adminInsert, adminUpdate } from "../../lib/db";
import { supa } from "../../lib/supabase";

const FIXTURES: [string,string][] = [["A","B"],["C","D"],["A","C"],["B","D"],["A","D"],["B","C"]];

export default function LigaRegistrasi() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tim, setTim] = useState("A"); const [posisi, setPosisi] = useState("Depan");
  const [edTanggal, setEdTanggal] = useState(""); const [edLabel, setEdLabel] = useState("");
  const [selectedEd, setSelectedEd] = useState<string | null>(null);
  const reload = () => fetchAll().then(setDb).catch((e: any) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  const isAdmin = me?.role === "admin";
  const isMember = !!me?.is_member;
  const locked: boolean = !!db.leagueLocked;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await reload(); } catch (e: any) { alert(e.message); }
    setBusy(false);
  };
  const editions: any[] = db.editions || [];
  const curEdId: string | null = selectedEd || (editions[0]?.id || null);

  const daftar = () =>
    run(async () => {
      if (!me) return alert("Login dulu ya");
      if (me.status !== "approved") return alert("Akunmu belum di-approve admin");
      if (!isMember) return alert("Liga khusus ⭐ Member (beli paket 90rb dulu di Top-Up) 💪");
      if (locked) return alert("Skuad liga sudah dikunci. Hubungi admin untuk pergantian pemain.");
      const semua: any[] = ([] as any[]).concat(db.teams.A || [], db.teams.B || [], db.teams.C || [], db.teams.D || []);
      if (semua.some((m: any) => m.userId === me.id)) return alert("Kamu sudah terdaftar di sebuah tim. 1 orang 1 tim ya!");
      const arr = db.teams[tim] || [];
      if (arr.filter((m: any) => m.posisi === posisi).length >= (QUOTA_POSISI[posisi] || 99)) return alert(`Slot ${posisi} Tim ${teamNama(tim)} penuh!`);
      if (arr.length >= 7) return alert(`Tim ${teamNama(tim)} sudah penuh (7 orang)`);
      await adminInsert("league_members", { team: tim, user_id: me.id, posisi });
    });

  const tambahManual = async (team: string, userId: string, pos: string) => {
    if (!userId) return;
    await run(async () => {
      const arr = db.teams[team] || [];
      if (arr.some((m:any)=>m.userId===userId)) return alert("Sudah di tim");
      if (arr.length>=7) return alert("Tim penuh");
      if (arr.filter((m:any)=>m.posisi===pos).length >= (QUOTA_POSISI[pos]||99)) return alert("Slot posisi penuh");
      await adminInsert("league_members", { team, user_id: userId, posisi: pos });
    });
  };

  const buatEdisi = () =>
    run(async () => {
      if (!edTanggal) return alert("Pilih tanggal edisi dulu");
      const label = edLabel || `Edisi ${edTanggal}`;
      const { data: ed, error } = await supa().from("league_editions").insert({ label, tanggal: edTanggal }).select().single();
      if (error) throw new Error(error.message);
      for (const [h,a] of FIXTURES) {
        const { error: e2 } = await supa().from("league_matches").insert({ home: h, away: a, edition_id: ed.id, tanggal: edTanggal }).select().single();
        if (e2) throw new Error((e2 as any).message);
      }
      const { error: e3 } = await supa().from("schedules").insert({
        tanggal: edTanggal, jam: "20:00-22:00", lokasi: `Liga ${label}`,
        kuota: 28, status: "buka", is_liga: true, edition_id: ed.id,
      });
      if (e3) throw new Error(e3.message);
      setEdTanggal(""); setEdLabel(""); setSelectedEd(ed.id);
    });

  const hapusEdisi = (id: string) => {
    if (!confirm("Hapus edisi + 6 laganya? (stats ikut hilang)")) return;
    run(async () => { await supa().from("league_editions").delete().eq("id", id); });
  };

  const toggleLock = () => {
    if (!db.leagueLocked && !confirm("Kunci skuad? Setelah dikunci pemain tidak bisa daftar/pindah tim.")) return;
    run(() => adminUpdate("league_meta", 1, { locked: !db.leagueLocked }, "id").then(() => {}));
  };

  const keluarkan = (t: string, userId: string) => {
    const targetNama = db.users.find((u:any)=>u.id===userId)?.nama || userId;
    const lockedNow = !!db.leagueLocked;
    // cari RSVP edisi mendatang yang terkait user ini (untuk refund/gugur)
    const futureRsvps = db.schedules
      .filter((s:any)=> s.is_liga && s.edition_id)
      .filter((s:any)=>{
        const ed = db.editions.find((e:any)=> e.id===s.edition_id);
        if (!ed) return false;
        const isFuture = ed.tanggal >= new Date().toISOString().slice(0,10); // edisi mendatang
        if (!isFuture) return false;
        return db.rsvps.some((r:any)=> r.scheduleId===s.id && r.userId===userId && r.status!=="cancelled");
      })
      .map((s:any)=> db.rsvps.find((r:any)=> r.scheduleId===s.id && r.userId===userId && r.status!=="cancelled"))
      .filter(Boolean) as any[];

    const hasFinancial = futureRsvps.length>0;
    const preview = hasFinancial ? futureRsvps.map((r:any)=>{
      const s = db.schedules.find((x:any)=>x.id===r.scheduleId);
      const ed = db.editions.find((e:any)=>e.id===s?.edition_id);
      const tag = r.status==="confirmed_lunas" ? "lunas 1 kredit" : r.status==="confirmed_langsung" ? "cash di tempat" : r.status==="wajib_bayar" ? "hutang" : r.status;
      return `• ${ed?.label||s?.tanggal} — ${tag}`;
    }).join("\n") : "";

    if (!lockedNow) {
      // sebelum lock: otomatis refund/gugur
      const msg = hasFinancial
        ? `Keluarkan ${targetNama} dari ${teamNama(t)}?\nKredit/hutang edisi mendatang akan otomatis dikembalikan/digugurkan:\n${preview}\nLanjut?`
        : `Keluarkan ${targetNama} dari ${teamNama(t)}?`;
      if (!confirm(msg)) return;
      run(async () => {
        for (const r of futureRsvps) {
          const s = db.schedules.find((x:any)=>x.id===r.scheduleId);
          if (!s) continue;
          if (r.status==="confirmed_lunas" && r.metode==="deposit") {
            const w = db.wallets[userId] || { paket:0, reguler:0, paket_gk:0, reguler_gk:0 };
            const isGk = !!r.pakai_gk;
            const patch = isGk ? { reguler_gk: w.reguler_gk + 1 } : { reguler: w.reguler + 1 };
            // pakai w yang lama, tapi upsert dengan increment
            await supa().from("wallets").upsert({ user_id: userId, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
            await supa().from("rsvps").update({ status: "cancelled" }).eq("id", r.id);
            await supa().from("txs").insert({ user_id: userId, label: `Refund edisi ${s.tanggal} — dikeluarkan sebelum lock`, metode: "refund_edisi", status: "success" });
          } else if (r.status==="wajib_bayar" || r.status==="confirmed_langsung") {
            await supa().from("rsvps").update({ status: "cancelled" }).eq("id", r.id);
            // hutang gugur
            await supa().from("txs").insert({ user_id: userId, label: `Hutang edisi ${s.tanggal} gugur — dikeluarkan sebelum lock`, metode: "void", status: "success" });
          } else {
            await supa().from("rsvps").update({ status: "cancelled" }).eq("id", r.id);
          }
        }
        const { error } = await supa().from("league_members").delete().eq("team", t).eq("user_id", userId);
        if (error) throw new Error(error.message);
      });
      return;
    }

    // setelah lock: tanya Ya/Tidak
    if (!confirm(`Keluarkan ${targetNama} dari ${teamNama(t)}?\nIni punishment ghosting (squad sudah dikunci).`)) return;
    if (hasFinancial) {
      const ask = confirm(`Pemain ini punya pembayaran edisi mendatang:\n${preview}\n\nApakah kredit dikembalikan / hutang dihapus?\nOK = Ya, kembalikan/hapus\nCancel = Tidak, tetap (punishment)`);
      const doRefund = ask;
      run(async () => {
        if (doRefund) {
          for (const r of futureRsvps) {
            const s = db.schedules.find((x:any)=>x.id===r.scheduleId);
            if (!s) continue;
            if (r.status==="confirmed_lunas" && r.metode==="deposit") {
              const w = db.wallets[userId] || { paket:0, reguler:0, paket_gk:0, reguler_gk:0 };
              const isGk = !!r.pakai_gk;
              const patch = isGk ? { reguler_gk: w.reguler_gk + 1 } : { reguler: w.reguler + 1 };
              await supa().from("wallets").upsert({ user_id: userId, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
              await supa().from("rsvps").update({ status: "cancelled" }).eq("id", r.id);
              await supa().from("txs").insert({ user_id: userId, label: `Refund edisi ${s.tanggal} — dikeluarkan (Ya, kembalikan)`, metode: "refund_edisi", status: "success" });
            } else if (r.status==="wajib_bayar") {
              await supa().from("rsvps").update({ status: "cancelled" }).eq("id", r.id);
              await supa().from("txs").insert({ user_id: userId, label: `Hutang edisi ${s.tanggal} dihapus — dikeluarkan (Ya)`, metode: "void", status: "success" });
            } else if (r.status==="confirmed_langsung") {
              await supa().from("rsvps").update({ status: "cancelled" }).eq("id", r.id);
            }
          }
        } else {
          // Tidak: biarkan kredit/hutang tetap, hanya keluarkan dari tim. RSVP mendatang dibiarkan (tetap hutang/lunas) — jadi punishment finansial tetap
        }
        const { error } = await supa().from("league_members").delete().eq("team", t).eq("user_id", userId);
        if (error) throw new Error(error.message);
      });
    } else {
      run(async () => {
        const { error } = await supa().from("league_members").delete().eq("team", t).eq("user_id", userId);
        if (error) throw new Error(error.message);
      });
    }
  };

  const pesertaSudahDaftar = me ? (["A","B","C","D"].some(t=> (db.teams[t]||[]).some((m:any)=>m.userId===me.id))) : false;

  return (
    <div>
      <h2 style={{ margin: "4px 0" }}>📝 Registrasi MUBA League KIM x DnA {locked && <span className="badge red">🔒 Skuad dikunci</span>}</h2>
      <p className="muted">Khusus ⭐ Member • 4 tim @7 orang (GK 1, Belakang 2, Tengah 2, Depan 2). Maks 6 edisi (hari).</p>
      {me && !isMember && <div className="banner warn">Liga khusus member. <b>Beli paket 90rb di Top-Up</b> untuk jadi member permanen + daftar liga! 💪</div>}

      {!pesertaSudahDaftar && !locked && (
        <div className="card">
          <h3>📝 Daftar tim {isMember ? "" : "(khusus member)"}</h3>
          <div className="grid2">
            <select value={tim} onChange={(e) => setTim(e.target.value)}>{["A", "B", "C", "D"].map((t) => <option key={t} value={t}>{teamNama(t)} — {(db.teams[t] || []).length}/7</option>)}</select>
            <select value={posisi} onChange={(e) => setPosisi(e.target.value)}>{Object.keys(QUOTA_POSISI).map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <button className="btn" disabled={busy} onClick={daftar}>Gabung Tim {teamNama(tim)} sebagai {posisi} ➜</button>
        </div>
      )}
      {pesertaSudahDaftar && (
        <div className="card" style={{ background: "#211a08", borderColor: "var(--gold-deep)" }}>
          <h3>✅ Kamu sudah terdaftar</h3>
          <p>Tim: <b>{teamNama(["A","B","C","D"].find(t=> (db.teams[t]||[]).some((m:any)=>m.userId===me.id))||"")}</b> • Posisi: {(Object.values(db.teams).flat() as any[]).find((m:any)=>m.userId===me.id)?.posisi}</p>
          <p className="muted"><small>Scroll ke bawah untuk jadwal & pembayaran edisi. Untuk klasemen, buka menu <b>Klasemen Liga</b>.</small></p>
        </div>
      )}

      <div className="grid2">
        {(["A", "B", "C", "D"] as const).map((t) => (
          <div className={`card teamcard ${t}`} key={t}>
            <b>{teamNama(t)}</b> <span className="badge blue">{(db.teams[t] || []).length}/7</span>
            {(db.teams[t] || []).map((m: any, i: number) => {
              const u = db.users.find((x: any) => x.id === m.userId);
              return <p key={i}><span className="badge gray">{m.posisi}</span> {u?.nama || m.userId} {isAdmin && <button className="btn secondary small" disabled={busy} onClick={() => keluarkan(t, m.userId)}>Keluarkan</button>}</p>;
            })}
            {isAdmin && (db.teams[t]||[]).length <7 && (
              <AdminAddToTeam team={t} db={db} onAdd={tambahManual} />
            )}
            {(db.teams[t] || []).length === 0 && <p className="muted">Belum ada yang daftar.</p>}
          </div>
        ))}
      </div>

      {isAdmin && <div className="card"><button className="btn secondary" disabled={busy} onClick={toggleLock}>{locked ? "🔓 Buka Kunci Skuad" : "🔒 Kunci Skuad 6 Bulan"}</button></div>}

      <div className="card">
        <h3>🗓️ Edisi Liga — Jadwal & Pembayaran (1 edisi = 1 kredit)</h3>
        {isAdmin && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginBottom: 10, background: "#211a08" }}>
            <p className="muted"><small>Admin pick tanggal → 1 jadwal bayar edisi + 6 laga otomatis. Maks 6 edisi.</small></p>
            <div className="grid2">
              <input type="date" value={edTanggal} onChange={(e)=>setEdTanggal(e.target.value)} />
              <input placeholder="Label, cth: Hari 1 — 25 Okt 2026" value={edLabel} onChange={(e)=>setEdLabel(e.target.value)} />
            </div>
            <button className="btn" disabled={busy||!edTanggal || editions.length>=6} onClick={buatEdisi}>+ Buat Edisi & Jadwal</button>
            {editions.length>=6 && <p className="muted"><small>Maks 6 edisi tercapai.</small></p>}
          </div>
        )}
        {editions.length===0 && <p className="muted">Belum ada edisi. Admin buat edisi pertama.</p>}
        {editions.length>0 && (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {editions.map((ed:any)=> {
              const s = db.schedules.find((x:any)=> x.is_liga && x.edition_id===ed.id);
              const list = s ? db.rsvps.filter((r:any)=> r.scheduleId===s.id && r.status!=="cancelled") : [];
              const mine = s ? list.find((r:any)=> r.userId===me?.id) : null;
              const myTeams: string[] = ["A","B","C","D"].filter((t:any)=> (db.teams[t]||[]).some((m:any)=>m.userId===me?.id));
              const isSkuad = myTeams.length>0;
              const myPos = (()=>{ for(const t of myTeams){ const mem=(db.teams[t]||[]).find((x:any)=>x.userId===me?.id); if(mem) return mem.posisi; } return "Depan"; })();
              const ka = s?.kuota || 28;
              return (
                <div key={ed.id} style={{ border:"1px solid var(--line)", borderRadius:12, padding:12, margin:"10px 0", background: "#1e1e22" }}>
                  <b>📅 {ed.label}</b> <span className="badge blue">{ed.tanggal}</span> {s && <span className={`badge ${s.status==="buka"?"green":"red"}`}>{s.status}</span>}
                  {isAdmin && <button className="btn danger small" style={{ marginLeft:8 }} onClick={()=>hapusEdisi(ed.id)}>Hapus</button>}
                  {!s ? <p className="muted"><small>Jadwal bayar belum ada (edisi lama). Hubungi admin.</small></p> : (
                    <>
                      <p className="muted"><small>{list.length}/{ka} konfirmasi • Posisi terkunci posisi skuadmu • 1 edisi = 1 kredit (GK 15rb / lain 25rb)</small></p>
                      {!me ? <p className="muted"><small>Login dulu</small></p> : !isSkuad ? <div className="banner warn">Hanya skuad yang bisa konfirmasi edisi ini.</div> : (
                        !mine ? (
                          <div className="row">
                            <button className="btn" disabled={busy} onClick={async()=>{
                              const { supa } = await import("../../lib/supabase");
                              const { rsvp } = await import("../../lib/db");
                              try{ await rsvp(s.id, myPos, "deposit"); await fetchAll().then((d:any)=>{ (window as any).location.reload(); }); }catch(e:any){ alert(e.message); }
                            }}>✅ {myPos} — Potong 1 Kredit</button>
                            <button className="btn secondary" disabled={busy} onClick={async()=>{
                              const { rsvp } = await import("../../lib/db");
                              try{ await rsvp(s.id, myPos, "langsung"); location.reload(); }catch(e:any){ alert(e.message); }
                            }}>💵 {myPos} — Cash ({myPos==="GK"?"15rb":"25rb"})</button>
                          </div>
                        ) : (
                          <div>
                            <span className={`badge ${mine.status==="confirmed_lunas"?"green":"blue"}`}>{mine.status==="confirmed_lunas"?"✅ Lunas":"💵 Di tempat"} • {mine.posisi}</span>
                            <button className="btn danger small" style={{ marginLeft:8 }} disabled={busy} onClick={async()=>{
                              const { batalRsvp } = await import("../../lib/db");
                              if(!confirm("Batal edisi ini?")) return;
                              try{ await batalRsvp(s.id); location.reload(); }catch(e:any){ alert(e.message);}
                            }}>Batal</button>
                          </div>
                        )
                      )}
                      <p className="muted"><small>Konfirmasi: {list.map((r:any)=> db.users.find((u:any)=>u.id===r.userId)?.nama).join(", ") || "—"}</small></p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="muted"><small>Setelah daftar, jadwal langsung muncul di atas. Klasemen ada di menu <b>Klasemen Liga</b> di bawahnya.</small></p>
      </div>
    </div>
  );
}

function AdminAddToTeam({ team, db, onAdd }: { team:string; db:any; onAdd: any }) {
  const [uid, setUid] = useState("");
  const [pos, setPos] = useState("Depan");
  return (
    <div style={{ marginTop: 6, display:"flex", gap:6 }}>
      <select value={uid} onChange={(e)=>setUid(e.target.value)} style={{ flex:1 }}>
        <option value="">+ tambah manual</option>
        {db.users.filter((u:any)=>u.status==="approved" && !["A","B","C","D"].some(t=> (db.teams[t]||[]).some((m:any)=>m.userId===u.id))).map((u:any)=> (
          <option key={u.id} value={u.id}>{u.nama} ({u.wa})</option>
        ))}
      </select>
      <select value={pos} onChange={(e)=>setPos(e.target.value)}>
        <option>GK</option><option>Belakang</option><option>Tengah</option><option>Depan</option>
      </select>
      <button className="btn small" onClick={()=>{ onAdd(team, uid, pos); setUid(""); }}>+</button>
    </div>
  );
}
