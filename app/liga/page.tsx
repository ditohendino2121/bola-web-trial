"use client";
import { useEffect, useState } from "react";
import { QUOTA_POSISI, teamNama } from "../../lib/store";
import { fetchAll, adminInsert, adminUpdate } from "../../lib/db";
import { supa } from "../../lib/supabase";

const FIXTURES: [string,string][] = [["A","B"],["C","D"],["A","C"],["B","D"],["A","D"],["B","C"]];
const POOL_QUOTA: Record<string,number> = { GK:4, Belakang:8, Tengah:8, Depan:8 };

export default function LigaRegistrasi() {
  const [db,setDb]=useState<any>(null);
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  const [posisi,setPosisi]=useState("Depan");
  const [edTanggal,setEdTanggal]=useState(""); const [edLabel,setEdLabel]=useState("");
  const reload=()=>fetchAll().then(setDb).catch((e:any)=>setErr(e.message));
  useEffect(()=>{reload();},[]);
  if(err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if(!db) return <div className="card"><p>Memuat...</p></div>;
  const me=db.users.find((u:any)=>u.id===db.sessionId);
  const isAdmin=me?.role==="admin";
  const isMember=!!me?.is_member;
  const locked=!!db.leagueLocked;
  const run=async(fn:()=>Promise<void>)=>{ setBusy(true); try{await fn(); await reload();}catch(e:any){alert(e.message);} setBusy(false); };
  const pool:any[] = db.pool||[];
  const teams:any = db.teams||{A:[],B:[],C:[],D:[]};
  const editions:any[] = db.editions||[];
  const canLock = !locked && pool.length===0 && (["A","B","C","D"] as const).every((t:any)=> (teams[t]||[]).length===7);

  // helpers
  const countPool = (pos:string)=> pool.filter((p:any)=>p.posisi===pos).length;
  const sudahDaftar = me ? (pool.some((p:any)=>p.userId===me.id) || ["A","B","C","D"].some(t=> (teams[t]||[]).some((m:any)=>m.userId===me.id))) : false;
  const poolPenuh = POOL_QUOTA.GK===countPool("GK") && POOL_QUOTA.Belakang===countPool("Belakang") && POOL_QUOTA.Tengah===countPool("Tengah") && POOL_QUOTA.Depan===countPool("Depan");
  const timPenuh = (t:string)=> (teams[t]||[]).length>=7;
  const kekurangan = (()=>{
    const need:any={};
    for(const pos of ["GK","Belakang","Tengah","Depan"]){
      const havePool = countPool(pos);
      const haveTeam = ["A","B","C","D"].reduce((a,t)=>a+ (teams[t]||[]).filter((m:any)=>m.posisi===pos).length,0);
      const total = havePool+haveTeam;
      const quota = POOL_QUOTA[pos as keyof typeof POOL_QUOTA];
      if(total<quota) need[pos]=quota-total;
    }
    return need;
  })();

  const daftar = ()=> run(async()=>{
    if(!me) return alert("Login dulu ya");
    if(me.status!=="approved") return alert("Akunmu belum di-approve admin");
    if(!isMember) return alert("Liga khusus ⭐ Member");
    if(locked) return alert("Skuad sudah dikunci");
    if(sudahDaftar) return alert("Kamu sudah terdaftar (pool/tim)");
    if(countPool(posisi) >= POOL_QUOTA[posisi as keyof typeof POOL_QUOTA]) return alert(`Pool ${posisi} sudah penuh (${POOL_QUOTA[posisi as keyof typeof POOL_QUOTA]})`);
    await adminInsert("league_members", { team: null, user_id: me.id, posisi });
  });

  const kocok = ()=> run(async()=>{
    if(locked) return alert("Sudah dikunci, tidak bisa kocok ulang");
    // kumpulkan pool per posisi, shuffle, bagi round-robin ber-cap
    const cap:Record<string,number> = { GK:1, Belakang:2, Tengah:2, Depan:2 };
    // tim saat ini
    const teamMap:Record<string,any[]> = { A:[...teams.A], B:[...teams.B], C:[...teams.C], D:[...teams.D] };
    // untuk setiap posisi, ambil dari pool + yang sudah di tim? Kocok ulang berarti pool + tim diacak ulang total.
    // Kita kocok total: semua anggota (pool + tim) per posisi diacak dan dibagi ulang ke 4 tim.
    const allMembers:Record<string,any[]> = { GK:[], Belakang:[], Tengah:[], Depan:[] };
    for(const p of pool) allMembers[p.posisi].push(p);
    for(const t of ["A","B","C","D"]) for(const m of teams[t]||[]) allMembers[m.posisi].push({ userId:m.userId, posisi:m.posisi });
    // shuffle tiap posisi
    for(const pos of ["GK","Belakang","Tengah","Depan"]){
      const arr=allMembers[pos];
      for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    }
    // kosongkan team dulu (hapus semua, nanti insert ulang) - tapi kita update via delete+insert
    // hapus semua team entries
    for(const t of ["A","B","C","D"]) {
      for(const m of teams[t]||[]){
        await supa().from("league_members").delete().eq("team", t).eq("user_id", m.userId);
      }
    }
    // juga hapus pool entries (team null) akan di-reinsert sebagai team
    for(const p of pool){
      await supa().from("league_members").delete().eq("user_id", p.userId);
    }
    const counts:Record<string,Record<string,number>> = { A:{GK:0,Belakang:0,Tengah:0,Depan:0}, B:{GK:0,Belakang:0,Tengah:0,Depan:0}, C:{GK:0,Belakang:0,Tengah:0,Depan:0}, D:{GK:0,Belakang:0,Tengah:0,Depan:0} };
    // hitung existing setelah delete (kosong) jadi 0
    for(const pos of ["GK","Belakang","Tengah","Depan"]){
      const arr=allMembers[pos];
      let ti=0;
      for(const mem of arr){
        let placed=false;
        for(let tries=0; tries<4; tries++){
          const t=["A","B","C","D"][ti%4];
          if(counts[t][pos] < cap[pos]){
            await supa().from("league_members").insert({ team:t, user_id: mem.userId, posisi: pos });
            counts[t][pos]++;
            placed=true;
            ti++;
            break;
          }
          ti++;
        }
        if(!placed){
          // seharusnya tidak terjadi karena total == quota, tapi jika pincang, taruh di tim dengan slot kosong pertama
          for(const t of ["A","B","C","D"]){
            if(counts[t][pos] < cap[pos]){
              await supa().from("league_members").insert({ team:t, user_id: mem.userId, posisi: pos });
              counts[t][pos]++;
              break;
            }
          }
        }
      }
    }
    alert("Kocok selesai");
  });

  const buatEdisi = ()=> run(async()=>{
    if(!edTanggal) return alert("Pilih tanggal edisi dulu");
    if(editions.length>=6) return alert("Maks 6 edisi");
    const label=edLabel || `Edisi ${edTanggal}`;
    const { data: ed, error } = await supa().from("league_editions").insert({ label, tanggal: edTanggal }).select().single();
    if(error) throw new Error(error.message);
    for(const [h,a] of FIXTURES){
      const { error:e2 } = await supa().from("league_matches").insert({ home:h, away:a, edition_id: ed.id, tanggal: edTanggal }).select().single();
      if(e2) throw new Error((e2 as any).message);
    }
    const { error:e3 } = await supa().from("schedules").insert({ tanggal: edTanggal, jam:"20:00-22:00", lokasi:`Liga ${label}`, kuota:28, status:"buka", is_liga:true, edition_id: ed.id });
    if(e3) throw new Error(e3.message);
    setEdTanggal(""); setEdLabel("");
  });

  const hapusEdisi=(id:string)=>{ if(!confirm("Hapus edisi + 6 laganya?")) return; run(async()=>{ await supa().from("league_editions").delete().eq("id",id); }); };
  const toggleLock=()=>{ if(!locked && !confirm("Kunci skuad? Setelah dikunci tidak bisa kocok ulang.")) return; run(()=> adminUpdate("league_meta",1,{ locked: !locked },"id").then(()=>{})); };
  const keluarkan=(t:string,userId:string)=>{
    const targetNama=db.users.find((u:any)=>u.id===userId)?.nama||userId;
    run(async()=>{
      // cari future edisi untuk refund logic (sama seperti sebelumnya, disederhanakan: sebelum lock auto refund)
      const future = db.schedules.filter((s:any)=> s.is_liga && s.edition_id).filter((s:any)=>{
        const ed=db.editions.find((e:any)=>e.id===s.edition_id);
        return ed && ed.tanggal >= new Date().toISOString().slice(0,10) && db.rsvps.some((r:any)=> r.scheduleId===s.id && r.userId===userId && r.status!=="cancelled");
      }).map((s:any)=> db.rsvps.find((r:any)=> r.scheduleId===s.id && r.userId===userId));
      for(const r of future){
        if(!r) continue;
        const s=db.schedules.find((x:any)=>x.id===r.scheduleId);
        if(r.status==="confirmed_lunas" && r.metode==="deposit"){
          const w=db.wallets[userId]||{paket:0,reguler:0,paket_gk:0,reguler_gk:0};
          const isGk=!!r.pakai_gk;
          const patch=isGk?{reguler_gk:w.reguler_gk+1}:{reguler:w.reguler+1};
          await supa().from("wallets").upsert({ user_id:userId, paket:w.paket, reguler:w.reguler, paket_gk:w.paket_gk, reguler_gk:w.reguler_gk, ...patch });
          await supa().from("rsvps").update({ status:"cancelled" }).eq("id",r.id);
        } else if(r.status==="wajib_bayar"||r.status==="confirmed_langsung"){
          await supa().from("rsvps").update({ status:"cancelled" }).eq("id",r.id);
        } else {
          await supa().from("rsvps").update({ status:"cancelled" }).eq("id",r.id);
        }
      }
      const { error } = await supa().from("league_members").delete().eq("team",t).eq("user_id",userId);
      if(error) throw new Error(error.message);
    });
  };

  return (
    <div>
      <h2 style={{ margin:"4px 0" }}>📝 Registrasi MUBA League KIM x DnA {locked && <span className="badge red">🔒 Skuad dikunci</span>}</h2>
      <p className="muted">Khusus ⭐ Member • Pool: GK 4, Belakang 8, Tengah 8, Depan 8 • Maks 6 hari.</p>
      {me && !isMember && <div className="banner warn">Liga khusus member. <b>Beli paket 90rb di Top-Up</b> untuk jadi member.</div>}

      {!locked && !sudahDaftar && (
        <div className="card">
          <h3>📝 Daftar Pool (pilih posisi)</h3>
          <div className="grid2">
            <select value={posisi} onChange={(e)=>setPosisi(e.target.value)}>{Object.keys(POOL_QUOTA).map(p=> <option key={p} value={p}>{p} — {countPool(p)}/{POOL_QUOTA[p as keyof typeof POOL_QUOTA]} {countPool(p)>=POOL_QUOTA[p as keyof typeof POOL_QUOTA]?"Penuh":""}</option>)}</select>
            <button className="btn" disabled={busy || countPool(posisi) >= POOL_QUOTA[posisi as keyof typeof POOL_QUOTA]} onClick={daftar}>Gabung Pool {posisi} ➜</button>
          </div>
          <p className="muted"><small>Setelah daftar, tunggu admin kocok. Posisi penuh tidak bisa dipilih lagi.</small></p>
        </div>
      )}
      {sudahDaftar && <div className="card" style={{ background:"#211a08", borderColor:"var(--gold-deep)" }}><h3>✅ Kamu sudah terdaftar</h3><p>Posisi: {(pool.find((p:any)=>p.userId===me.id)?.posisi) || (Object.values(db.teams).flat() as any[]).find((m:any)=>m.userId===me.id)?.posisi} • Menunggu kocok / lihat Klasemen.</p></div>}

      <div className="card">
        <h3>⏳ Pool — Belum Terbagi</h3>
        <div className="grid2">
          {["GK","Belakang","Tengah","Depan"].map(pos=>(
            <div key={pos} style={{ border:"1px solid var(--line)", borderRadius:10, padding:8 }}>
              <b>{pos} {countPool(pos)}/{POOL_QUOTA[pos as keyof typeof POOL_QUOTA]}</b>
              <p><small>{pool.filter((p:any)=>p.posisi===pos).map((p:any)=> db.users.find((u:any)=>u.id===p.userId)?.nama).join(", ") || "— kosong —"}</small></p>
            </div>
          ))}
        </div>
        {isAdmin && !locked && (
          <div style={{ marginTop:10 }}>
            <button className="btn" disabled={busy } onClick={kocok}>🎲 Kocok Jadi 4 Tim</button>
            <button className="btn secondary" disabled={busy} onClick={kocok} style={{ marginLeft:6 }}>🔁 Kocok Ulang</button>
            <p className="muted"><small>Dealing ber-cap: GK 1/tim, lain 2/tim — tidak mungkin 2 GK 1 tim. Boleh pool pincang, lapor kekurangan.</small></p>
            {Object.keys(kekurangan).length>0 && <div className="banner warn">Kekurangan: {Object.entries(kekurangan).map(([k,v]:any)=>`${k} −${v}`).join(", ")}</div>}
          </div>
        )}
        {isAdmin && locked && <div className="banner info">🔒 Skuad dikunci — kocok dinonaktifkan. Hanya ubah manual/k Keluarkan.</div>}
      </div>

      <div className="grid2">
        {(["A","B","C","D"] as const).map(t=>(
          <div key={t} className={`card teamcard ${t}`}>
            <b>{teamNama(t)}</b> <span className="badge blue">{(teams[t]||[]).length}/7</span>
            {(teams[t]||[]).map((m:any,i:number)=>{
              const u=db.users.find((x:any)=>x.id===m.userId);
              return <p key={i}><span className="badge gray">{m.posisi}</span> {u?.nama||m.userId} {isAdmin && <button className="btn secondary small" disabled={busy} onClick={()=> keluarkan(t,m.userId)}>Keluarkan</button>}</p>;
            })}
            {isAdmin && (teams[t]||[]).length<7 && (
              <div style={{ marginTop:6, display:"flex", gap:6 }}>
                <select onChange={(e)=>{ const v=e.target.value; if(!v) return; const [uid,pos]=v.split("|"); keluarkan(t,uid); /* pindah? */ }} style={{ flex:1 }}>
                  <option value="">↔ Pindah dari tim lain</option>
                  {(["A","B","C","D"].filter(x=>x!==t).flatMap(x=> (teams[x]||[]).map((m:any)=>({ ...m, from:x })))).map((m:any)=>(
                    <option key={m.userId} value={m.userId}>{db.users.find((u:any)=>u.id===m.userId)?.nama} — {m.posisi} (dari {teamNama(m.from)})</option>
                  ))}
                </select>
              </div>
            )}
            {(teams[t]||[]).length===0 && <p className="muted">Belum ada yang daftar.</p>}
          </div>
        ))}
      </div>

      {isAdmin && <div className="card"><button className="btn secondary" disabled={busy || (!locked && !canLock)} onClick={toggleLock} title={!locked && !canLock ? "Pool harus kosong & 4 tim penuh 7 orang" : ""}>{locked ? "🔓 Buka Kunci Skuad" : "🔒 Kunci Skuad (pool kosong + 4 tim penuh)"}</button> {!locked && !canLock && <small className="muted"> — Pool harus kosong & 4 tim 7 orang dulu.</small>}{locked && <small className="muted">Setelah dikunci hanya ubah manual/k Keluarkan.</small>}</div>}

      <div className="card">
        <h3>🗓️ Edisi Liga — Jadwal & Pembayaran (1 edisi = 1 kredit)</h3>
        {isAdmin && (
          <div style={{ border:"1px solid var(--line)", borderRadius:12, padding:12, marginBottom:10, background:"#211a08" }}>
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
          <div style={{ maxHeight:520, overflowY:"auto" }}>
            {editions.map((ed:any)=>{
              const s=db.schedules.find((x:any)=> x.is_liga && x.edition_id===ed.id);
              const list=s? db.rsvps.filter((r:any)=> r.scheduleId===s.id && r.status!=="cancelled") : [];
              const mine=s? list.find((r:any)=> r.userId===me?.id) : null;
              const myTeams:string[]=["A","B","C","D"].filter((t:any)=> (teams[t]||[]).some((m:any)=>m.userId===me?.id) || pool.some((p:any)=>p.userId===me?.id && p.posisi));
              const isSkuad=myTeams.length>0;
              const myPos=(()=>{ for(const t of ["A","B","C","D"]){ const mem=(teams[t]||[]).find((x:any)=>x.userId===me?.id); if(mem) return mem.posisi; } const pp=pool.find((p:any)=>p.userId===me?.id); return pp?.posisi||"Depan"; })();
              return (
                <div key={ed.id} style={{ border:"1px solid var(--line)", borderRadius:12, padding:12, margin:"10px 0", background:"#1e1e22" }}>
                  <b>📅 {ed.label}</b> <span className="badge blue">{ed.tanggal}</span> {s && <span className={`badge ${s.status==="buka"?"green":"red"}`}>{s.status}</span>}
                  {isAdmin && <button className="btn danger small" style={{ marginLeft:8 }} onClick={()=>hapusEdisi(ed.id)}>Hapus</button>}
                  {!s ? <p className="muted"><small>Jadwal bayar belum ada.</small></p> : (
                    <>
                      <p className="muted"><small>{list.length}/28 konfirmasi • 1 edisi = 1 kredit</small></p>
                      {!me ? <p className="muted"><small>Login dulu</small></p> : !isSkuad ? <div className="banner warn">Hanya yang sudah daftar pool/tim yang bisa konfirmasi edisi ini.</div> : (
                        !mine ? (
                          <div className="row">
                            <button className="btn" disabled={busy} onClick={async()=>{ const { rsvp }=await import("../../lib/db"); try{ await rsvp(s.id, myPos, "deposit"); location.reload(); }catch(e:any){ alert(e.message); } }}>✅ {myPos} — Potong 1 Kredit</button>
                            <button className="btn secondary" disabled={busy} onClick={async()=>{ const { rsvp }=await import("../../lib/db"); try{ await rsvp(s.id, myPos, "langsung"); location.reload(); }catch(e:any){ alert(e.message); } }}>💵 Cash ({myPos==="GK"?"15rb":"25rb"})</button>
                          </div>
                        ) : (
                          <div><span className={`badge ${mine.status==="confirmed_lunas"?"green":"blue"}`}>{mine.status==="confirmed_lunas"?"✅ Lunas":"💵 Di tempat"} • {mine.posisi}</span></div>
                        )
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


