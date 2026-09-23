"use client";
import { useEffect, useState } from "react";
import { walletOf, totalKredit, HARGA } from "../../lib/store";
import { fetchAll, kirimKlaim } from "../../lib/db";

export default function Topup() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [paket, setPaket] = useState<"1x" | "4x">("4x");
  const [isGK, setIsGK] = useState(false);
  const [metode, setMetode] = useState("qris");
  const [bukti, setBukti] = useState("");
  const [catatan, setCatatan] = useState("");
  const reload = () =>fetchAll().then(setDb).catch((e: any) =>setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err"> {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) =>u.id === db.sessionId);
  if (!me) return <div className="card"><h3>Login dulu yuk </h3></div>;

  const harga = paket === "1x"
    ? (isGK ? HARGA.sekali.GK : HARGA.sekali.pemain)
    : (isGK ? HARGA.paket4.GK : HARGA.paket4.pemain);
  const klaimAktif = db.txs.find((t: any) =>t.userId === me.id && t.status === "pending");

  const kirim = async () => {
    if (klaimAktif) return alert("Masih ada klaim menunggu verifikasi. Tunggu admin proses dulu ya.");
    if ((metode === "qris" || metode === "transfer") && !bukti && !confirm("Belum isi info bukti. Tetap kirim?")) return;
    setBusy(true);
    try {
      await kirimKlaim(me.id, paket, metode, harga, bukti, catatan, isGK);
      setBukti(""); setCatatan("");
      await reload();
      alert(" Konfirmasi terkirim! Tunggu admin cek & approve. Kredit masuk setelah disetujui.");
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const mine = db.txs.filter((t: any) =>t.userId === me.id).slice().reverse();
  const salin = async (teks: string, label: string) => {
    try { await navigator.clipboard.writeText(teks); alert(`${label} tersalin`); } catch { prompt(`Copy ${label}:`, teks); }
  };

  return (
    <div>
      <div className="saldo">
        <small>Saldomu sekarang {me.is_member ? " Member" : ""}</small>
        <div className="num">{totalKredit(walletOf(db, me.id))} kredit</div>
        <small>Paket {walletOf(db, me.id).paket} • Reguler {walletOf(db, me.id).reguler} • GK {walletOf(db, me.id).paket_gk + walletOf(db, me.id).reguler_gk} • 1 kredit = 1x main</small>
      </div>

      {klaimAktif && <div className="banner warn">Klaim {klaimAktif.paket} via {klaimAktif.metode} sedang dicek admin. Kredit masuk setelah disetujui.</div>}

      <div className="card">
        <h3>Top-up (bayar manual)</h3>
        <label><small className="muted"><b>Saya top-up sebagai</b></small></label>
        <select value={isGK ? "gk" : "pemain"} onChange={(e) =>setIsGK(e.target.value === "gk")}>
          <option value="pemain">Pemain — 25rb / paket 90rb</option>
          <option value="gk">Kiper (GK) — 15rb / paket 50rb</option>
        </select>
        <div className="pricegrid">
          <div className={`price ${paket === "1x" ? "sel" : ""}`} onClick={() =>setPaket("1x")}>
            <span className="muted">Sekali main</span><br /><b>{isGK ? "Rp15rb" : "Rp25rb"}</b><br /><small className="muted">dapat 1 kredit{isGK ? " GK" : ""}</small>
          </div>
          <div className={`price hot ${paket === "4x" ? "sel" : ""}`} onClick={() =>setPaket("4x")}>
            <span className="tag">JADI MEMBER </span><span className="muted">Paket 4x main</span><br /><b>{isGK ? "Rp50rb" : "Rp90rb"}</b><br /><small className="muted">dapat 4 kredit{isGK ? " GK" : ""} + status member permanen</small>
          </div>
        </div>
        <label><small className="muted"><b>Cara bayar</b></small></label>
        <select value={metode} onChange={(e) =>setMetode(e.target.value)}>
          <option value="qris">QRIS komunitas</option>
          <option value="transfer">Transfer bank</option>
          <option value="cash">Cash (titip / di lapangan)</option>
        </select>
        {metode === "qris" && (
          <div className="card" style={{ background: "#141416", borderColor: "var(--line)", marginTop: 8, textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 14, color: "#fff" }}>Scan QRIS MUBA SPORT OFFICIAL</p>
            <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Nominal pas <b style={{ color: "#fff" }}>Rp{harga.toLocaleString("id-ID")}</b> — {paket} {isGK ? "(GK)" : ""}</p>
            <a href="/qris-muba.jpg" target="_blank" rel="noreferrer"><img src="/qris-muba.jpg" alt="QRIS MUBA SPORT OFFICIAL NMID ID1026573397951" style={{ width: 280, maxWidth: "100%", borderRadius: 16, border: "1px solid var(--line)", display: "block", margin: "0 auto" }} /></a>
            <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>MUBA SPORT OFFICIAL • NMID: ID1026573397951 • bukupay</p>
            <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>
              <button className="btn secondary small" onClick={()=> salin("ID1026573397951", "NMID")}>Salin NMID</button>
              <button className="btn secondary small" onClick={()=> salin(String(harga), "Nominal")}>Salin Nominal</button>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Transfer via QRIS tidak perlu isi berita. Setelah scan, konfirmasi di bawah.</p>
          </div>
        )}
        {metode === "transfer" && (
          <div className="card" style={{ background: "#141416", borderColor: "var(--line)", marginTop: 8 }}>
            <p style={{ margin: "0 0 4px", fontWeight: 800, color: "#fff" }}>Transfer Bank</p>
            <div style={{ background: "#0F0F10", border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginTop: 6 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Bank</div><div style={{ fontWeight: 800, color: "#fff" }}>BCA Syariah</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>No. Rekening</div><div style={{ fontWeight: 800, color: "#fff", fontSize: 18, letterSpacing: 0.02, wordBreak: "break-all" }}>036.000.7496</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>a.n</div><div style={{ fontWeight: 800, color: "#fff" }}>Muhamad Ali Sodiqin</div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", fontSize: 13 }}><span className="muted">Nominal pas:</span> <b style={{ color: "var(--gold)" }}>Rp{harga.toLocaleString("id-ID")}</b> <span className="badge gold" style={{ marginLeft: 6 }}>{paket} {isGK ? "(GK)" : ""}</span></div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn secondary small" onClick={()=> salin("0360007496", "No. Rek")}>Salin No. Rek</button>
              <button className="btn secondary small" onClick={()=> salin(String(harga), "Nominal")}>Salin Nominal</button>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Pakai angka tanpa titik saat paste di m-banking. Setelah transfer, konfirmasi di bawah.</p>
          </div>
        )}
        {metode === "cash" && <div className="banner warn">Cash: bayar langsung ke admin di lapangan. Admin bisa input tanpa klaim — tapi boleh juga kirim konfirmasi ini.</div>}
        {(metode === "qris" || metode === "transfer") && (
          <input placeholder="Info bukti, cth: 'BCA 14.32 Budi'" value={bukti} onChange={(e) =>setBukti(e.target.value)} />
        )}
        <input placeholder="Catatan (opsional), cth: titip ke Andi" value={catatan} onChange={(e) =>setCatatan(e.target.value)} />
        <button className="btn" disabled={busy} onClick={kirim}>Kirim Konfirmasi ke Admin</button>
      </div>

      <div className="card">
        <h4>Riwayatku</h4>
        <div className="tblwrap"><table>
          <thead><tr><th>Waktu</th><th>Keterangan</th><th>Status</th></tr></thead>
          <tbody>
            {mine.map((t: any) => (
              <tr key={t.id}><td>{String(t.tanggal).slice(5, 16).replace("T", " ")}</td>
                <td>{t.metode === "bantuan_privat" ? " Kredit admin" : t.label}<br /><small className="muted">{t.catatan || ""}</small></td>
                <td>{t.status === "pending" ? <span className="badge yellow">Dicek</span> : t.status === "rejected" ? <span className="badge red">Ditolak</span> : <span className="badge green">OK</span>}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
