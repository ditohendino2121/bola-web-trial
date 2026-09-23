"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { walletOf, totalKredit, dikunciRSVP } from "../lib/store";
import { fetchAll, signUp, signIn, signOut, setujuAkad } from "../lib/db";
import { BASECAMP } from "../lib/club";
import { AKAD_JUDUL, AKAD_TEKS, AKAD_CHECKBOXES, AKAD_VERSION } from "../lib/akad";

export default function Home() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const reload = () => fetchAll().then(setDb).catch((e: any) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err">{err}</div><p className="muted"><small>Cek env Supabase + koneksi.</small></p></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);

  const greet = (() => { const h=new Date().getHours(); if(h<11) return "Selamat pagi"; if(h<15) return "Selamat siang"; if(h<18) return "Selamat sore"; return "Selamat malam"; })();
  const weekDays = (() => {
    const days=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
    const today=new Date(); const start=new Date(today); start.setDate(today.getDate()-today.getDay());
    return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); const iso=d.toISOString().slice(0,10); const has=db.schedules.some((s:any)=>s.tanggal===iso); const isToday=iso===today.toISOString().slice(0,10); return {label:days[d.getDay()], num:String(d.getDate()).padStart(2,"0"), iso, has, isToday}; });
  })();
  const accentFor = (idx:number)=> ["accent-gold","accent-lilac","accent-pink","accent-teal","accent-blue"][idx%5];

  return (
    <div>
      {/* Oddsly greet header */}
      <div className="greet">
        <div>
          <h2>{me ? `${greet},` : "Good morning,"} <span>{me ? me.nama.split(" ")[0] : "dear player"}</span></h2>
          <p>{me ? `${totalKredit(walletOf(db, me.id))} kredit · ${me.is_member ? "Member" : "Non-member"} · ${BASECAMP}` : "Masjid Utsman Bin Affan · Main rutin tiap pekan"}</p>
        </div>
        <div className="avatar">{me ? me.nama.slice(0,1).toUpperCase() : "M"}</div>
      </div>
      <div className="date-strip">
        {weekDays.map((d)=> (
          <Link key={d.iso} href="/jadwal" className={`date-pill ${d.isToday ? "on" : ""} ${d.has ? "has" : ""}`} style={{ textDecoration: "none" }}>
            {d.label}<b>{d.num}</b>
          </Link>
        ))}
      </div>
      <div className="hero">
        <img src="/logo-muba.jpg" alt="MUBA FC" className="logo" />
        <h1>MUBA FC</h1>
        <p>Masjid Utsman Bin Affan · Main rutin tiap pekan</p>
        <p><small style={{ color: "var(--muted)" }}>{BASECAMP}</small></p>
        <div className="tagline">Hitam & Gold · Komunitas futsal masjid</div>
      </div>
      {!me ? (
        <div className="card">
          <h2>Selamat datang</h2>
          <p className="muted">Daftar sekali, tunggu approve admin, langsung bisa isi list main.</p>
          <div className="pricegrid">
            <div className="price"><span className="muted">Sekali main</span><br /><b>Rp25rb</b><br /><small className="muted">1 kredit · GK Rp15rb</small></div>
            <div className="price hot sel"><span className="tag">JADI MEMBER</span><span className="muted">Paket 4x main</span><br /><b>Rp90rb</b><br /><small className="muted">4 kredit + member permanen · GK Rp50rb</small></div>
          </div>
          <AuthBox onDone={reload} />
        </div>
      ) : (
        <div>
          <div className="saldo">
            <small>Halo, {me.nama} · {me.role} · {me.status} {me.is_member ? "· Member" : ""}</small>
            <div className="num">{totalKredit(walletOf(db, me.id))} kredit</div>
            <small>Paket {walletOf(db, me.id).paket} · Reguler {walletOf(db, me.id).reguler} · GK {walletOf(db, me.id).paket_gk + walletOf(db, me.id).reguler_gk}</small>
            <div className="row" style={{ marginTop: 14 }}>
              <Link href="/topup" style={{ flex: 1 }}><button className="btn" style={{ background: "#D4AF37", color: "#111007" }}>Top-Up</button></Link>
              <Link href="/jadwal" style={{ flex: 1 }}><button className="btn secondary">Isi List</button></Link>
            </div>
          </div>
          {me.status === "pending" && (
            <div className="banner warn">Akunmu menunggu approve admin. Hubungi pengurus di menu Kontak.</div>
          )}
          {(!me.setuju_akad || me.akad_version !== AKAD_VERSION) && (
            <AkadPrompt userId={me.id} onDone={reload} />
          )}
          {dikunciRSVP(db, me.id) && (
            <div className="banner err">Ada pembayaran yang belum beres — lunasi ke admin dulu.</div>
          )}
          <div className="row">
            <button className="btn secondary small" onClick={() => signOut().then(reload)}>Logout</button>
            <Link href="/liga"><button className="btn secondary small">Liga</button></Link>
            <Link href="/kontak"><button className="btn secondary small">Kontak</button></Link>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="page-head" style={{ margin: 0 }}><h3 style={{ margin: 0 }}>Jadwal terdekat</h3><p>Scores — tap untuk isi list</p></div>
          <Link href="/jadwal" className="badge gold" style={{ textDecoration: "none" }}>Live</Link>
        </div>
        {db.schedules.slice(0, 3).map((s: any, idx:number) => {
          const ikut = db.rsvps.filter((r: any) => r.scheduleId === s.id && r.status !== "cancelled").length;
          const sisa = (s.status === "sparing" ? 14 : s.kuota) - ikut;
          const isLive = s.status === "buka" && sisa>0;
          return (
            <div key={s.id} className={`match-card ${accentFor(idx)}`} style={{ margin: "10px 0" }}>
              <div className="match-card-top">
                <div className="datebox" style={{ minWidth: 56 }}>{s.tanggal.slice(8,10)}<span>{s.tanggal.slice(5,7)}/{s.tanggal.slice(0,4)}</span></div>
                <div className="match-card-mid">
                  <div className="match-card-title">{s.jam} · {s.lokasi}</div>
                  <div className="match-card-sub">{s.tanggal} · {ikut}/{s.status === "sparing" ? 14 : s.kuota} terisi · sisa {Math.max(0,sisa)}</div>
                  <div className="match-card-odds">
                    <span className={isLive?"gold":""}>{isLive?"BUKA":""+s.status.toUpperCase()}</span>
                    <span>Rp25rb</span><span style={{ opacity: 0.7 }}>GK 15rb</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {db.schedules.length===0 && <p className="muted" style={{ fontSize:13 }}>Belum ada jadwal. Admin buat di Kelola Jadwal.</p>}
        <Link href="/jadwal"><button className="btn secondary" style={{ marginTop: 10 }}>Lihat dan isi list</button></Link>
      </div>
    </div>
  );
}

function AkadPrompt({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [checks, setChecks] = useState<boolean[]>(Array(5).fill(false));
  const [final, setFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const all = checks.every(Boolean) && final;
  const kirim = async () => {
    if (!all) return;
    setBusy(true);
    try { await setujuAkad(userId, AKAD_VERSION); onDone(); }
    catch (e: any) { alert(e.message); }
    setBusy(false);
  };
  return (
    <div className="card" style={{ borderColor: "var(--gold-deep)", background: "#1A180E" }}>
      <h3>Akad Membership — wajib disetujui</h3>
      {!show ? (
        <><p className="muted"><small>{AKAD_JUDUL} — baca lengkap sebelum menyetujui.</small></p><button className="btn secondary" onClick={() => setShow(true)}>Baca Syarat &amp; Ketentuan</button></>
      ) : (
        <div style={{ maxHeight: 220, overflowY: "auto", background: "#0e0e10", border: "1px solid var(--line)", borderRadius: 12, padding: 12, whiteSpace: "pre-wrap", fontSize: 12 }}>{AKAD_TEKS}</div>
      )}
      <div style={{ marginTop: 10 }}>
        {AKAD_CHECKBOXES.map((t, i) => (
          <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "9px 0", fontSize: 13, lineHeight: 1.5, cursor: "pointer" }}><input type="checkbox" className="akad-chk" checked={checks[i]} onChange={(e) => setChecks((a) => a.map((v, k) => k === i ? e.target.checked : v))} /> <span>{t}</span></label>
        ))}
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "12px 0", fontWeight: 700, fontSize: 13, background: "rgba(212,175,55,0.10)", padding: "10px 12px", borderRadius: 10, cursor: "pointer", lineHeight: 1.5 }}><input type="checkbox" className="akad-chk" checked={final} onChange={(e) => setFinal(e.target.checked)} /> <span>Saya telah membaca, memahami, dan menyetujui Syarat dan Ketentuan Membership Futsal.</span></label>
      </div>
      <button className="btn" disabled={!all || busy} onClick={kirim}>{busy ? "Menyimpan..." : "Saya Setuju & Lanjut"}</button>
      <p className="muted"><small>Versi {AKAD_VERSION} · Wajib untuk lanjut pakai web.</small></p>
    </div>
  );
}

function AuthBox({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "daftar">("daftar");
  const [nama, setNama] = useState(""); const [wa, setWa] = useState("");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [checks, setChecks] = useState<boolean[]>(Array(5).fill(false));
  const [final, setFinal] = useState(false);
  const [showAkad, setShowAkad] = useState(false);
  const needAkad = mode === "daftar";
  const allAkad = !needAkad || (checks.every(Boolean) && final);
  const submit = async () => {
    setMsg("");
    try {
      if (mode === "daftar") {
        if (!nama || !wa || !email || !pass) return setMsg("Isi Nama, WA, Email, dan Password dulu ya");
        if (!allAkad) return setMsg("Centang semua akad dulu — wajib untuk daftar.");
        await signUp(email.trim(), pass, nama.trim(), wa.trim());
        try { const { supa } = await import("../lib/supabase"); const { data } = await supa().auth.getSession(); const uid = data.session?.user?.id; if (uid) await setujuAkad(uid, AKAD_VERSION); } catch {}
        setMsg("Terdaftar! Menunggu approve admin.");
      } else {
        if (!email || !pass) return setMsg("Isi Email dan Password");
        await signIn(email.trim(), pass);
      }
      onDone();
    } catch (e: any) { setMsg(e.message || "Gagal"); }
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <button className="btn secondary small" onClick={() => setMode("daftar")}>Daftar baru</button>
        <button className="btn secondary small" onClick={() => setMode("login")}>Sudah punya akun</button>
      </div>
      {mode === "daftar" && (<>
        <input placeholder="Nama lengkap" value={nama} onChange={(e) => setNama(e.target.value)} />
        <input placeholder="No WA, cth 0812xxxx" value={wa} onChange={(e) => setWa(e.target.value)} />
      </>)}
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password (min 6 karakter)" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      {mode === "daftar" && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 12, margin: "8px 0", background: "#141416" }}>
          {!showAkad ? <button className="btn secondary small" onClick={() => setShowAkad(true)}>Baca &amp; Setujui Akad</button> : (
            <>
              <h4 style={{ margin: "4px 0" }}>{AKAD_JUDUL}</h4>
              <div style={{ maxHeight: 180, overflowY: "auto", background: "#0e0e10", border: "1px solid var(--line)", borderRadius: 10, padding: 10, whiteSpace: "pre-wrap", fontSize: 11 }}>{AKAD_TEKS}</div>
              <div style={{ marginTop: 8 }}>
                {AKAD_CHECKBOXES.map((t, i) => (
                  <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "9px 0", fontSize: 12, lineHeight: 1.5, cursor: "pointer" }}><input type="checkbox" className="akad-chk" checked={checks[i]} onChange={(e) => setChecks((a) => a.map((v, k) => k === i ? e.target.checked : v))} /> <span>{t}</span></label>
                ))}
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "12px 0", fontWeight: 700, fontSize: 12, background: "rgba(212,175,55,0.10)", padding: "10px 12px", borderRadius: 10, cursor: "pointer", lineHeight: 1.5 }}><input type="checkbox" className="akad-chk" checked={final} onChange={(e) => setFinal(e.target.checked)} /> <span>Saya telah membaca, memahami, dan menyetujui Syarat dan Ketentuan Membership Futsal.</span></label>
              </div>
            </>
          )}
          <p className="muted"><small>Versi {AKAD_VERSION} · Wajib dicentang semua untuk daftar.</small></p>
        </div>
      )}
      <button className="btn" onClick={submit}>{mode === "daftar" ? "Daftar Sekarang" : "Masuk"}</button>
      {msg && <p style={{ marginTop: 8, fontSize: 13 }}>{msg}</p>}
      <p className="muted"><small>Setelah daftar, statusmu <b>pending</b> sampai di-approve admin.</small></p>
    </div>
  );
}
