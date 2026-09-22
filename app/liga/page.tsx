"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { klasemen, topSkor, QUOTA_POSISI } from "../../lib/store";
import { fetchAll, adminInsert, adminUpdate, adminDelete } from "../../lib/db";
import { supa } from "../../lib/supabase";

const medals = ["🥇", "🥈", "🥉"];
const FIXTURES: [string,string][] = [["A","B"],["C","D"],["A","C"],["B","D"],["A","D"],["B","C"]];

export default function Liga() {
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

  // derived
  const editions: any[] = db.editions || [];
  const playerStats: any[] = db.playerStats || [];
  const matches: any[] = db.matches || [];
  // default = Overall (null = gabungan 6 hari), klik tanggal = filter
  const curEdId: string | null = selectedEd;
  const curMatches = curEdId ? matches.filter((m:any)=>m.edition_id===curEdId) : matches;

  // stats helpers
  const kAll = klasemen(matches);
  const kCur = klasemen(curMatches);
  // helpers untuk hitung per kEdisi (dipakai bila ada filter)
  const filterStats = (list:any[]) => curEdId ? list.filter((p:any)=>{
    const m = matches.find((x:any)=>x.id===p.match_id);
    return m?.edition_id===curEdId;
  }) : list;
  // top skor dari playerStats (baru) — bisa overall atau per edisi
  const topFromStatsOverall = (() => {
    const map: Record<string, {nama:string, tim:string, gol:number}> = {};
    for (const ps of playerStats) {
      const u = db.users.find((x:any)=>x.id===ps.user_id);
      const key = ps.user_id;
      if (!map[key]) map[key] = { nama: u?.nama || key, tim: ps.team, gol: 0 };
      map[key].gol += ps.gol || 0;
    }
    if (Object.keys(map).length===0) return topSkor(db);
    return Object.values(map).sort((a,b)=>b.gol-a.gol);
  })();
  const topFromStatsFiltered = (() => {
    const psFiltered = filterStats(playerStats);
    if (psFiltered.length===0) {
      // fallback untuk edisi lama yang masih pakai goals json
      const c: Record<string, number> = {};
      curMatches.forEach((m:any)=>(m.goals||[]).forEach((g:any)=>{ c[g.scorerId]=(c[g.scorerId]||0)+1; }));
      if (Object.keys(c).length===0) return [];
      return Object.entries(c).map(([id,gol]:any)=>{
        const u=db.users.find((x:any)=>x.id===id);
        const tim=Object.entries(db.teams).find(([,arr]:any)=>arr.some((mm:any)=>mm.userId===id))?.[0]||"-";
        return { nama: u?.nama||id, tim, gol };
      }).sort((a:any,b:any)=>b.gol-a.gol);
    }
    const map: Record<string, {nama:string, tim:string, gol:number}> = {};
    for (const ps of psFiltered) {
      const u = db.users.find((x:any)=>x.id===ps.user_id);
      const key = ps.user_id;
      if (!map[key]) map[key] = { nama: u?.nama || key, tim: ps.team, gol: 0 };
      map[key].gol += ps.gol || 0;
    }
    return Object.values(map).sort((a,b)=>b.gol-a.gol);
  })();
  const topFromStats = curEdId ? topFromStatsFiltered : topFromStatsOverall;
  // player stats avg — overall vs per edisi
  const statsAvgOverall = (() => {
    const agg: Record<string, any> = {};
    for (const ps of playerStats) {
      const u = db.users.find((x:any)=>x.id===ps.user_id);
      const key = ps.user_id;
      if (!agg[key]) agg[key] = { nama: u?.nama||key, team: ps.team, posisi: ps.posisi, main:0, totalNilai:0, totalGol:0, countNilai:0, terbaik:0 };
      agg[key].main += 1;
      agg[key].totalGol += ps.gol||0;
      const final = ps.override ?? ps.nilai_oto;
      if (final !== null && final !== undefined) {
        agg[key].totalNilai += Number(final);
        agg[key].countNilai += 1;
        agg[key].terbaik = Math.max(agg[key].terbaik, Number(final));
      }
    }
    return Object.values(agg).map((a:any)=> ({
      ...a,
      avg: a.countNilai ? Math.round((a.totalNilai / a.countNilai)*10)/10 : null,
    })).filter((a:any)=>a.avg!==null).sort((a:any,b:any)=>b.avg-a.avg);
  })();
  const statsAvgFiltered = (() => {
    const psFiltered = filterStats(playerStats);
    const agg: Record<string, any> = {};
    for (const ps of psFiltered) {
      const u = db.users.find((x:any)=>x.id===ps.user_id);
      const key = ps.user_id;
      if (!agg[key]) agg[key] = { nama: u?.nama||key, team: ps.team, posisi: ps.posisi, main:0, totalNilai:0, totalGol:0, countNilai:0, terbaik:0 };
      agg[key].main += 1;
      agg[key].totalGol += ps.gol||0;
      const final = ps.override ?? ps.nilai_oto;
      if (final !== null && final !== undefined) {
        agg[key].totalNilai += Number(final);
        agg[key].countNilai += 1;
        agg[key].terbaik = Math.max(agg[key].terbaik, Number(final));
      }
    }
    return Object.values(agg).map((a:any)=> ({
      ...a,
      avg: a.countNilai ? Math.round((a.totalNilai / a.countNilai)*10)/10 : null,
    })).filter((a:any)=>a.avg!==null).sort((a:any,b:any)=>b.avg-a.avg);
  })();
  const statsAvg = curEdId ? statsAvgFiltered : statsAvgOverall;

  const daftar = () =>
    run(async () => {
      if (!me) return alert("Login dulu ya");
      if (me.status !== "approved") return alert("Akunmu belum di-approve admin");
      if (!isMember) return alert("Liga khusus ⭐ Member (beli paket 90rb dulu di Top-Up) 💪");
      if (locked) return alert("Skuad liga sudah dikunci. Hubungi admin untuk pergantian pemain.");
      const semua: any[] = ([] as any[]).concat(db.teams.A || [], db.teams.B || [], db.teams.C || [], db.teams.D || []);
      if (semua.some((m: any) => m.userId === me.id)) return alert("Kamu sudah terdaftar di sebuah tim. 1 orang 1 tim ya!");
      const arr = db.teams[tim] || [];
      if (arr.filter((m: any) => m.posisi === posisi).length >= (QUOTA_POSISI[posisi] || 99)) return alert(`Slot ${posisi} Tim ${tim} penuh!`);
      if (arr.length >= 7) return alert(`Tim ${tim} sudah penuh (7 orang)`);
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
      // 6 fixture
      for (const [h,a] of FIXTURES) {
        await supa().from("league_matches").insert({ home: h, away: a, edition_id: ed.id, tanggal: edTanggal });
      }
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
    if (!confirm("Keluarkan pemain ini dari tim? (untuk pergantian)")) return;
    run(async () => {
      const { error } = await supa().from("league_members").delete().eq("team", t).eq("user_id", userId);
      if (error) throw new Error(error.message);
    });
  };

  return (
    <div>
      <h2 style={{ margin: "4px 0" }}>🏆 Liga MUBA FC {locked && <span className="badge red">🔒 Skuad dikunci</span>}</h2>
      <p className="muted">Khusus ⭐ Member • 4 tim @7 orang (GK 1, Belakang 2, Tengah 2, Depan 2) • Menang 3, seri 1. 1 edisi = 6 laga (1 tim main 3x).</p>
      {me && !isMember && <div className="banner warn">Liga khusus member. <b>Beli paket 90rb di Top-Up</b> untuk jadi member permanen + daftar liga! 💪</div>}

      {!locked && (
        <div className="card">
          <h3>📝 Daftar tim {isMember ? "" : "(khusus member)"}</h3>
          <div className="grid2">
            <select value={tim} onChange={(e) => setTim(e.target.value)}>{["A", "B", "C", "D"].map((t) => <option key={t} value={t}>Tim {t} — {(db.teams[t] || []).length}/7</option>)}</select>
            <select value={posisi} onChange={(e) => setPosisi(e.target.value)}>{Object.keys(QUOTA_POSISI).map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <button className="btn" disabled={busy} onClick={daftar}>Gabung Tim {tim} sebagai {posisi} ➜</button>
        </div>
      )}

      <div className="grid2">
        {(["A", "B", "C", "D"] as const).map((t) => (
          <div className={`card teamcard ${t}`} key={t}>
            <b>Tim {t}</b> <span className="badge blue">{(db.teams[t] || []).length}/7</span>
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
        <h3>🗓️ Edisi Liga (1x sebulan)</h3>
        {isAdmin && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginBottom: 10, background: "#211a08" }}>
            <p className="muted"><small>Admin pick tanggal → 6 laga otomatis (tanpa jam). Pesan notif: jadwal liga sudah ada, silahkan konfirmasi kehadiran & pembayaran (2 tombol seperti biasa).</small></p>
            <div className="grid2">
              <input type="date" value={edTanggal} onChange={(e)=>setEdTanggal(e.target.value)} />
              <input placeholder="Label, cth: Edisi Oktober 2026" value={edLabel} onChange={(e)=>setEdLabel(e.target.value)} />
            </div>
            <button className="btn" disabled={busy||!edTanggal} onClick={buatEdisi}>+ Buat Edisi & 6 Laga Otomatis</button>
          </div>
        )}
        {editions.length===0 && <p className="muted">Belum ada edisi. Admin buat edisi pertama.</p>}
        <div className="row">
          <button className={`btn secondary small`} style={{ borderColor: !curEdId?"var(--gold)":"", background: !curEdId?"var(--gold-soft)":"" }} onClick={()=>setSelectedEd(null)}>🏆 Overall (6 Hari)</button>
          {editions.map((ed:any)=> (
            <button key={ed.id} className={`btn secondary small ${curEdId===ed.id?"":""}`} style={{ borderColor: curEdId===ed.id?"var(--gold)":"" }} onClick={()=>setSelectedEd(ed.id)}>
              {ed.label} • {ed.tanggal}
            </button>
          ))}
        </div>
        {curEdId && isAdmin && <button className="btn danger small" onClick={()=>hapusEdisi(curEdId)}>Hapus Edisi Ini</button>}
      </div>

      <div className="card">
        <h3>📊 Klasemen {curEdId ? `— ${editions.find((e:any)=>e.id===curEdId)?.label || ""}` : "— Overall (6 Hari)"}</h3>
        <div className="tblwrap"><table>
          <thead><tr><th>#</th><th>Tim</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Gol</th><th>+/-</th><th>Poin</th></tr></thead>
          <tbody>{(curEdId?kCur:kAll).map((r: any, i: number) => <tr key={r.tim}><td>{i + 1}</td><td><b>Tim {r.tim}</b></td><td>{r.M}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td><td>{r.GM}-{r.GA}</td><td>{r.GD > 0 ? "+" + r.GD : r.GD}</td><td><b>{r.P}</b></td></tr>)}</tbody>
        </table></div>
        {curEdId && <p className="muted"><small>Overall: </small>{kAll.map(r=>`${r.tim}:${r.P}`).join(" • ")}</p>}
      </div>

      <div className="card">
        <h3>👟 Top Skor {curEdId ? `— ${editions.find((e:any)=>e.id===curEdId)?.label || ""}` : "— Overall (6 Hari)"}</h3>
        {topFromStats.length === 0 && <p className="muted">Belum ada gol.</p>}
        {topFromStats.slice(0,10).map((r: any, i: number) => <p key={i}><span className="medal">{medals[i] || "⚽"}</span> <b>{r.nama}</b> (Tim {r.tim}) — <b>{r.gol} gol</b></p>)}
        <p className="muted"><small>Klik Overall untuk gabungan 6 hari, atau 1 edisi untuk per-tanggal.</small></p>
      </div>

      <div className="card">
        <h3>⭐ Player Stats {curEdId ? `— ${editions.find((e:any)=>e.id===curEdId)?.label || ""}` : "— Overall (6 Hari)"}</h3>
        <p className="muted"><small>Urut tertinggi (rata-rata nilai). Filter posisi: Semua / GK / Belakang / Tengah / Depan — terlihat sama untuk pemain & admin.</small></p>
        <StatsTable stats={statsAvg} />
      </div>

      <div className="card">
        <h3>📅 Pertandingan {curEdId ? `— ${editions.find((e:any)=>e.id===curEdId)?.label || ""}` : "— Overall (semua)"} (klik untuk nilai)</h3>
        {(curEdId?curMatches:matches).map((m: any) => (
          <Link key={m.id} href={`/liga/${m.id}`} style={{ textDecoration: "none" }}>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--line)" }}>
              <span><b>Tim {m.home}</b> vs <b>Tim {m.away}</b> <span className={`badge ${m.sh===null?"gray":"green"}`}>{m.sh===null?"belum main":`${m.sh} : ${m.sa}`}</span>{m.tanggal ? <small className="muted"> • {m.tanggal}</small> : null}</span>
              <span className="badge gold">Detail ➜</span>
            </div>
          </Link>
        ))}
        {(curMatches.length===0) && <p className="muted">Belum ada laga di edisi ini.</p>}
      </div>
    </div>
  );
}

function StatsTable({ stats }: { stats: any[] }) {
  const [filter, setFilter] = useState<string>("Semua");
  const filtered = filter==="Semua" ? stats : stats.filter((s:any)=>s.posisi===filter);
  return (
    <>
      <div className="row">
        {["Semua","GK","Belakang","Tengah","Depan"].map(f=> (
          <button key={f} className={`btn secondary small ${filter===f?"":""}`} onClick={()=>setFilter(f)} style={{ borderColor: filter===f?"var(--gold)":"" }}>{f}</button>
        ))}
      </div>
      <div className="tblwrap"><table>
        <thead><tr><th>#</th><th>Pemain</th><th>Pos</th><th>Main</th><th>Gol</th><th>Avg</th><th>Terbaik</th></tr></thead>
        <tbody>
          {filtered.map((s:any,i:number)=> (
            <tr key={s.nama}><td>{i+1}</td><td><b>{s.nama}</b> <span className="badge gray">{s.team}</span></td><td>{s.posisi}</td><td>{s.main}</td><td>{s.totalGol}</td><td><b>{s.avg.toFixed(1)}</b></td><td>{s.terbaik.toFixed(1)}</td></tr>
          ))}
        </tbody>
      </table></div>
      {filtered.length===0 && <p className="muted">Belum ada penilaian.</p>}
    </>
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
