"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAll, adminInsert, adminUpdate } from "../../lib/db";
import { supa } from "../../lib/supabase";
import { teamNama } from "../../lib/store";

export default function LigaRegistrasi() {
  const [db,setDb]=useState<any>(null);
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  const [edTanggal,setEdTanggal]=useState(""); const [edLabel,setEdLabel]=useState("");
  const [manualUser,setManualUser]=useState(""); const [manualPos,setManualPos]=useState(""); const [manualTeam,setManualTeam]=useState("A"); const [kocokBusy,setKocokBusy]=useState(false);
  const [matchForm,setMatchForm]=useState<Record<string,{home:string;away:string}>>({});
  const reload=()=>fetchAll().then(setDb).catch((e:any)=>setErr(e.message));
  useEffect(()=>{reload();},[]);
  if(err) return <div className="card"><div className="banner err"> {err}</div></div>;
  if(!db) return <div className="card"><p>Memuat...</p></div>;
  const me=db.users.find((u:any)=>u.id===db.sessionId);
  const isAdmin=me?.role==="admin";
  const isMember=!!me?.is_member;
  const locked=!!db.leagueLocked;
  const run=async(fn:()=>Promise<void>)=>{ setBusy(true); try{await fn(); await reload();}catch(e:any){alert(e.message);} setBusy(false); };
  const teams:any = db.teams||{A:[],B:[],C:[],D:[]};
  const editions:any[] = db.editions||[];
  const leagueLocked=!!db.leagueLocked;

  // ---- HELPERS ----
  const timPenuh = (t:string)=> (teams[t]||[]).length>=10;
  const alreadyInTeam = (userId:string)=> ["A","B","C","D"].some(t=> (teams[t]||[]).some((m:any)=>m.userId===userId));

  // ---- ADMIN ASSIGN PLAYER KE TIM ----
  const manualDaftar = ()=>run(async()=>{
    if(!manualUser || !manualPos || !manualTeam) return alert("Lengkapi: pilih pemain, posisi, tim");
    const targetUser=db.users.find((u:any)=>u.id===manualUser);
    if(!targetUser) return alert("Pemain tidak ditemukan");
    if(alreadyInTeam(manualUser)) return alert("Pemain sudah ada di tim lain - gunakan Keluarkan dulu");
    await adminInsert("league_members", { team: manualTeam, user_id: manualUser, posisi: manualPos });
    // Reset state SESUDAH reload selesai, bukan di sini
    setManualUser(""); setManualPos(""); setManualTeam("A");
  });

  // ---- KELUARKAN / REMOVE DARI TIM ----
  const keluarkan=(t:string,userId:string)=>{
    const targetNama=db.users.find((u:any)=>u.id===userId)?.nama||userId;
    run(async()=>{
      const { error } = await supa().from("league_members").delete().eq("team",t).eq("user_id",userId);
      if(error) throw new Error(error.message);
    });
  };

  // ---- RSVP EDITIS LIGA (CONFIRM HADIR) ----
  const rsvpEdisi = async (scheduleId: string, posisi: string, metode: "deposit"|"langsung") => {
    const { data, error } = await supa().rpc("rpc_rsvp", {
      p_schedule: scheduleId, p_posisi: posisi, p_metode: metode,
    });
    if (error) throw new Error(error.message);
    const r = data as any;
    if (!r?.ok) throw new Error(r?.msg || "Gagal RSVP");
    return r.rsvp_id;
  };

  // ---- CANCEL RSVP (TAKIR LIST) ----
  const batalRsvp = async (rsvpId: string) => {
    const { data, error } = await supa().rpc("rpc_cancel", { p_schedule: rsvpId });
    if (error) throw new Error(error.message);
    const r = data as any;
    if (!r?.ok) throw new Error(r?.msg || "Gagal batal RSVP");
    return r;
  };

  // ---- BUILD EDISI + JADWAL (pertandingan ditambah manual, lihat tambahMatch) ----
  const buatEdisi = ()=>run(async()=>{
    if(!edTanggal) return alert("Pilih tanggal edisi dulu");
    const label=edLabel || `Edisi ${edTanggal}`;
    const { data: ed, error } = await supa().from("league_editions").insert({ label, tanggal: edTanggal }).select().single();
    if(error) throw new Error(error.message);
    const { error:e3 } = await supa().from("schedules").insert({ tanggal: edTanggal, jam:"20:00-22:00", lokasi:`Liga ${label}`, kuota:28, status:"buka", is_liga:true, edition_id: ed.id });
    if(e3) throw new Error(e3.message);
    setEdTanggal(""); setEdLabel("");
  });

  // ---- TAMBAH / HAPUS PERTANDINGAN (admin pilih tim yang bertanding per edisi) ----
  const tambahMatch = (edId:string, tanggal:string)=>run(async()=>{
    const f=matchForm[edId];
    if(!f?.home || !f?.away) return alert("Pilih tim home dan away");
    if(f.home===f.away) return alert("Home dan away tidak boleh tim yang sama");
    const { error } = await supa().from("league_matches").insert({ home:f.home, away:f.away, edition_id: edId, tanggal });
    if(error) throw new Error(error.message);
    setMatchForm((p)=>({ ...p, [edId]: { home:"", away:"" } }));
  });
  const hapusMatch = (matchId:string)=>{ if(!confirm("Hapus pertandingan ini?")) return; run(async()=>{ const { error } = await supa().from("league_matches").delete().eq("id",matchId); if(error) throw new Error(error.message); }); };

  // ---- TOGGLE LOCK ----
  const toggleLock=()=>{ if(!locked && !confirm("Kunci skuad? Setelah dikunci tidak bisa assign manual.")) return; run(()=>adminUpdate("league_meta",1,{ locked: !locked },"id").then(()=>{})); };

  // ---- HAPUS EDITIS ----
  const hapusEdisi=(id:string)=>{ if(!confirm("Hapus edisi + 6 laganya?")) return; run(async()=>{ await supa().from("league_editions").delete().eq("id",id); }); };

  // ---- POSISI PLAYER UNTUK RSVP ----
  const myPos = (() => { for (const t of ["A", "B", "C", "D"]) { const mem = (teams[t] || []).find((x: any) => x.userId === me?.id); if (mem) return mem.posisi; } return "Depan"; })();
  const myTeams = teams;

  return (
    <div>
      <h2 style={{ margin:"4px 0" }}>Liga MUBA FC — Admin Assign & Edisi</h2>
      {me && !isMember && <div className="banner warn">Liga khusus member. <b>Beli paket 90rb di Top-Up</b>untuk jadi member.</div>}

      {/* Admin Assign Pemain ke Tim */}
      {isAdmin && !locked && (
        <div className="card" style={{ marginTop:12, borderColor:"var(--gold)" }}>
          <h3>Assign Pemain ke Tim</h3>
          <p className="muted">Pilih pemain, posisi, dan tim tujuan</p>
          <div className="grid2">
            <select style={{ marginBottom:8 }} onChange={(e)=>setManualUser(e.target.value)} >
              <option value="">-- Pilih Pemain --</option>
              {db.users.filter((u:any)=>u.status==="approved").map((u:any)=>(
                <option key={u.id} value={u.id}>{u.nama}</option>
              ))}
            </select>
            <select style={{ marginBottom:8 }} onChange={(e)=>setManualPos(e.target.value)} >
              <option value="">-- Pilih Posisi --</option>
              <option value="GK">GK</option>
              <option value="Belakang">Belakang</option>
              <option value="Tengah">Tengah</option>
              <option value="Depan">Depan</option>
            </select>
            <select style={{ marginBottom:8 }} onChange={(e)=>setManualTeam(e.target.value)} >
              <option value="">-- Pilih Tim --</option>
              <option value="A">{teamNama("A")}</option>
              <option value="B">{teamNama("B")}</option>
              <option value="C">{teamNama("C")}</option>
              <option value="D">{teamNama("D")}</option>
            </select>
            <button className="btn" disabled={busy} onClick={manualDaftar}>Assign ke Tim</button>
          </div>
          <p className="muted"><small>Total per tim: maks 10 orang. Posisi terbaru menggantikan posisi lama.</small></p>
        </div>
      )}

      {/* Daftar Tim */}
      <div className="grid2">
        {(["A","B","C","D"] as const).map(t=>{
          const list = teams[t]||[];
          const cnt=(p:string)=>list.filter((m:any)=>m.posisi===p).length;
          return (
          <div key={t} className={`card teamcard ${t}`}>
            <b>{teamNama(t)}</b> <span className="badge blue">{list.length}/10</span>
            <div className="muted" style={{ fontSize:12, margin:"4px 0" }}>GK {cnt("GK")} · Bel {cnt("Belakang")} · Teng {cnt("Tengah")} · Depan {cnt("Depan")}</div>
            {list.map((m:any,i:number)=>{
              const u=db.users.find((x:any)=>x.id===m.userId);
              return <p key={i}><span className="badge gray">{m.posisi}</span> {u?.nama||m.userId} {isAdmin && <button className="btn secondary small" disabled={busy} onClick={()=>keluarkan(t,m.userId)}>Keluarkan</button>}</p>;
            })}
            {isAdmin && list.length<10 && (
              <div style={{ marginTop:6, display:"flex", gap:6 }}>
                <select onChange={(e)=>{ const v=e.target.value; if(!v) return; const [uid,pos]=v.split("|"); keluarkan(t,uid); }} style={{ flex:1 }}>
                  <option value="">↔ Pindah dari tim lain</option>
                  {(["A","B","C","D"].filter(x=>x!==t).flatMap(x=> (teams[x]||[]).map((m:any)=>({ ...m, from:x })))).map((m:any)=>(
                    <option key={m.userId} value={m.userId}>{db.users.find((u:any)=>u.id===m.userId)?.nama} — {m.posisi} (dari {teamNama(m.from)})</option>
                  ))}
                </select>
              </div>
            )}
            {list.length===0 && <p className="muted">Belum ada pemain.</p>}
          </div>
          );
        })}
      </div>

      {/* Toggle Lock */}
      {isAdmin && <div className="card"><button className="btn secondary" disabled={busy || locked} onClick={toggleLock}>{locked ? "🔓 Buka Kunci" : " Kunci Skuad"}</button>{locked && <small className="muted">Setelah dikunci hanya ubah manual/keluarkan.</small>}</div>}

      {/* Edisi Liga — Jadwal & Pembayaran */}
      <div className="card">
        <h3>🗓 Edisi Liga — Jadwal & Pembayaran (1 edisi = 1 kredit)</h3>
        {isAdmin && (
          <div style={{ border:"1px solid var(--line)", borderRadius:12, padding:12, marginBottom:10, background:"#211a08" }}>
            <div className="grid2">
              <input type="date" value={edTanggal} onChange={(e)=>setEdTanggal(e.target.value)} />
              <input placeholder="Label, cth: Hari 1 — 25 Okt 2026" value={edLabel} onChange={(e)=>setEdLabel(e.target.value)} />
            </div>
            <button className="btn" disabled={busy||!edTanggal} onClick={buatEdisi}>+ Buat Edisi & Jadwal</button>
          </div>
        )}
        {editions.length===0 && <p className="muted">Belum ada edisi. Admin buat edisi pertama.</p>}
        {editions.length>0 && (
          <div style={{ maxHeight:600, overflowY:"auto" }}>
            {editions.map((ed:any)=>{
              const s=db.schedules.find((x:any)=>x.is_liga && x.edition_id===ed.id);
              const list=s? db.rsvps.filter((r:any)=>r.scheduleId===s.id && r.status!=="cancelled") : [];
              const mine=s? list.find((r:any)=>r.userId===me?.id) : null;
              const myTeams2:string[]=["A","B","C","D"].filter((t:any)=> (teams[t]||[]).some((m:any)=>m.userId===me?.id));
              const isSkuad=myTeams2.length>0;
              return (
                <div key={ed.id} style={{ border:"1px solid var(--line)", borderRadius:12, padding:12, margin:"10px 0", background:"#1e1e22" }}>
                  <b> {ed.label}</b> <span className="badge blue">{ed.tanggal}</span> {s && <span className={`badge ${s.status==="buka"?"green":"red"}`}>{s.status}</span>}
                  {isAdmin && <button className="btn danger small" style={{ marginLeft:8 }} onClick={()=>hapusEdisi(ed.id)}>Hapus</button>}
                  {!s ? <p className="muted"><small>Jadwal bayar belum ada.</small></p> : (
                    <>
                      <p className="muted"><small>{list.length}/40 konfirmasi • 1 edisi = 1 kredit</small></p>
                      {!me ? <p className="muted"><small>Login dulu</small></p> : !isSkuad ? <div className="banner warn">Hanya yang sudah diassign ke tim yang bisa konfirmasi edisi ini.</div> : (
                        !mine ? (
                          <div className="row">
                            <button className="btn" disabled={busy} onClick={async()=>{ try{ await rsvpEdisi(s.id, myPos||"Depan", "deposit"); location.reload(); }catch(e:any){ alert(e.message); } }}>{myPos||"Depan"} — Potong 1 Kredit</button>
                            <button className="btn secondary" disabled={busy} onClick={async()=>{ try{ await rsvpEdisi(s.id, myPos||"Depan", "langsung"); location.reload(); }catch(e:any){ alert(e.message); } }}>Cash ({myPos==="GK"?"15rb":"25rb"})</button>
                          </div>
                        ) : (
                          <div><span className={`badge ${mine.status==="confirmed_lunas"?"green":"blue"}`}>{mine.status==="confirmed_lunas"?" Lunas":" Di tempat"} • {mine.posisi}</span></div>
                        )
                      )}
                    </>
                  )}
                  <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--line)" }}>
                    <b>⚽ Pertandingan</b>
                    {db.matches.filter((m:any)=>m.edition_id===ed.id).length===0 && <p className="muted"><small>Belum ada pertandingan.</small></p>}
                    {db.matches.filter((m:any)=>m.edition_id===ed.id).map((m:any)=>(
                      <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--line)" }}>
                        <Link href={`/liga/${m.id}`} style={{ textDecoration:"none", color:"inherit" }}><b>{teamNama(m.home)}</b> vs <b>{teamNama(m.away)}</b> <span className={`badge ${m.sh===null?"gray":"green"}`}>{m.sh===null?"belum":`${m.sh}:${m.sa}`}</span></Link>
                        {isAdmin && <button className="btn danger small" onClick={()=>hapusMatch(m.id)}>Hapus</button>}
                      </div>
                    ))}
                    {isAdmin && (
                      <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                        <select value={matchForm[ed.id]?.home||""} onChange={(e)=>setMatchForm((p)=>({ ...p, [ed.id]: { home:e.target.value, away:p[ed.id]?.away||"" } }))}>
                          <option value="">Tim Home</option>
                          {(["A","B","C","D"] as const).map(t=><option key={t} value={t}>{teamNama(t)}</option>)}
                        </select>
                        <select value={matchForm[ed.id]?.away||""} onChange={(e)=>setMatchForm((p)=>({ ...p, [ed.id]: { home:p[ed.id]?.home||"", away:e.target.value } }))}>
                          <option value="">Tim Away</option>
                          {(["A","B","C","D"] as const).map(t=><option key={t} value={t}>{teamNama(t)}</option>)}
                        </select>
                        <button className="btn secondary small" disabled={busy} onClick={()=>tambahMatch(ed.id, ed.tanggal)}>+ Tambah</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tarik List / Cancel RSVP */}
      {me && !isAdmin && (
        <div className="card" style={{ marginTop:12, borderColor:"var(--gold)" }}>
          <h3>Tarik List (Batal Konfirmasi)</h3>
          <p className="muted">Batal konfirmasi s.d. H-1 (sehari sebelum jadwal) untuk kembalikan kredit</p>
          {editions.length>0 && editions.map((ed:any)=>{
            const s=db.schedules.find((x:any)=>x.is_liga && x.edition_id===ed.id);
            if(!s) return null;
            const myRsvp=s? db.rsvps.find((r:any)=>r.scheduleId===s.id && r.userId===me?.id && r.status!=="cancelled") : null;
            if(!myRsvp) return null;
            const todayISO = new Date().toISOString().slice(0,10);
            const sudahHariH = todayISO >= s.tanggal;
            return (
              <div key={ed.id} style={{ marginTop:8, padding:8, background:"#1e1e22", borderRadius:8 }}>
                <b>Edisi:</b> {ed.label} {ed.tanggal} <br/>
                <b>Posisi:</b> {myRsvp.posisi} <br/>
                <b>Status:</b> {myRsvp.status} <br/>
                <b>Metode:</b> {myRsvp.metode} <br/>
                {sudahHariH ? <p className="banner warn">Sudah hari-H — tetap wajib bayar, tidak bisa batal.</p> : (
                  <button className="btn danger small" onClick={async()=>{ try{ await batalRsvp(myRsvp.id); location.reload(); }catch(e:any){ alert(e.message); } }}>
                    Batal — Boleh s.d. H-1 (Kembalikan Kredit)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}