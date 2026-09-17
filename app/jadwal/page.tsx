"use client";
import { useEffect, useState } from "react";
import {
  load, save, hasUtang, uid, QUOTA_MAIN, POSISI_MAIN, countPosisi,
  kuotaAktif, quotaPosisi, lewatH2, fmtBatas, STATUS_LABEL,
  type PosisiMain, type RsvpMetode,
} from "../../lib/store";

export default function Jadwal() {
  const [db, setDb] = useState<any>(null);
  const [posisiPilih, setPosisiPilih] = useState<Record<string, PosisiMain>>({});
  useEffect(() => { setDb(load()); }, []);
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  if (!me) return <div className="card"><h3>Login dulu yuk 🔐</h3><p className="muted">Daftar / login di Beranda, gratis.</p></div>;
  if (me.status !== "approved") return <div className="card"><div className="banner warn">⏳ Akun <b>{me.nama}</b> masih <b>{me.status}</b>. Minta admin approve dulu ya.</div></div>;

  const ikut = (s: any, metode: RsvpMetode) => {
    const d = load();
    const posisi: PosisiMain = posisiPilih[s.id] || "Depan";
    const mine = d.rsvps.find((r: any) => r.scheduleId === s.id && r.userId === me.id && r.status !== "cancelled");
    if (mine) return alert("Kamu sudah isi list jadwal ini ✅");
    if (s.status === "full_booked") return alert("Lapangan full booked 🙏");
    if (s.status === "tutup") return alert("Jadwal ini ditutup admin.");
    const aktif = d.rsvps.filter((r: any) => r.scheduleId === s.id && r.status !== "cancelled");
    if (aktif.length >= kuotaAktif(s)) return alert("Kuotanya penuh 🙏 coba jadwal lain");
    const isiPos = aktif.filter((r: any) => (r.posisi || "Depan") === posisi).length;
    if (isiPos >= quotaPosisi(s, posisi)) return alert(`Slot ${posisi} penuh. Pilih posisi lain ya!`);
    if (metode !== "langsung" && hasUtang(d, me.id)) return alert("Masih ada tunggakan. Lunasi dulu baru bisa isi list lagi 🙏");
    if (metode === "langsung" && hasUtang(d, me.id)) return alert("Masih ada tunggakan. Lunasi dulu baru bisa isi list lagi 🙏");

    if (metode === "deposit") {
      const w = d.wallets[me.id] || { paket: 0, reguler: 0 };
      if (w.paket + w.reguler < 1) return alert("Kredit habis. Top-up dulu atau pilih cara bayar lain.");
      if (w.paket > 0) w.paket -= 1; else w.reguler -= 1;
      d.wallets[me.id] = w;
      d.rsvps.push({ id: uid(), scheduleId: s.id, userId: me.id, status: "confirmed_lunas", posisi, metode });
      d.txs.push({ id: uid(), userId: me.id, label: `Main ${s.tanggal} ${posisi} (potong 1 kredit)`, kreditPaket: 0, kreditReguler: 0, rupiah: 0, metode: "potong_deposit", tanggal: new Date().toISOString(), status: "success" });
    } else if (metode === "utang") {
      d.rsvps.push({ id: uid(), scheduleId: s.id, userId: me.id, status: "confirmed_utang", posisi, metode });
      d.txs.push({ id: uid(), userId: me.id, label: `Main ${s.tanggal} ${posisi} (utang 25K)`, kreditPaket: 0, kreditReguler: 0, rupiah: 25000, metode: "utang", tanggal: new Date().toISOString(), status: "success" });
    } else {
      d.rsvps.push({ id: uid(), scheduleId: s.id, userId: me.id, status: "confirmed_langsung", posisi, metode });
      d.txs.push({ id: uid(), userId: me.id, label: `Main ${s.tanggal} ${posisi} (bayar cash di tempat)`, kreditPaket: 0, kreditReguler: 0, rupiah: 0, metode: "langsung", tanggal: new Date().toISOString(), status: "success" });
    }
    save(d); setDb(load());
  };

  const batal = (s: any) => {
    if (lewatH2(s)) return alert(`Sudah lewat batas H-2 (${fmtBatas(s)}). Tidak bisa tarik list — tetap wajib bayar. Hubungi admin jika darurat.`);
    if (!confirm("Tarik list? Kredit/utangmu untuk jadwal ini dibatalkan.")) return;
    const d = load();
    const r = d.rsvps.find((x: any) => x.scheduleId === s.id && x.userId === me.id && x.status !== "cancelled");
    if (!r) return;
    if (r.status === "confirmed_lunas" && r.metode === "deposit") {
      const w = d.wallets[me.id] || { paket: 0, reguler: 0 };
      w.reguler += 1; d.wallets[me.id] = w;
    }
    r.status = "cancelled"; save(d); setDb(load());
  };

  const terkunci = hasUtang(db, me.id);

  return (
    <div>
      <h2 style={{ margin: "4px 0" }}>📅 Mau ikut yang mana?</h2>
      <p className="muted">Kuota 28 (GK 4 • Belakang/Tengah/Depan @8). Sparing = 14. Tarik list terakhir <b>H-2</b>.</p>
      {terkunci && <div className="banner err">🔒 Kamu punya tunggakan. Lunasi ke admin dulu untuk buka list berikutnya.</div>}
      {db.schedules.slice().sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal)).map((s: any) => {
        const list = db.rsvps.filter((r: any) => r.scheduleId === s.id && r.status !== "cancelled");
        const mine = list.find((r: any) => r.userId === me.id);
        const ka = kuotaAktif(s);
        const pct = Math.min(100, Math.round((list.length / ka) * 100));
        const penuh = list.length >= ka;
        const ditutup = s.status === "tutup" || s.status === "full_booked";
        const pos = posisiPilih[s.id] || "Depan";
        const h2 = lewatH2(s);
        return (
          <div className="card" key={s.id}>
            <div className="ticket">
              <div className="datebox">{s.tanggal.slice(8, 10)}<span>{s.tanggal.slice(5, 7)}/{s.tanggal.slice(0, 4)}</span></div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 17 }}>{s.jam}</b> <span className={`badge ${s.status === "buka" ? "green" : s.status === "sparing" ? "blue" : "red"}`}>{STATUS_LABEL[s.status]}</span><br />
                <small className="muted">📍 {s.lokasi}</small>
                <div className="progress"><i style={{ width: pct + "%", background: penuh || ditutup ? "#DC2626" : undefined }} /></div>
                <small className="muted">{list.length}/{ka} sudah isi list {penuh ? "• PENUH" : `• sisa ${ka - list.length}`} • batas tarik: {fmtBatas(s)}</small>{" "}
                {mine && <span className={`badge ${mine.status === "confirmed_lunas" ? "green" : mine.status === "confirmed_langsung" ? "blue" : "red"}`}>
                  {mine.status === "confirmed_lunas" ? `✅ Lunas • ${mine.posisi}` : mine.status === "confirmed_langsung" ? `💵 Di tempat • ${mine.posisi}` : mine.status === "no_show" ? "🚫 No-show" : `🔒 Wajib bayar • ${mine.posisi}`}
                </span>}
              </div>
            </div>

            {s.status === "full_booked" && <div className="banner err">🔴 Lapangan full booked untuk tanggal ini.</div>}
            {s.status === "tutup" && <div className="banner warn">⏸️ Jadwal ini ditutup admin.</div>}
            {s.status === "sparing" && <div className="banner info">🤝 Mode sparing — kuota 14 (GK 2 • lainnya @4). Cari lawan sparing!</div>}

            <div className="row" style={{ marginTop: 8 }}>
              {POSISI_MAIN.map((p) => {
                const isi = list.filter((r: any) => (r.posisi || "Depan") === p).length;
                const q = quotaPosisi(s, p);
                return <span key={p} className={`badge ${isi >= q ? "red" : pos === p ? "green" : "gray"}`}>{p} {isi}/{q}</span>;
              })}
            </div>

            <div style={{ marginTop: 10 }}>
              {!mine ? (
                ditutup ? null : penuh ? <div className="banner err">Kuota penuh. Coba jadwal lain ya 🙏</div> : terkunci ? null : (
                  <>
                    <label><small className="muted"><b>Main sebagai:</b></small></label>
                    <select value={pos} onChange={(e) => setPosisiPilih((v) => ({ ...v, [s.id]: e.target.value as PosisiMain }))}>
                      {POSISI_MAIN.map((p) => {
                        const isi = list.filter((r: any) => (r.posisi || "Depan") === p).length;
                        const q = quotaPosisi(s, p);
                        return <option key={p} value={p} disabled={isi >= q}>{p} — sisa {Math.max(0, q - isi)}{isi >= q ? " (PENUH)" : ""}</option>;
                      })}
                    </select>
                    <button className="btn" onClick={() => ikut(s, "deposit")}>✅ {pos} — Potong 1 Kredit</button>
                    <button className="btn secondary" onClick={() => ikut(s, "utang")}>📝 {pos} — Utang Dulu (25K)</button>
                    <button className="btn secondary" onClick={() => ikut(s, "langsung")}>💵 {pos} — Bayar Cash di Tempat</button>
                  </>
                )
              ) : (
                h2 || mine.status === "wajib_bayar" || mine.status === "no_show"
                  ? <div className="banner warn">Lewat H-2 / sudah wajib bayar — tidak bisa tarik list. Hubungi admin jika darurat.</div>
                  : <button className="btn danger" onClick={() => batal(s)}>Tarik List ({mine.posisi}) — batas {fmtBatas(s)}</button>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              {POSISI_MAIN.map((p) => {
                const names = list.filter((r: any) => (r.posisi || "Depan") === p).map((r: any) => db.users.find((u: any) => u.id === r.userId)?.nama);
                if (names.length === 0) return null;
                return <p key={p} className="muted" style={{ margin: "4px 0" }}><small><b>{p}:</b> {names.join(", ")}</small></p>;
              })}
              {list.length === 0 && !ditutup && <p className="muted"><small>— belum ada yang isi list —</small></p>}
            </div>
          </div>
        );
      })}
      <p className="muted"><small>📌 Aturan: tarik list terakhir H-2. Setelah itu tetap wajib bayar walau tidak datang. Belum bayar = tidak bisa ikut game berikutnya.</small></p>
    </div>
  );
}
