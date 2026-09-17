"use client";
import { useEffect, useState } from "react";
import { load, save, walletOf, totalKredit, uid } from "../../lib/store";

// GANTI dengan QRIS & rekening komunitas aslimu di sini:
const QRIS_INFO = "QRIS Komunitas — [Nama] • [No. QRIS]";
const REK_INFO = "Transfer — Bank [___] No [___] a.n. [___]";

export default function Topup() {
  const [db, setDb] = useState<any>(null);
  const [paket, setPaket] = useState<"1x" | "4x">("4x");
  const [metode, setMetode] = useState("qris");
  const [bukti, setBukti] = useState("");
  const [catatan, setCatatan] = useState("");
  useEffect(() => { setDb(load()); }, []);
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  if (!me) return <div className="card"><h3>Login dulu yuk 🔐</h3></div>;

  const harga = paket === "1x" ? 25000 : 90000;
  const klaimAktif = db.txs.find((t: any) => t.userId === me.id && t.status === "pending");

  const kirim = () => {
    if (klaimAktif) return alert("Masih ada klaim menunggu verifikasi. Tunggu admin proses dulu ya.");
    if ((metode === "qris" || metode === "transfer") && !bukti && !confirm("Belum isi info bukti. Tetap kirim? (lebih cepat diverifikasi kalau ada bukti)")) return;
    const d = load();
    d.txs.push({
      id: uid(), userId: me.id,
      label: `Klaim top-up ${paket} via ${metode} (Rp${harga.toLocaleString("id-ID")})`,
      kreditPaket: 0, kreditReguler: 0, rupiah: harga,
      metode: `klaim_${metode}`, tanggal: new Date().toISOString(), status: "pending",
      paket, bukti, catatan,
    });
    save(d); setDb(load()); setBukti(""); setCatatan("");
    alert("✅ Konfirmasi terkirim! Tunggu admin cek & approve. Kredit masuk setelah disetujui.");
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
        {metode === "qris" && <div className="banner info">📱 Bayar ke: <b>{QRIS_INFO}</b><br />Nominal pas Rp{harga.toLocaleString("id-ID")}, lalu konfirmasi di bawah.</div>}
        {metode === "transfer" && <div className="banner info">🏦 Transfer ke: <b>{REK_INFO}</b><br />Nominal pas Rp{harga.toLocaleString("id-ID")}, lalu konfirmasi di bawah.</div>}
        {metode === "cash" && <div className="banner warn">💵 Cash: bayar langsung ke admin di lapangan. Admin bisa input tanpa klaim — tapi boleh juga kirim konfirmasi ini.</div>}
        {(metode === "qris" || metode === "transfer") && (
          <input placeholder="Info bukti, cth: 'BCA 14.32 Budi' / nama file struk" value={bukti} onChange={(e) => setBukti(e.target.value)} />
        )}
        <input placeholder="Catatan (opsional), cth: titip ke Andi" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        <button className="btn" onClick={kirim}>Kirim Konfirmasi ke Admin ➜</button>
      </div>

      <div className="card">
        <h4>🧾 Riwayatku</h4>
        <div className="tblwrap"><table>
          <thead><tr><th>Waktu</th><th>Keterangan</th><th>Status</th></tr></thead>
          <tbody>
            {mine.map((t: any) => (
              <tr key={t.id}><td>{t.tanggal.slice(5, 16).replace("T", " ")}</td>
                <td>{t.metode === "bantuan_privat" ? "🎗️ Kredit admin" : t.label}<br /><small className="muted">{t.catatan || ""}</small></td>
                <td>{t.status === "pending" ? <span className="badge yellow">⏳ Dicek</span> : t.status === "rejected" ? <span className="badge red">Ditolak</span> : <span className="badge green">✅ OK</span>}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
