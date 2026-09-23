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
    let top:any[] = [];
    if(psFiltered.length>0){
      const map:Record<string,any>={};
      for(const ps of psFiltered){
        const u=db.users.find((x:any)=>x.id===ps.user_id);
        if(!map[ps.user_id]) map[ps.user_id]={ nama:u?.nama||ps.user_id, tim: ps.team, gol:0 };
        map[ps.user_id].gol+= ps.gol||0;
      }
      top=Object.values(map).sort((a:any,b:any)=>b.gol-a.gol);
    } else {
      const c:Record<string,number>={};
      ms.forEach((m:any)=>(m.goals||[]).forEach((g:any)=>{ c[g.scorerId]=(c[g.scorerId]||0)+1; }));
      top=Object.entries(c).map(([id,gol]:any)=>{
        const u=db.users.find((x:any)=>x.id===id);
        const tim=Object.entries(db.teams).find(([,arr]:any)=>arr.some((mm:any)=>mm.userId===id))?.[0]||"-";
        return { nama:u?.nama||id, tim, gol };
      }).sort((a:any,b:any)=>b.gol-a.gol);
    }
    const agg:Record<string,any>={};
    for(const ps of psFiltered){
      const u=db.users.find((x:any)=>x.id===ps.user_id);
      if(!agg[ps.user_id]) agg[ps.user_id]={ nama:u?.nama||ps.user_id, team:ps.team, posisi:ps.posisi, main:0, totalNilai:0, totalGol:0, countNilai:0, terbaik:0 };
      agg[ps.user_id].main+=1;
      agg[ps.user_id].totalGol+=ps.gol||0;
      const final = ps.override ?? ps.nilai_oto;
      if(final!==null && final!==undefined){ agg[ps.user_id].totalNilai+=Number(final); agg[ps.user_id].countNilai+=1; agg[ps.user_id].terbaik=Math.max(agg[ps.user_id].terbaik, Number(final)); }
    }
    const stats=Object.values(agg).map((a:any)=>({ ...a, avg: a.countNilai? Math.round(a.totalNilai/a.countNilai*10)/10 : null })).filter((a:any)=>a.avg!==null).sort((a:any,b:any)=>b.avg-a.avg);

    const scrollStyle: any = { maxHeight: 320, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 };
    return (
      <div className="card" key={label}>
        <h3> {label}</h3>
        <h4>📊 Klasemen</h4>
        <div className="tblwrap"><table><thead><tr><th>#</th><th>Tim</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Gol</th><th>+/-</th><th>Poin</th></tr></thead><tbody>{k.map((r:any,i:number)=><tr key={r.tim}><td>{i+1}</td><td><b>{teamNama(r.tim)}</b></td><td>{r.M}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td><td>{r.GM}-{r.GA}</td><td>{r.GD>0?`+${r.GD}`:r.GD}</td><td><b>{r.P}</b></td></tr>)}</tbody></table></div>
        <h4 style={{ marginTop:12 }}>👟 Top Skor</h4>
        {top.length===0? <p className="muted">Belum ada gol.</p> : (
          <div style={scrollStyle}><div className="tblwrap" style={{ border: "none", maxHeight: "none" }}><table><thead><tr><th>#</th><th>Pemain</th><th>Tim</th><th>Gol</th></tr></thead><tbody>{top.map((r:any,i:number)=><tr key={r.nama}><td>{i+1}</td><td><b>{r.nama}</b></td><td>{teamNama(r.tim)}</td><td><b>{r.gol}</b></td></tr>)}</tbody></table></div></div>
        )}
        <h4 style={{ marginTop:12 }}>Player Stats (Avg)</h4>
        {stats.length===0? <p className="muted">Belum ada penilaian.</p> : (
          <div style={scrollStyle}><div className="tblwrap" style={{ border: "none", maxHeight: "none" }}><table><thead><tr><th>#</th><th>Pemain</th><th>Pos</th><th>Main</th><th>Gol</th><th>Avg</th><th>Terbaik</th></tr></thead><tbody>{stats.map((s:any,i:number)=><tr key={s.nama}><td>{i+1}</td><td><b>{s.nama}</b> <span className="badge gray">{teamNama(s.team)}</span></td><td>{s.posisi}</td><td>{s.main}</td><td>{s.totalGol}</td><td><b>{s.avg.toFixed(1)}</b></td><td>{s.terbaik.toFixed(1)}</td></tr>)}</tbody></table></div></div>
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
              <b>{teamNama(t)}</b> <span className="badge blue">{(db.teams[t]||[]).length}/7</span>
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
