"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { load, save, uid, reset, hasUtang, walletOf, totalKredit } from "../lib/store";
import { BASECAMP, MAPS_URL } from "../lib/club";

export default function Home() {
  const [db, setDb] = useState<any>(null);
  useEffect(() => { setDb(load()); }, []);
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
          <AuthBox onDone={() => setDb(load())} />
        </div>
      ) : (
        <div>
          <div className="saldo">
            <small>Halo, {me.nama}! • {me.role} • {me.status} {me.is_member ? "• ⭐ Member" : ""}</small>
            <div className="num">{totalKredit(walletOf(db, me.id))} kredit</div>
            <small>Paket {walletOf(db, me.id).paket} • Reguler {walletOf(db, me.id).reguler}</small>
            <div className="row" style={{ marginTop: 12 }}>
              <Link href="/topup" style={{ flex: 1 }}><button className="btn warn" style={{ background: "#fff", color: "#166534" }}>💳 Top-Up</button></Link>
              <Link href="/jadwal" style={{ flex: 1 }}><button className="btn" style={{ background: "#062e16" }}>📅 Isi List</button></Link>
            </div>
          </div>
          {me.status === "pending" && (
            <div className="banner warn">⏳ Akunmu menunggu approve admin. Tunjukkan nama/WA-mu ke admin di lapangan atau grup.</div>
          )}
          {hasUtang(db, me.id) && (
            <div className="banner err">⚠️ Kamu ada utang Rp25rb (bayar di lapangan). Lunasi dulu sebelum isi list lagi.</div>
          )}
          <div className="row">
            <button className="btn secondary small" onClick={() => { const d = load(); d.sessionId = null; save(d); setDb(load()); }}>Logout</button>
            <Link href="/liga"><button className="btn secondary small">🏆 Liga Bulanan</button></Link>
          </div>
        </div>
      )}

      <div className="card">
        <h3>📅 Jadwal terdekat</h3>
        {db.schedules.map((s: any) => {
          const ikut = db.rsvps.filter((r: any) => r.scheduleId === s.id && r.status.startsWith("confirmed")).length;
          const pct = Math.min(100, Math.round((ikut / s.kuota) * 100));
          return (
            <div key={s.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div className="ticket">
                <div className="datebox">{s.tanggal.slice(8, 10)}<span>{s.tanggal.slice(0, 7)}</span></div>
                <div style={{ flex: 1 }}>
                  <b>{s.jam}</b><br /><small className="muted">{s.lokasi}</small>
                  <div className="progress"><i style={{ width: pct + "%" }} /></div>
                  <small className="muted">{ikut}/{s.kuota} ikut {ikut >= s.kuota ? "• PENUH" : ""}</small>
                </div>
              </div>
            </div>
          );
        })}
        <Link href="/jadwal"><button className="btn">Lihat & Isi List ➜</button></Link>
      </div>

      <div className="card">
        <h4>ℹ️ Akun trial</h4>
        <p className="muted">Admin bawaan: <b>Admin / admin123</b>. Data hanya di browser ini.</p>
        <button className="btn secondary small" onClick={reset}>Reset data trial</button>
      </div>
    </div>
  );
}

function AuthBox({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "daftar">("daftar");
  const [nama, setNama] = useState(""); const [wa, setWa] = useState(""); const [pass, setPass] = useState("");
  const submit = () => {
    const db = load();
    if (mode === "daftar") {
      if (!nama || !wa || !pass) return alert("Isi Nama, No WA, dan Password dulu ya");
      if (db.users.some((u: any) => u.wa === wa)) return alert("No WA sudah terdaftar, pilih Login");
      const u = { id: uid(), nama, wa, pass, role: "player" as const, status: "pending" as const, is_member: false };
      db.users.push(u); db.sessionId = u.id; save(db); onDone();
    } else {
      const u = db.users.find((x: any) => (x.nama === nama || x.wa === nama) && x.pass === pass);
      if (!u) return alert("Login gagal. Coba Admin / admin123");
      db.sessionId = u.id; save(db); onDone();
    }
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <button className="btn secondary small" onClick={() => setMode("daftar")}>Daftar baru</button>
        <button className="btn secondary small" onClick={() => setMode("login")}>Sudah punya akun</button>
      </div>
      <input placeholder="Nama lengkap" value={nama} onChange={(e) => setNama(e.target.value)} />
      {mode === "daftar" && <input placeholder="No WA, cth 0812xxxx" value={wa} onChange={(e) => setWa(e.target.value)} />}
      <input placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      <button className="btn" onClick={submit}>{mode === "daftar" ? "Daftar Sekarang" : "Masuk"}</button>
      <p className="muted"><small>Setelah daftar, statusmu <b>pending</b> sampai di-approve admin.</small></p>
    </div>
  );
}
