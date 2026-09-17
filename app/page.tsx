"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { walletOf, totalKredit, hasUtang } from "../lib/store";
import { fetchAll, signUp, signIn, signOut } from "../lib/db";
import { BASECAMP } from "../lib/club";

export default function Home() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const reload = () => fetchAll().then(setDb).catch((e: any) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err">⚠️ {err}</div><p className="muted"><small>Cek env Supabase + koneksi.</small></p></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);

  return (
    <div>
      <div className="hero">
        <img src="/logo-muba.jpg" alt="Logo MUBA FC" className="logo" />
        <h1>MUBA FC</h1>
        <p>Masjid Utsman Bin Affan • Main rutin tiap pekan ⚽</p>
        <p><small>📍 {BASECAMP}</small></p>
      </div>
      {!me ? (
        <div className="card">
          <h2>Selamat datang! 👋</h2>
          <p className="muted">Daftar sekali, tunggu approve admin, langsung bisa isi list main.</p>
          <div className="pricegrid">
            <div className="price"><span className="muted">Sekali main</span><br /><b>Rp25rb</b><br /><small className="muted">= 1 kredit</small></div>
            <div className="price hot sel"><span className="tag">JADI MEMBER ⭐</span><span className="muted">Paket 4x main</span><br /><b>Rp90rb</b><br /><small className="muted">= 4 kredit + member permanen</small></div>
          </div>
          <AuthBox onDone={reload} />
        </div>
      ) : (
        <div>
          <div className="saldo">
            <small>Halo, {me.nama}! • {me.role} • {me.status} {me.is_member ? "• ⭐ Member" : ""}</small>
            <div className="num">{totalKredit(walletOf(db, me.id))} kredit</div>
            <small>Paket {walletOf(db, me.id).paket} • Reguler {walletOf(db, me.id).reguler}</small>
            <div className="row" style={{ marginTop: 12 }}>
              <Link href="/topup" style={{ flex: 1 }}><button className="btn warn" style={{ background: "#D4AF37", color: "#141005" }}>💳 Top-Up</button></Link>
              <Link href="/jadwal" style={{ flex: 1 }}><button className="btn" style={{ background: "#141005", border: "1px solid var(--gold-deep)" }}>📅 Isi List</button></Link>
            </div>
          </div>
          {me.status === "pending" && (
            <div className="banner warn">⏳ Akunmu menunggu approve admin. Hubungi pengurus di menu Kontak.</div>
          )}
          {hasUtang(db, me.id) && (
            <div className="banner err">⚠️ Kamu ada tunggakan — lunasi ke admin dulu untuk buka list berikutnya.</div>
          )}
          <div className="row">
            <button className="btn secondary small" onClick={() => signOut().then(reload)}>Logout</button>
            <Link href="/liga"><button className="btn secondary small">🏆 Liga</button></Link>
            <Link href="/kontak"><button className="btn secondary small">📞 Kontak</button></Link>
          </div>
        </div>
      )}

      <div className="card">
        <h3>📅 Jadwal terdekat</h3>
        {db.schedules.slice(0, 3).map((s: any) => {
          const ikut = db.rsvps.filter((r: any) => r.scheduleId === s.id && r.status !== "cancelled").length;
          return <p key={s.id}>📅 {s.tanggal} {s.jam} — {s.lokasi} — <b>{ikut}/{s.status === "sparing" ? 14 : s.kuota}</b></p>;
        })}
        <Link href="/jadwal"><button className="btn">Lihat & Isi List ➜</button></Link>
      </div>
    </div>
  );
}

function AuthBox({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "daftar">("daftar");
  const [nama, setNama] = useState(""); const [wa, setWa] = useState("");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async () => {
    setMsg("");
    try {
      if (mode === "daftar") {
        if (!nama || !wa || !email || !pass) return setMsg("Isi Nama, WA, Email, dan Password dulu ya");
        await signUp(email.trim(), pass, nama.trim(), wa.trim());
        setMsg("✅ Terdaftar! Menunggu approve admin. Kamu sudah login.");
      } else {
        if (!email || !pass) return setMsg("Isi Email dan Password");
        await signIn(email.trim(), pass);
      }
      onDone();
    } catch (e: any) { setMsg("⚠️ " + (e.message || "Gagal")); }
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
      <button className="btn" onClick={submit}>{mode === "daftar" ? "Daftar Sekarang" : "Masuk"}</button>
      {msg && <p>{msg}</p>}
      <p className="muted"><small>Setelah daftar, statusmu <b>pending</b> sampai di-approve admin.</small></p>
    </div>
  );
}
