"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Loading, LoadError, Empty, DateBox } from "../../components/ui";
import { walletOf, totalKredit, tunggakanOf, langsungBelumLunas, totalTunggakanRp } from "../../lib/rules";
import { signOut, gantiPasswordSendiri } from "../../lib/data";

function badgeFor(status: string) {
  if (status === "confirmed_lunas") return <span className="pill ok">Lunas</span>;
  if (status === "confirmed_langsung") return <span className="pill info">Di tempat</span>;
  if (status === "no_show") return <span className="pill neutral">No-show</span>;
  return <span className="pill bad">Wajib bayar</span>;
}

function GantiPassword() {
  const [baru, setBaru] = useState(""); const [ulang, setUlang] = useState("");
  const [pesan, setPesan] = useState<{ jenis: "ok" | "err"; teks: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const simpan = async () => {
    setPesan(null);
    if (baru.length < 6) return setPesan({ jenis: "err", teks: "Password minimal 6 karakter." });
    if (baru !== ulang) return setPesan({ jenis: "err", teks: "Ulangi password belum sama." });
    setBusy(true);
    try { await gantiPasswordSendiri(baru); setBaru(""); setUlang(""); setPesan({ jenis: "ok", teks: "Password berhasil diganti. Pakai password baru saat login berikutnya." }); }
    catch (e: any) { setPesan({ jenis: "err", teks: e.message }); }
    setBusy(false);
  };
  return (
    <div className="panel">
      <h3>Ganti password</h3>
      <div className="grid2">
        <label className="field"><span>Password baru</span><input type="password" autoComplete="new-password" value={baru} onChange={(e) => setBaru(e.target.value)} placeholder="Minimal 6 karakter" /></label>
        <label className="field"><span>Ulangi password baru</span><input type="password" autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} /></label>
      </div>
      <button className="btn" disabled={busy} onClick={simpan}>{busy ? "Menyimpan..." : "Simpan password baru"}</button>
      {pesan && <div className={`note ${pesan.jenis}`} role="status" style={{ marginTop: 10 }}>{pesan.teks}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { db, error, reload } = useDB();
  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="data kamu" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  if (!me) return <div className="page wrap"><Empty title="Login dulu" action={<Link href="/"><button className="btn" style={{ marginTop: 10 }}>Ke beranda</button></Link>} /></div>;

  const mine = db.rsvps.filter((r) => r.userId === me.id && r.status !== "cancelled");
  const todayISO = new Date().toISOString().slice(0, 10);
  const withSchedule = mine.map((r) => ({ r, s: db.schedules.find((x) => x.id === r.scheduleId) })).filter((x) => x.s);
  const mendatang = withSchedule.filter((x) => x.s!.tanggal >= todayISO).sort((a, b) => a.s!.tanggal.localeCompare(b.s!.tanggal));
  const riwayat = withSchedule.filter((x) => x.s!.tanggal < todayISO).sort((a, b) => b.s!.tanggal.localeCompare(a.s!.tanggal));
  const tung = tunggakanOf(db, me.id);
  const nLangsung = langsungBelumLunas(db, me.id).length;
  const nominalUtang = totalTunggakanRp(db, me.id);
  const klaim = db.txs.find((t) => t.userId === me.id && t.status === "pending");
  const transaksi = db.txs.filter((t) => t.userId === me.id).slice().reverse().slice(0, 5);

  return (
    <div>
      <PageHead title={me.nama} desc={`${me.is_member ? "Member" : "Non-member"} — status ${me.status}`} />
      <div className="page wrap">
        <div className="panel dark">
          <small className="muted">Kredit kamu</small>
          <div className="bignum" style={{ margin: "4px 0" }}>{totalKredit(walletOf(db, me.id))}</div>
          <small className="muted">Paket {walletOf(db, me.id).paket} &middot; Reguler {walletOf(db, me.id).reguler} &middot; GK {walletOf(db, me.id).paket_gk + walletOf(db, me.id).reguler_gk}</small>
          <div className="row" style={{ marginTop: 14 }}>
            <Link href="/topup" style={{ flex: 1 }}><button className="btn block">Top-up</button></Link>
            <Link href="/jadwal" style={{ flex: 1 }}><button className="btn ghost block" style={{ borderColor: "var(--black-line)", color: "var(--on-black)" }}>Jadwal</button></Link>
          </div>
        </div>

        {tung.length > 0 && <div className="note err">Tagihan terbuka {tung.length}x (Rp{nominalUtang.toLocaleString("id-ID")}). Lunasi ke admin dulu untuk buka list berikutnya.</div>}
        {tung.length === 0 && nLangsung > 0 && <div className="note warn">Ada {nLangsung}x bayar-di-tempat yang belum dikonfirmasi lunas admin.</div>}
        {klaim && <div className="note warn">Klaim top-up {klaim.paket} sedang dicek admin.</div>}
        {me.status === "pending" && <div className="note warn">Menunggu approve admin.</div>}

        <div className="panel">
          <h3>Jadwal mendatang ({mendatang.length})</h3>
          {mendatang.length === 0 && <p className="muted">Belum ikut jadwal mendatang. Yuk isi list.</p>}
          {mendatang.map(({ r, s }) => (
            <div key={r.id} className="slot" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
              <DateBox iso={s!.tanggal} />
              <div style={{ flex: 1 }}>
                <b>{s!.jam}</b> <span className="pill neutral">{r.posisi}</span> {badgeFor(r.status)} {r.is_alihan && <span className="pill warn">Alihan</span>}
                {(r.status === "confirmed_lunas" || r.status === "confirmed_langsung") && !r.is_alihan && <p className="muted" style={{ margin: "4px 0 0" }}><small>Butuh pengganti? Hubungi admin, admin yang alihkan slotmu. Deposit hangus, urusan ganti privat.</small></p>}
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>Riwayat main ({riwayat.length})</h3>
          {riwayat.length === 0 ? <p className="muted">Belum ada riwayat.</p> : (
            <div className="tablewrap scroll"><table className="table compact">
              <thead><tr><th>Tanggal</th><th>Posisi</th><th>Status</th></tr></thead>
              <tbody>{riwayat.map(({ r, s }) => (<tr key={r.id}><td>{s!.tanggal}</td><td>{r.posisi}</td><td>{badgeFor(r.status)}</td></tr>))}</tbody>
            </table></div>
          )}
        </div>

        <div className="panel">
          <h3>5 transaksi terakhir</h3>
          {transaksi.length === 0 ? <p className="muted">Belum ada transaksi.</p> : (
            <div className="tablewrap"><table className="table compact">
              <thead><tr><th>Waktu</th><th>Keterangan</th><th>Status</th></tr></thead>
              <tbody>{transaksi.map((t) => (<tr key={t.id}><td>{String(t.tanggal).slice(5, 16).replace("T", " ")}</td><td>{t.metode === "bantuan_privat" ? "Kredit admin" : t.label}</td><td>{t.status === "pending" ? <span className="pill warn">Dicek</span> : t.status === "rejected" ? <span className="pill bad">Ditolak</span> : <span className="pill ok">OK</span>}</td></tr>))}</tbody>
            </table></div>
          )}
        </div>

        <GantiPassword />

        <div className="panel">
          <h3>Data akun</h3>
          <div className="kv"><span className="muted">Nama</span><b>{me.nama}</b></div>
          <div className="kv"><span className="muted">WA</span><b>{me.wa}</b></div>
          <div className="kv"><span className="muted">Email</span><b>{me.email}</b></div>
          <div className="kv"><span className="muted">Status</span><b>{me.status}</b></div>
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => signOut().then(reload)}>Keluar</button>
        </div>
      </div>
    </div>
  );
}
