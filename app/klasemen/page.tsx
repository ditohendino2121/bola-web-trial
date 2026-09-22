"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { klasemen, topSkor, teamNama } from "../../lib/store";
import { fetchAll } from "../../lib/db";

const medals = ["🥇","🥈","🥉"];

export default function KlasemenPage(){
  const [db,setDb]=useState<any>(null);
  const [err,setErr]=useState("");
  useEffect(()=>{ fetchAll().then(setDb).catch((e:any)=>setErr(e.message)); },[]);
  if(err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if(!db) return <div className="card"><p>Memuat...</p></div>;
  const editions:any[] = db.editions || [];
  const matches:any[] = db.matches || [];
  const playerStats:any[] = db.playerStats || [];

  const section = (label:string, ms:any[])=>{
    const k = klasemen(ms);
    // top skor untuk ms
    const psFiltered = playerStats.filter((p:any)=> ms.some((m:any)=> m.id===p.match_id));
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
      // fallback lama
      const c:Record<string,number>={};
      ms.forEach((m:any)=>(m.goals||[]).forEach((g:any)=>{ c[g.scorerId]=(c[g.scorerId]||0)+1; }));
      top=Object.entries(c).map(([id,gol]:any)=>{
        const u=db.users.find((x:any)=>x.id===id);
        const tim=Object.entries(db.teams).find(([,arr]:any)=>arr.some((mm:any)=>mm.userId===id))?.[0]||"-";
        return { nama:u?.nama||id, tim, gol };
      }).sort((a:any,b:any)=>b.gol-a.gol);
    }
    // player stats untuk ms
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

    return (
      <div className="card" key={label}>
        <h3>📅 {label}</h3>
        <h4>📊 Klasemen</h4>
        <div className="tblwrap"><table><thead><tr><th>#</th><th>Tim</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Gol</th><th>+/-</th><th>Poin</th></tr></thead><tbody>{k.map((r:any,i:number)=><tr key={r.tim}><td>{i+1}</td><td><b>{teamNama(r.tim)}</b></td><td>{r.M}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td><td>{r.GM}-{r.GA}</td><td>{r.GD>0?`+${r.GD}`:r.GD}</td><td><b>{r.P}</b></td></tr>)}</tbody></table></div>
        <h4 style={{ marginTop:12 }}>👟 Top Skor</h4>
        {top.length===0? <p className="muted">Belum ada gol.</p> : top.slice(0,5).map((r:any,i:number)=><p key={i}><span className="medal">{medals[i]||"⚽"}</span> <b>{r.nama}</b> ({teamNama(r.tim)}) — <b>{r.gol} gol</b></p>)}
        <h4 style={{ marginTop:12 }}>⭐ Player Stats (Avg)</h4>
        {stats.length===0? <p className="muted">Belum ada penilaian.</p> : (
          <div className="tblwrap"><table><thead><tr><th>#</th><th>Pemain</th><th>Pos</th><th>Main</th><th>Gol</th><th>Avg</th><th>Terbaik</th></tr></thead><tbody>{stats.slice(0,10).map((s:any,i:number)=><tr key={s.nama}><td>{i+1}</td><td><b>{s.nama}</b> <span className="badge gray">{teamNama(s.team)}</span></td><td>{s.posisi}</td><td>{s.main}</td><td>{s.totalGol}</td><td><b>{s.avg.toFixed(1)}</b></td><td>{s.terbaik.toFixed(1)}</td></tr>)}</tbody></table></div>
        )}
        <div style={{ marginTop:8 }}>
          {ms.map((m:any)=>(
            <Link key={m.id} href={`/liga/${m.id}`} style={{ textDecoration:"none" }}><div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--line)" }}><span><b>{teamNama(m.home)}</b> vs <b>{teamNama(m.away)}</b> <span className={`badge ${m.sh===null?"gray":"green"}`}>{m.sh===null?"belum":`${m.sh}:${m.sa}`}</span></span><span className="badge gold">Detail ➜</span></div></Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ margin:"4px 0" }}>🏆 Klasemen Liga</h2>
      <p className="muted">Overall + per edisi (maks 6). Panel ini bisa diakses semua pemain, admin bisa edit skor/nilai di halaman detail.</p>
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
      {section("Overall", matches)}
      {editions.map((ed:any)=> section(`${ed.label} • ${ed.tanggal}`, matches.filter((m:any)=>m.edition_id===ed.id)))}
      {editions.length===0 && <div className="card"><p className="muted">Belum ada edisi.</p></div>}
    </div>
  );
}
