"use client";
import { useEffect, useState } from "react";
import { walletOf, totalKredit } from "../../lib/store";
import { fetchAll, kirimKlaim } from "../../lib/db";

export default function Topup() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [paket, setPaket] = useState<"1x" | "4x">("4x");
  const [metode, setMetode] = useState("qris");
  const [bukti, setBukti] = useState("");
  const [catatan, setCatatan] = useState("");
  const reload = () => fetchAll().then(setDb).catch((e: any) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  if (!me) return <div className="card"><h3>Login dulu yuk 🔐</h3></div>;

  const harga = paket === "1x" ? 25000 : 90000;
  const klaimAktif = db.txs.find((t: any) => t.userId === me.id && t.status === "pending");

  const kirim = async () => {
    if (klaimAktif) return alert("Masih ada klaim menunggu verifikasi. Tunggu admin proses dulu ya.");
    if ((metode === "qris" || metode === "transfer") && !bukti && !confirm("Belum isi info bukti. Tetap kirim?")) return;
    setBusy(true);
    try {
      await kirimKlaim(me.id, paket, metode, harga, bukti, catatan);
      setBukti(""); setCatatan("");
      await reload();
      alert("✅ Konfirmasi terkirim! Tunggu admin cek & approve. Kredit masuk setelah disetujui.");
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const mine = db.txs.filter((t: any) => t.userId === me.id).slice().reverse();

  return (
    <div>
      <div className="saldo">
        <small>Saldomu sekarang {me.is_member ? "⭐ Member" : ""}</small>
        <div className="num">{totalKredit(walletOf(db, me.id))} kredit</div>
        <small>Paket {walletOf(db, me.id).paket} • Reguler {walletOf(db, me.id).reguler} • 1 kredit = 1x main</small>
      </div>

      {klaimAktif && <div className="banner warn">⏳ Klaim {klaimAktif.paket} via {klaimAktif.metode} sedang dicek admin. Kredit masuk setelah disetujui.</div>}

      <div className="card">
        <h3>💳 Top-up (bayar manual)</h3>
        <div className="pricegrid">
          <div className={`price ${paket === "1x" ? "sel" : ""}`} onClick={() => setPaket("1x")}>
            <span className="muted">Sekali main</span><br /><b>Rp25rb</b><br /><small className="muted">dapat 1 kredit</small>
          </div>
          <div className={`price hot ${paket === "4x" ? "sel" : ""}`} onClick={() => setPaket("4x")}>
            <span className="tag">JADI MEMBER ⭐</span><span className="muted">Paket 4x main</span><br /><b>Rp90rb</b><br /><small className="muted">dapat 4 kredit + status member permanen</small>
          </div>
        </div>
        <label><small className="muted"><b>Cara bayar</b></small></label>
        <select value={metode} onChange={(e) => setMetode(e.target.value)}>
          <option value="qris">QRIS komunitas</option>
          <option value="transfer">Transfer bank</option>
          <option value="cash">Cash (titip / di lapangan)</option>
        </select>
        {metode === "qris" && <div className="banner info">📱 Bayar ke QRIS komunitas nominal pas Rp{harga.toLocaleString("id-ID")}, lalu konfirmasi di bawah. (Detail QRIS tanya admin di menu Kontak.)</div>}
        {metode === "transfer" && <div className="banner info">🏦 Transfer nominal pas Rp{harga.toLocaleString("id-ID")}, lalu konfirmasi di bawah. (No. rekening tanya admin di menu Kontak.)</div>}
        {metode === "cash" && <div className="banner warn">💵 Cash: bayar langsung ke admin di lapangan. Admin bisa input tanpa klaim — tapi boleh juga kirim konfirmasi ini.</div>}
        {(metode === "qris" || metode === "transfer") && (
          <input placeholder="Info bukti, cth: 'BCA 14.32 Budi'" value={bukti} onChange={(e) => setBukti(e.target.value)} />
        )}
        <input placeholder="Catatan (opsional), cth: titip ke Andi" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        <button className="btn" disabled={busy} onClick={kirim}>Kirim Konfirmasi ke Admin ➜</button>
      </div>

      <div className="card">
        <h4>🧾 Riwayatku</h4>
        <div className="tblwrap"><table>
          <thead><tr><th>Waktu</th><th>Keterangan</th><th>Status</th></tr></thead>
          <tbody>
            {mine.map((t: any) => (
              <tr key={t.id}><td>{String(t.tanggal).slice(5, 16).replace("T", " ")}</td>
                <td>{t.metode === "bantuan_privat" ? "🎗️ Kredit admin" : t.label}<br /><small className="muted">{t.catatan || ""}</small></td>
                <td>{t.status === "pending" ? <span className="badge yellow">⏳ Dicek</span> : t.status === "rejected" ? <span className="badge red">Ditolak</span> : <span className="badge green">✅ OK</span>}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
