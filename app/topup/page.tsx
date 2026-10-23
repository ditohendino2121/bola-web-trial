"use client";
import { useState } from "react";
import { useDB, PageHead, Loading, LoadError, Empty } from "../../components/ui";
import { walletOf, totalKredit, HARGA } from "../../lib/rules";
import { klaimTopup } from "../../lib/data";

export default function Topup() {
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [paket, setPaket] = useState<"1x" | "4x">("4x");
  const [isGK, setIsGK] = useState(false);
  const [metode, setMetode] = useState("qris");
  const [bukti, setBukti] = useState("");
  const [catatan, setCatatan] = useState("");

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="top-up" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  if (!me) return <div className="page wrap"><Empty title="Login dulu untuk top-up" /></div>;

  const harga = paket === "1x" ? (isGK ? HARGA.sekali.GK : HARGA.sekali.pemain) : (isGK ? HARGA.paket4.GK : HARGA.paket4.pemain);
  const kreditDapat = paket === "1x" ? 1 : 4;
  const klaimAktif = db.txs.find((t) => t.userId === me.id && t.status === "pending");

  const kirim = async () => {
    if (klaimAktif) return alert("Masih ada klaim menunggu verifikasi. Tunggu admin proses dulu.");
    if ((metode === "qris" || metode === "transfer") && !bukti && !confirm("Belum isi info bukti. Tetap kirim?")) return;
    setBusy(true);
    try {
      await klaimTopup(me.id, paket, metode, harga, bukti, catatan, isGK);
      setBukti(""); setCatatan("");
      await reload();
      alert("Konfirmasi terkirim. Tunggu admin cek dan approve, kredit masuk setelah disetujui.");
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const mine = db.txs.filter((t) => t.userId === me.id).slice().reverse();
  const salin = async (teks: string, label: string) => {
    try { await navigator.clipboard.writeText(teks); alert(`${label} tersalin.`); } catch { prompt(`Salin ${label}:`, teks); }
  };

  return (
    <div>
      <PageHead title="Top-up kredit" desc="1 kredit = 1x main. Pilih paket, cara bayar, lalu kirim konfirmasi." />
      <div className="page wrap">
        {klaimAktif && <div className="note warn">Klaim {klaimAktif.paket} via {klaimAktif.metode} sedang dicek admin. Kredit masuk setelah disetujui.</div>}

        <div className="split">
          <div className="panel">
            <label className="field"><span>Saya top-up sebagai</span>
              <select value={isGK ? "gk" : "pemain"} onChange={(e) => setIsGK(e.target.value === "gk")}>
                <option value="pemain">Pemain — Rp25.000 / paket Rp90.000</option>
                <option value="gk">Kiper (GK) — Rp15.000 / paket Rp50.000</option>
              </select>
            </label>
            <div className="pricing" role="group" aria-label="Pilih paket">
              <div aria-pressed={paket === "1x"} onClick={() => setPaket("1x")}><span className="muted">Sekali main</span><br /><b>Rp{(isGK ? HARGA.sekali.GK : HARGA.sekali.pemain).toLocaleString("id-ID")}</b><br /><small className="muted">1 kredit{isGK ? " GK" : ""}</small></div>
              <div aria-pressed={paket === "4x"} onClick={() => setPaket("4x")}><span className="tag">Jadi member</span><span className="muted">Paket 4x main</span><br /><b>Rp{(isGK ? HARGA.paket4.GK : HARGA.paket4.pemain).toLocaleString("id-ID")}</b><br /><small className="muted">4 kredit{isGK ? " GK" : ""}, member permanen</small></div>
            </div>
            <label className="field"><span>Cara bayar</span>
              <select value={metode} onChange={(e) => setMetode(e.target.value)}>
                <option value="qris">QRIS komunitas</option>
                <option value="transfer">Transfer bank</option>
                <option value="cash">Cash (titip / di lapangan)</option>
              </select>
            </label>
            {metode === "qris" && (
              <div className="qrbox">
                <p style={{ margin: "0 0 6px", fontWeight: 800 }}>Scan QRIS MUBA SPORT OFFICIAL</p>
                <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Nominal pas <b>Rp{harga.toLocaleString("id-ID")}</b> ({paket}{isGK ? ", GK" : ""})</p>
                <a href="/qris-muba.jpg" target="_blank" rel="noreferrer"><img src="/qris-muba.jpg" alt="QRIS MUBA SPORT OFFICIAL NMID ID1026573397951" /></a>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>MUBA SPORT OFFICIAL, NMID ID1026573397951, bukupay</p>
                <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>
                  <button className="btn ghost sm" onClick={() => salin("ID1026573397951", "NMID")}>Salin NMID</button>
                  <button className="btn ghost sm" onClick={() => salin(String(harga), "Nominal")}>Salin nominal</button>
                </div>
              </div>
            )}
            {metode === "transfer" && (
              <div className="panel" style={{ background: "var(--surface-2)" }}>
                <p style={{ margin: "0 0 4px", fontWeight: 800 }}>Transfer bank</p>
                <div className="kv"><span className="muted">Bank</span><b>BCA Syariah</b></div>
                <div className="kv"><span className="muted">No. rekening</span><b style={{ fontSize: 16 }}>036.000.7496</b></div>
                <div className="kv"><span className="muted">a.n</span><b>Muhamad Ali Sodiqin</b></div>
                <div className="kv" style={{ borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 4 }}><span className="muted">Nominal pas</span><b style={{ color: "var(--gold-ink)" }}>Rp{harga.toLocaleString("id-ID")}</b></div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn ghost sm" onClick={() => salin("0360007496", "No. rekening")}>Salin no. rekening</button>
                  <button className="btn ghost sm" onClick={() => salin(String(harga), "Nominal")}>Salin nominal</button>
                </div>
              </div>
            )}
            {metode === "cash" && <div className="note info">Cash: bayar langsung ke admin di lapangan. Admin bisa input tanpa klaim, tapi boleh juga kirim konfirmasi ini.</div>}
            {(metode === "qris" || metode === "transfer") && <label className="field"><span>Info bukti bayar</span><input placeholder="cth: BCA 14.32 Budi" value={bukti} onChange={(e) => setBukti(e.target.value)} /></label>}
            <label className="field"><span>Catatan (opsional)</span><input placeholder="cth: titip ke Andi" value={catatan} onChange={(e) => setCatatan(e.target.value)} /></label>
            <button className="btn block" disabled={busy} onClick={kirim}>Kirim klaim top-up Rp{harga.toLocaleString("id-ID")}</button>
          </div>

          <div className="panel dark">
            <small className="muted">Saldomu sekarang{me.is_member ? ", member" : ""}</small>
            <div className="bignum" style={{ margin: "4px 0" }}>{totalKredit(walletOf(db, me.id))}</div>
            <small className="muted">Paket {walletOf(db, me.id).paket} &middot; Reguler {walletOf(db, me.id).reguler} &middot; GK {walletOf(db, me.id).paket_gk + walletOf(db, me.id).reguler_gk}</small>
            <div className="statrow" style={{ borderColor: "var(--black-line)", marginTop: 14 }}><span className="muted">Paket dipilih</span><span>+{kreditDapat} kredit{isGK ? " GK" : ""}</span></div>
          </div>
        </div>

        <div className="panel">
          <h3>Riwayatku</h3>
          <div className="tablewrap"><table className="table compact">
            <thead><tr><th>Waktu</th><th>Keterangan</th><th>Status</th></tr></thead>
            <tbody>
              {mine.map((t) => (
                <tr key={t.id}>
                  <td>{String(t.tanggal).slice(5, 16).replace("T", " ")}</td>
                  <td>{t.metode === "bantuan_privat" ? "Kredit admin" : t.label}<br /><small className="muted">{t.catatan || ""}</small></td>
                  <td>{t.status === "pending" ? <span className="pill warn">Dicek</span> : t.status === "rejected" ? <span className="pill bad">Ditolak</span> : <span className="pill ok">OK</span>}</td>
                </tr>
              ))}
              {mine.length === 0 && <tr><td colSpan={3}><p className="muted" style={{ margin: "8px 0" }}>Belum ada riwayat.</p></td></tr>}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
