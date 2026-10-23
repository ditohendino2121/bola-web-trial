"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { klasemen, topSkor, teamNama } from "../../lib/store";
import { fetchAll } from "../../lib/db";

const medals = ["🥇","🥈","🥉"];

export default function KlasemenPage(){
  const [db,setDb]=useState<any>(null);
  const [err,setErr]=useState("");
  const [selectedEd, setSelectedEd]=useState<string | null>(null);
  useEffect(()=>{ fetchAll().then(setDb).catch((e:any)=>setErr(e.message)); },[]);
  if(err) return <div className="card"><div className="banner err"> {err}</div></div>;
  if(!db) return <div className="card"><p>Memuat...</p></div>;
  const editions:any[] = db.editions || [];
  const matches:any[] = db.matches || [];
  const playerStats:any[] = db.playerStats || [];

  const section = (label:string, ms:any[], hideMatches=false)=>{
    const k = klasemen(ms);
    const psFiltered = playerStats.filter((p:any)=>ms.some((m:any)=>m.id===p.match_id));
    // Roster liga-wide (semua pemain yang sudah diassign ke tim A-D). Dipakai sebagai basis
    // Top Skor & Player Stats biar SEMUA pemain terdaftar tetap tampil, bukan cuma yang sudah punya catatan.
    const roster:any[] = (["A","B","C","D"] as const).flatMap((t)=>(db.teams[t]||[]).map((m:any)=>({ userId:m.userId, team:t, posisi:m.posisi })));
    const matchHasStats = (matchId:string)=> playerStats.some((p:any)=>p.match_id===matchId);
    const golMap:Record<string,number>={};
    roster.forEach((r:any)=>{ golMap[r.userId]=0; });
    ms.forEach((m:any)=>{
      if(matchHasStats(m.id)){
        playerStats.filter((p:any)=>p.match_id===m.id).forEach((ps:any)=>{ golMap[ps.user_id]=(golMap[ps.user_id]||0)+(ps.gol||0); });
      } else {
        // fallback data lama (format liga lama, sebelum ada tabel league_player_stats)
        (m.goals||[]).forEach((g:any)=>{ golMap[g.scorerId]=(golMap[g.scorerId]||0)+1; });
      }
    });
    const rosterIds=new Set(roster.map((r:any)=>r.userId));
    const extraIds=Object.keys(golMap).filter((id)=>!rosterIds.has(id)); // scorer lama yang sudah tidak di roster, tetap ditampilkan
    const timOf=(id:string)=> roster.find((r:any)=>r.userId===id)?.team || Object.entries(db.teams).find(([,arr]:any)=>arr.some((mm:any)=>mm.userId===id))?.[0] || "-";
    const top=[...roster.map((r:any)=>r.userId), ...extraIds].map((id:string)=>{
      const u=db.users.find((x:any)=>x.id===id);
      return { nama:u?.nama||id, tim:timOf(id), gol: golMap[id]||0 };
    }).sort((a:any,b:any)=>b.gol-a.gol);

    const agg:Record<string,any>={};
    roster.forEach((r:any)=>{
      const u=db.users.find((x:any)=>x.id===r.userId);
      agg[r.userId]={ nama:u?.nama||r.userId, team:r.team, posisi:r.posisi, main:0, totalNilai:0, totalGol:0, countNilai:0, terbaik:0 };
    });
    for(const ps of psFiltered){
      const u=db.users.find((x:any)=>x.id===ps.user_id);
      if(!agg[ps.user_id]) agg[ps.user_id]={ nama:u?.nama||ps.user_id, team:ps.team, posisi:ps.posisi, main:0, totalNilai:0, totalGol:0, countNilai:0, terbaik:0 };
      agg[ps.user_id].main+=1;
      agg[ps.user_id].totalGol+=ps.gol||0;
      const final = ps.override ?? ps.nilai_oto;
      if(final!==null && final!==undefined){ agg[ps.user_id].totalNilai+=Number(final); agg[ps.user_id].countNilai+=1; agg[ps.user_id].terbaik=Math.max(agg[ps.user_id].terbaik, Number(final)); }
    }
    const stats=Object.values(agg).map((a:any)=>({ ...a, avg: a.countNilai? Math.round(a.totalNilai/a.countNilai*10)/10 : null })).sort((a:any,b:any)=>(b.avg??-1)-(a.avg??-1));

    const scrollStyle: any = { maxHeight: 320, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 };
    return (
      <div className="card" key={label}>
        <h3> {label}</h3>
        <h4>📊 Klasemen</h4>
        <div className="tblwrap"><table><thead><tr><th>#</th><th>Tim</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Gol</th><th>+/-</th><th>Poin</th></tr></thead><tbody>{k.map((r:any,i:number)=><tr key={r.tim}><td>{i+1}</td><td><b>{teamNama(r.tim)}</b></td><td>{r.M}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td><td>{r.GM}-{r.GA}</td><td>{r.GD>0?`+${r.GD}`:r.GD}</td><td><b>{r.P}</b></td></tr>)}</tbody></table></div>
        <h4 style={{ marginTop:12 }}>👟 Top Skor</h4>
        {top.length===0? <p className="muted">Belum ada pemain diassign.</p> : (
          <div style={scrollStyle}><div className="tblwrap" style={{ border: "none", maxHeight: "none" }}><table><thead><tr><th>#</th><th>Pemain</th><th>Tim</th><th>Gol</th></tr></thead><tbody>{top.map((r:any,i:number)=><tr key={r.nama}><td>{i+1}</td><td><b>{r.nama}</b></td><td>{teamNama(r.tim)}</td><td><b>{r.gol}</b></td></tr>)}</tbody></table></div></div>
        )}
        <h4 style={{ marginTop:12 }}>Player Stats (Avg)</h4>
        {stats.length===0? <p className="muted">Belum ada pemain diassign.</p> : (
          <div style={scrollStyle}><div className="tblwrap" style={{ border: "none", maxHeight: "none" }}><table><thead><tr><th>#</th><th>Pemain</th><th>Pos</th><th>Main</th><th>Gol</th><th>Avg</th><th>Terbaik</th></tr></thead><tbody>{stats.map((s:any,i:number)=><tr key={s.nama}><td>{i+1}</td><td><b>{s.nama}</b> <span className="badge gray">{teamNama(s.team)}</span></td><td>{s.posisi}</td><td>{s.main}</td><td>{s.totalGol}</td><td>{s.avg!==null?<b>{s.avg.toFixed(1)}</b>:<span className="muted">-</span>}</td><td>{s.main>0?s.terbaik.toFixed(1):<span className="muted">-</span>}</td></tr>)}</tbody></table></div></div>
        )}
        {!hideMatches && (
          <div style={{ marginTop:8 }}>
            <h4>Hasil Pertandingan — {label}</h4>
            {ms.length===0 ? <p className="muted">Belum ada laga.</p> : ms.map((m:any)=>(
              <Link key={m.id} href={`/liga/${m.id}`} style={{ textDecoration:"none" }}><div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--line)" }}><span><b>{teamNama(m.home)}</b>vs <b>{teamNama(m.away)}</b> <span className={`badge ${m.sh===null?"gray":"green"}`}>{m.sh===null?"belum":`${m.sh}:${m.sa}`}</span> <small className="muted">{m.tanggal||""}</small></span><span className="badge gold">Detail ➜</span></div></Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ margin:"4px 0" }}>Klasemen KIM x DnA Health League</h2>
      <p className="muted">Pilih edisi untuk filter — Overall untuk gabungan.</p>
      <div className="row" style={{ marginBottom:8 }}>
        <button className={`btn secondary small`} style={{ borderColor: !selectedEd?"var(--gold)":"" }} onClick={()=>setSelectedEd(null)}>Overall</button>
        {editions.map((ed:any)=>(
          <button key={ed.id} className="btn secondary small" style={{ borderColor: selectedEd===ed.id?"var(--gold)":"" }} onClick={()=>setSelectedEd(ed.id)}>{ed.label}</button>
        ))}
      </div>
      <div className="card">
        <h3>👥 Daftar Tim & Pemain</h3>
        <div className="grid2">
          {(["A","B","C","D"] as const).map(t=>(
            <div key={t} className={`card teamcard ${t}`} style={{ margin:0 }}>
              <b>{teamNama(t)}</b> <span className="badge blue">{(db.teams[t]||[]).length}/10</span>
              {(db.teams[t]||[]).map((m:any,i:number)=>{
                const u=db.users.find((x:any)=>x.id===m.userId);
                return <p key={i}><span className="badge gray">{m.posisi}</span> {u?.nama||m.userId}</p>;
              })}
              {(db.teams[t]||[]).length===0 && <p className="muted">Belum ada yang daftar.</p>}
            </div>
          ))}
        </div>
      </div>
      {!selectedEd ? section("Overall", matches, true) : section(`${editions.find((e:any)=>e.id===selectedEd)?.label || ""} • ${editions.find((e:any)=>e.id===selectedEd)?.tanggal || ""}`, matches.filter((m:any)=>m.edition_id===selectedEd))}
      {editions.length===0 && !selectedEd && <div className="card"><p className="muted">Belum ada edisi.</p></div>}
    </div>
  );
}
