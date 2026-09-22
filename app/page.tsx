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
            <div className="price"><span className="muted">Sekali main</span><br /><b>Rp25rb</b><br /><small className="muted">= 1 kredit • GK Rp15rb</small></div>
            <div className="price hot sel"><span className="tag">JADI MEMBER ⭐</span><span className="muted">Paket 4x main</span><br /><b>Rp90rb</b><br /><small className="muted">= 4 kredit + member permanen • GK Rp50rb</small></div>
          </div>
          <AuthBox onDone={reload} />
        </div>
      ) : (
        <div>
          <div className="saldo">
            <small>Halo, {me.nama}! • {me.role} • {me.status} {me.is_member ? "• ⭐ Member" : ""}</small>
            <div className="num">{totalKredit(walletOf(db, me.id))} kredit</div>
            <small>Paket {walletOf(db, me.id).paket} • Reguler {walletOf(db, me.id).reguler} • GK {walletOf(db, me.id).paket_gk + walletOf(db, me.id).reguler_gk}</small>
            <div className="row" style={{ marginTop: 12 }}>
              <Link href="/topup" style={{ flex: 1 }}><button className="btn warn" style={{ background: "#D4AF37", color: "#141005" }}>💳 Top-Up</button></Link>
              <Link href="/jadwal" style={{ flex: 1 }}><button className="btn" style={{ background: "#141005", border: "1px solid var(--gold-deep)" }}>📅 Isi List</button></Link>
            </div>
          </div>
          {me.status === "pending" && (
            <div className="banner warn">⏳ Akunmu menunggu approve admin. Hubungi pengurus di menu Kontak.</div>
          )}
          {(!me.setuju_akad || me.akad_version !== AKAD_VERSION) && (
            <AkadPrompt userId={me.id} onDone={reload} />
          )}
          {dikunciRSVP(db, me.id) && (
            <div className="banner err">⚠️ Ada pembayaran yang belum beres (tunggakan / bayar-di-tempat belum lunas) — lunasi ke admin dulu.</div>
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
    <div className="card" style={{ borderColor: "var(--gold-deep)", background: "#211a08" }}>
      <h3>📜 Akad Membership Wajib Disetujui</h3>
      {!show ? (
        <><p className="muted"><small>{AKAD_JUDUL} — klik untuk baca lengkap sebelum menyetujui.</small></p><button className="btn secondary" onClick={() => setShow(true)}>📖 Baca Syarat & Ketentuan</button></>
      ) : (
        <div style={{ maxHeight: 220, overflowY: "auto", background: "#0e0e10", border: "1px solid var(--line)", borderRadius: 12, padding: 12, whiteSpace: "pre-wrap", fontSize: 12 }}>{AKAD_TEKS}</div>
      )}
      <div style={{ marginTop: 10 }}>
        {AKAD_CHECKBOXES.map((t, i) => (
          <label key={i} style={{ display: "flex", gap: 8, margin: "6px 0", fontSize: 13 }}><input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((a) => a.map((v, k) => k === i ? e.target.checked : v))} /> {t}</label>
        ))}
        <label style={{ display: "flex", gap: 8, margin: "10px 0", fontWeight: 700, fontSize: 13, background: "rgba(212,175,55,0.12)", padding: 8, borderRadius: 8 }}><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} /> Saya telah membaca, memahami, dan menyetujui Syarat dan Ketentuan Membership Futsal.</label>
      </div>
      <button className="btn" disabled={!all || busy} onClick={kirim}>{busy ? "Menyimpan..." : "✅ Saya Setuju & Lanjut"}</button>
      <p className="muted"><small>Versi {AKAD_VERSION} • Wajib untuk lanjut pakai web.</small></p>
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
        // setujui akad untuk akun yang baru dibuat (jika sudah login)
        try { const { supa } = await import("../lib/supabase"); const { data } = await supa().auth.getSession(); const uid = data.session?.user?.id; if (uid) await setujuAkad(uid, AKAD_VERSION); } catch {}
        setMsg("✅ Terdaftar! Menunggu approve admin.");
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
      {mode === "daftar" && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, margin: "8px 0", background: "#211a08" }}>
          {!showAkad ? <button className="btn secondary small" onClick={() => setShowAkad(true)}>📜 Baca & Setujui Akad</button> : (
            <>
              <h4 style={{ margin: "4px 0" }}>{AKAD_JUDUL}</h4>
              <div style={{ maxHeight: 180, overflowY: "auto", background: "#0e0e10", border: "1px solid var(--line)", borderRadius: 10, padding: 10, whiteSpace: "pre-wrap", fontSize: 11 }}>{AKAD_TEKS}</div>
              <div style={{ marginTop: 8 }}>
                {AKAD_CHECKBOXES.map((t, i) => (
                  <label key={i} style={{ display: "flex", gap: 8, margin: "6px 0", fontSize: 12 }}><input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((a) => a.map((v, k) => k === i ? e.target.checked : v))} /> {t}</label>
                ))}
                <label style={{ display: "flex", gap: 8, margin: "8px 0", fontWeight: 700, fontSize: 12, background: "rgba(212,175,55,0.12)", padding: 8, borderRadius: 8 }}><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} /> Saya telah membaca, memahami, dan menyetujui Syarat dan Ketentuan Membership Futsal.</label>
              </div>
            </>
          )}
          <p className="muted"><small>Versi {AKAD_VERSION} • Wajib dicentang semua untuk daftar.</small></p>
        </div>
      )}
      <button className="btn" onClick={submit}>{mode === "daftar" ? "Daftar Sekarang" : "Masuk"}</button>
      {msg && <p>{msg}</p>}
      <p className="muted"><small>Setelah daftar, statusmu <b>pending</b> sampai di-approve admin.</small></p>
    </div>
  );
}
