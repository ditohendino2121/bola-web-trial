"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchAll } from "../../../lib/db";
import { supa } from "../../../lib/supabase";
import { hitungNilaiOto, finalNilai } from "../../../lib/rubrik";

export default function LigaDetail() {
  const params = useParams() as any;
  const matchId = params.matchId as string;
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sh, setSh] = useState(""); const [sa, setSa] = useState("");
  const [rows, setRows] = useState<any[]>([]); // per player editable
  const reload = () => fetchAll().then(setDb).catch((e:any)=>setErr(e.message));
  useEffect(()=>{ reload(); }, []);
  useEffect(()=>{
    if (!db) return;
    const m = db.matches.find((x:any)=>x.id===matchId);
    if (m) { setSh(m.sh!==null?String(m.sh):""); setSa(m.sa!==null?String(m.sa):""); }
    // build rows from teams
    const homeMembers = db.teams[m?.home] || [];
    const awayMembers = db.teams[m?.away] || [];
    const all = [...homeMembers.map((x:any)=>({ ...x, team: m?.home })), ...awayMembers.map((x:any)=>({ ...x, team: m?.away }))];
    const existing: any[] = db.playerStats.filter((p:any)=>p.match_id===matchId);
    const built = all.map((mem:any)=>{
      const ex = existing.find((e:any)=>e.user_id===mem.userId);
      return {
        user_id: mem.userId,
        team: mem.team,
        posisi: mem.posisi,
        nama: db.users.find((u:any)=>u.id===mem.userId)?.nama || mem.userId,
        gol: ex?.gol ?? 0,
        assist: ex?.assist ?? 0,
        aksi_kunci: ex?.aksi_kunci ?? 0,
        shot_on_target: ex?.shot_on_target ?? 0,
        kartu: ex?.kartu ?? "tidak",
        blunder: ex?.blunder ?? 0,
        override: ex?.override ?? null,
        catatan_override: ex?.catatan_override ?? "",
      };
    });
    setRows(built);
  }, [db, matchId]);

  if (err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u:any)=>u.id===db.sessionId);
  const isAdmin = me?.role==="admin";
  const match = db.matches.find((x:any)=>x.id===matchId);
  if (!match) return <div className="card"><p>Match tidak ditemukan</p><Link href="/liga">← Kembali</Link></div>;

  const saveSkor = async () => {
    if (!isAdmin) return alert("Hanya admin");
    setBusy(true);
    try {
      const shNum = sh===""?null:parseInt(sh);
      const saNum = sa===""?null:parseInt(sa);
      const { error } = await supa().from("league_matches").update({ sh: shNum, sa: saNum }).eq("id", matchId);
      if (error) throw new Error(error.message);
      await reload();
      alert("Skor disimpan");
    } catch(e:any){ alert(e.message); }
    setBusy(false);
  };

  const saveNilai = async () => {
    if (!isAdmin) return alert("Hanya admin");
    // validasi total gol = skor
    const totalHomeGol = rows.filter((r:any)=>r.team===match.home).reduce((a:any,c:any)=>a+Number(c.gol||0),0);
    const totalAwayGol = rows.filter((r:any)=>r.team===match.away).reduce((a:any,c:any)=>a+Number(c.gol||0),0);
    if (sh!=="" && totalHomeGol !== Number(sh)) {
      if (!confirm(`Total gol Tim ${match.home} di tabel = ${totalHomeGol} tapi skor = ${sh}. Tetap simpan?`)) return;
    }
    if (sa!=="" && totalAwayGol !== Number(sa)) {
      if (!confirm(`Total gol Tim ${match.away} di tabel = ${totalAwayGol} tapi skor = ${sa}. Tetap simpan?`)) return;
    }
    setBusy(true);
    try {
      for (const r of rows) {
        // hitung nilai oto
        const kebobolan = r.team===match.home ? (sa===""?0:Number(sa)||0) : (sh===""?0:Number(sh)||0);
        const cleanSheet = kebobolan===0 && sh!=="" && sa!=="";
        const { nilai_oto } = hitungNilaiOto({
          posisi: r.posisi, gol: Number(r.gol)||0, assist: Number(r.assist)||0,
          aksi_kunci: Number(r.aksi_kunci)||0, shot_on_target: Number(r.shot_on_target)||0,
          kartu: r.kartu as any, blunder: Number(r.blunder)||0, kebobolan, cleanSheet,
        });
        let ov: number | null = null;
        if (r.override !== "" && r.override !== null && r.override !== undefined) {
          const v = parseFloat(r.override);
          if (!isNaN(v)) ov = v;
        }
        if (ov !== null && !r.catatan_override) {
          throw new Error(`Override untuk ${r.nama} wajib isi catatan`);
        }
        // upsert
        const { error } = await supa().from("league_player_stats").upsert({
          match_id: matchId, user_id: r.user_id, team: r.team, posisi: r.posisi,
          gol: Number(r.gol)||0, assist: Number(r.assist)||0, aksi_kunci: Number(r.aksi_kunci)||0, shot_on_target: Number(r.shot_on_target)||0,
          kartu: r.kartu, blunder: Number(r.blunder)||0, nilai_oto, override: ov, catatan_override: r.catatan_override||"",
        }, { onConflict: "match_id,user_id" });
        if (error) throw new Error(error.message);
      }
      await reload();
      alert("Nilai disimpan");
    } catch(e:any){ alert(e.message); }
    setBusy(false);
  };

  const updateRow = (idx:number, patch:any) => {
    setRows((prev:any)=> prev.map((r:any,i:number)=> i===idx?{...r, ...patch}:r));
  };

  return (
    <div>
      <p><Link href="/liga">← Kembali ke Liga</Link></p>
      <h2 style={{ margin:"4px 0" }}>Tim {match.home} vs Tim {match.away} {match.tanggal?`• ${match.tanggal}`:""}</h2>
      <p className="muted">Halaman ini khusus penilaian. Klik skor lalu tabel pemain.</p>

      <div className="card">
        <h3>📊 Skor</h3>
        <div className="grid2">
          <div><label><small className="muted">Skor {match.home}</small></label><input value={sh} onChange={(e)=>setSh(e.target.value)} placeholder="0" disabled={!isAdmin} /></div>
          <div><label><small className="muted">Skor {match.away}</small></label><input value={sa} onChange={(e)=>setSa(e.target.value)} placeholder="0" disabled={!isAdmin} /></div>
        </div>
        {isAdmin && <button className="btn" disabled={busy} onClick={saveSkor}>Simpan Skor</button>}
      </div>

      <div className="card">
        <h3>⭐ Penilaian Pemain {isAdmin?"(admin)":"(lihat)"}</h3>
        <p className="muted"><small>Base 6.0 + gol/assist/aksi/clean/kebobolan/kartu/blunder → nilai oto. Override ±0.5 wajib catatan.</small></p>
        <div className="tblwrap"><table>
          <thead><tr><th>Pemain</th><th>Pos</th><th>Gol</th><th>Assist</th><th>Aksi*</th><th>SoT</th><th>Kartu</th><th>Blun</th><th>Oto</th><th>Final</th><th>Override</th></tr></thead>
          <tbody>
            {rows.map((r:any, idx:number)=>{
              const kebobolan = r.team===match.home ? (sa===""?0:Number(sa)||0) : (sh===""?0:Number(sh)||0);
              const cleanSheet = kebobolan===0 && sh!=="" && sa!=="";
              const { nilai_oto } = hitungNilaiOto({
                posisi: r.posisi, gol: Number(r.gol)||0, assist: Number(r.assist)||0,
                aksi_kunci: Number(r.aksi_kunci)||0, shot_on_target: Number(r.shot_on_target)||0,
                kartu: r.kartu as any, blunder: Number(r.blunder)||0, kebobolan, cleanSheet,
              });
              const final = finalNilai(nilai_oto, r.override===""?null:r.override);
              return (
                <tr key={r.user_id}>
                  <td><b>{r.nama}</b><br/><small className="muted">{r.team}</small></td>
                  <td>{r.posisi}</td>
                  <td><input style={{ width:60 }} type="number" min={0} value={r.gol} disabled={!isAdmin} onChange={(e)=>updateRow(idx,{gol:e.target.value})} /></td>
                  <td><input style={{ width:60 }} type="number" min={0} value={r.assist} disabled={!isAdmin} onChange={(e)=>updateRow(idx,{assist:e.target.value})} /></td>
                  <td><input style={{ width:60 }} type="number" min={0} value={r.aksi_kunci} disabled={!isAdmin} onChange={(e)=>updateRow(idx,{aksi_kunci:e.target.value})} /></td>
                  <td><input style={{ width:60 }} type="number" min={0} value={r.shot_on_target} disabled={!isAdmin} onChange={(e)=>updateRow(idx,{shot_on_target:e.target.value})} /></td>
                  <td>
                    <select value={r.kartu} disabled={!isAdmin} onChange={(e)=>updateRow(idx,{kartu:e.target.value})}>
                      <option value="tidak">-</option><option value="kuning">Kuning</option><option value="merah">Merah</option>
                    </select>
                  </td>
                  <td><input style={{ width:60 }} type="number" min={0} max={2} value={r.blunder} disabled={!isAdmin} onChange={(e)=>updateRow(idx,{blunder:e.target.value})} /></td>
                  <td><b>{nilai_oto.toFixed(1)}</b></td>
                  <td><b>{final.toFixed(1)}</b></td>
                  <td>
                    {isAdmin ? (
                      <div style={{ display:"flex", gap:4 }}>
                        <input style={{ width:60 }} placeholder="±0.5" value={r.override??""} onChange={(e)=>updateRow(idx,{override:e.target.value})} />
                        <input style={{ width:100 }} placeholder="catatan" value={r.catatan_override} onChange={(e)=>updateRow(idx,{catatan_override:e.target.value})} />
                      </div>
                    ) : (r.override?`${r.override} (${r.catatan_override})`:"-")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <p className="muted"><small>*Aksi kunci: GK=save, Belakang/Tengah=tekel. SoT=shot on target.</small></p>
        {isAdmin && <button className="btn" disabled={busy} onClick={saveNilai}>Simpan Nilai</button>}
      </div>
    </div>
  );
}
