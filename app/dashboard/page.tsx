"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { walletOf, totalKredit, tunggakanOf, langsungBelumLunas } from "../../lib/store";
import { fetchAll, signOut } from "../../lib/db";

export default function Dashboard() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const reload = () => fetchAll().then(setDb).catch((e: any) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  if (!me) return <div className="card"><h3>Login dulu yuk 🔐</h3><p><Link href="/">Ke Beranda</Link></p></div>;
  const mine = db.rsvps.filter((r: any) => r.userId === me.id && r.status !== "cancelled");
  const tung = tunggakanOf(db, me.id);
  const nLangsung = langsungBelumLunas(db, me.id).length;
  const klaim = db.txs.find((t: any) => t.userId === me.id && t.status === "pending");
  return (
    <div>
      <div className="saldo">
        <small>👤 {me.nama} {me.is_member ? "⭐ Member" : "• Non-member"} • {me.status}</small>
        <div className="num">{totalKredit(walletOf(db, me.id))} kredit</div>
        <small>Paket {walletOf(db, me.id).paket} • Reguler {walletOf(db, me.id).reguler}</small>
        {!me.is_member && <div style={{ marginTop: 8 }}><small>💡 Beli paket 90rb untuk jadi <b>member permanen</b> + bisa ikut liga!</small></div>}
        <div className="row" style={{ marginTop: 12 }}>
          <Link href="/topup" style={{ flex: 1 }}><button className="btn warn" style={{ background: "#D4AF37", color: "#141005" }}>💳 Top-Up</button></Link>
          <Link href="/jadwal" style={{ flex: 1 }}><button className="btn" style={{ background: "#141005", border: "1px solid var(--gold-deep)" }}>📅 Jadwal</button></Link>
        </div>
      </div>
      {tung.length > 0 && <div className="banner err">🔒 Punya tunggakan {tung.length}x (Rp{(25000 * tung.length).toLocaleString("id-ID")}). Lunasi ke admin dulu untuk buka list berikutnya.</div>}
      {tung.length === 0 && nLangsung > 0 && <div className="banner warn">💵 Ada {nLangsung}x bayar-di-tempat yang belum dikonfirmasi lunas admin. List berikutnya terkunci sampai lunas.</div>}
      {klaim && <div className="banner warn">⏳ Klaim top-up {klaim.paket} sedang dicek admin.</div>}
      {me.status === "pending" && <div className="banner warn">⏳ Menunggu approve admin.</div>}
      <div className="card">
        <h3>📅 Jadwalku ({mine.length})</h3>
        {mine.length === 0 && <p className="muted">Belum ikut jadwal apapun. Yuk isi list!</p>}
        {mine.map((r: any) => {
          const s = db.schedules.find((x: any) => x.id === r.scheduleId);
          const badge = r.status === "confirmed_lunas" ? <span className="badge green">✅ Lunas</span>
            : r.status === "confirmed_langsung" ? <span className="badge blue">💵 Di tempat</span>
            : r.status === "no_show" ? <span className="badge gray">🚫 No-show</span>
            : <span className="badge red">🔒 Wajib bayar</span>;
          return <p key={r.id}>📅 <b>{s?.tanggal}</b> {s?.jam} • <span className="badge gray">{r.posisi || ""}</span> {badge}</p>;
        })}
      </div>
      <button className="btn secondary small" onClick={() => signOut().then(reload)}>Logout</button>
    </div>
  );
}
