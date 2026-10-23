"use client";
import { useState } from "react";
import { signUp, signIn, setujuAkad } from "../lib/data";
import { supa } from "../lib/supa";
import { AKAD_JUDUL, AKAD_TEKS, AKAD_CHECKBOXES, AKAD_VERSION } from "../lib/akad";

export function AuthPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"daftar" | "login">("daftar");
  const [nama, setNama] = useState(""); const [wa, setWa] = useState("");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<boolean[]>(Array(AKAD_CHECKBOXES.length).fill(false));
  const [final, setFinal] = useState(false);
  const [showAkad, setShowAkad] = useState(false);
  const needAkad = mode === "daftar";
  const allAkad = !needAkad || (checks.every(Boolean) && final);

  const submit = async () => {
    setMsg(""); setBusy(true);
    try {
      if (mode === "daftar") {
        if (!nama || !wa || !email || !pass) { setMsg("Isi nama, WA, email, dan password dulu."); setBusy(false); return; }
        if (!allAkad) { setMsg("Centang semua akad dulu, wajib untuk daftar."); setBusy(false); return; }
        await signUp(email.trim(), pass, nama.trim(), wa.trim());
        try { const { data } = await supa().auth.getSession(); const uid = data.session?.user?.id; if (uid) await setujuAkad(uid, AKAD_VERSION); } catch {}
        setMsg("Terdaftar. Menunggu approve admin.");
      } else {
        if (!email || !pass) { setMsg("Isi email dan password."); setBusy(false); return; }
        await signIn(email.trim(), pass);
      }
      onDone();
    } catch (e: any) { setMsg(e.message || "Gagal, coba lagi."); }
    setBusy(false);
  };

  return (
    <div id="akun">
      <div className="row" style={{ marginBottom: 10 }}>
        <button className={`btn sm ${mode === "daftar" ? "" : "ghost"}`} onClick={() => setMode("daftar")}>Daftar baru</button>
        <button className={`btn sm ${mode === "login" ? "" : "ghost"}`} onClick={() => setMode("login")}>Sudah punya akun</button>
      </div>
      {mode === "daftar" && (
        <div className="pricing" role="group" aria-label="Pilihan paket pendaftaran">
          <div aria-pressed="false"><span className="muted">Sekali main</span><br /><b>Rp25.000</b><br /><small className="muted">1 kredit, GK Rp15.000</small></div>
          <div aria-pressed="true"><span className="tag">Jadi member</span><span className="muted">Paket 4x main</span><br /><b>Rp90.000</b><br /><small className="muted">4 kredit, member permanen, GK Rp50.000</small></div>
        </div>
      )}
      {mode === "daftar" && (<>
        <label className="field"><span>Nama lengkap</span><input value={nama} onChange={(e) => setNama(e.target.value)} /></label>
        <label className="field"><span>No. WhatsApp</span><input placeholder="0812xxxx" value={wa} onChange={(e) => setWa(e.target.value)} /></label>
      </>)}
      <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Password</span><input type="password" placeholder="Minimal 6 karakter" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
      {mode === "daftar" && (
        <div className="panel" style={{ margin: "10px 0", padding: 14, background: "var(--surface-2)" }}>
          {!showAkad ? (
            <button className="linkbtn" onClick={() => setShowAkad(true)}>Baca dan setujui akad</button>
          ) : (
            <>
              <h4>{AKAD_JUDUL}</h4>
              <div className="doc-scroll" style={{ fontSize: 12, marginTop: 8 }}>{AKAD_TEKS}</div>
            </>
          )}
          {showAkad && (
            <div style={{ marginTop: 10 }}>
              {AKAD_CHECKBOXES.map((t, i) => (
                <label key={i} className="check"><input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((a) => a.map((v, k) => k === i ? e.target.checked : v))} /> <span>{t}</span></label>
              ))}
              <label className="check strong"><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} /> <span>Saya telah membaca, memahami, dan menyetujui Syarat dan Ketentuan Membership Futsal.</span></label>
            </div>
          )}
          <p className="muted" style={{ marginTop: 8 }}><small>Versi {AKAD_VERSION}. Wajib dicentang semua untuk daftar.</small></p>
        </div>
      )}
      <button className="btn block" disabled={busy} onClick={submit}>{busy ? "Memproses..." : mode === "daftar" ? "Daftar sekarang" : "Masuk"}</button>
      {msg && <p style={{ marginTop: 8, fontSize: 13 }}>{msg}</p>}
      {mode === "daftar" && <p className="muted" style={{ marginTop: 6 }}><small>Setelah daftar, statusmu pending sampai di-approve admin.</small></p>}
    </div>
  );
}

/** Panel wajib bagi user yang belum menyetujui AKAD_VERSION saat ini. */
export function AkadGate({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [checks, setChecks] = useState<boolean[]>(Array(AKAD_CHECKBOXES.length).fill(false));
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
    <div className="panel gold">
      <h3>Akad membership wajib disetujui</h3>
      {!show ? (
        <>
          <p className="muted"><small>{AKAD_JUDUL}, baca lengkap sebelum menyetujui.</small></p>
          <button className="btn ghost sm" onClick={() => setShow(true)}>Baca syarat dan ketentuan</button>
        </>
      ) : <div className="doc-scroll">{AKAD_TEKS}</div>}
      <div style={{ marginTop: 10 }}>
        {AKAD_CHECKBOXES.map((t, i) => (
          <label key={i} className="check"><input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((a) => a.map((v, k) => k === i ? e.target.checked : v))} /> <span>{t}</span></label>
        ))}
        <label className="check strong"><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} /> <span>Saya telah membaca, memahami, dan menyetujui Syarat dan Ketentuan Membership Futsal.</span></label>
      </div>
      <button className="btn" disabled={!all || busy} onClick={kirim}>{busy ? "Menyimpan..." : "Saya setuju dan lanjut"}</button>
      <p className="muted" style={{ marginTop: 8 }}><small>Versi {AKAD_VERSION}. Wajib untuk lanjut pakai web.</small></p>
    </div>
  );
}
