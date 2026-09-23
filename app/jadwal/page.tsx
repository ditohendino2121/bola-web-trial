"use client";
import { useEffect, useState } from "react";
import {
  dikunciRSVP, langsungBelumLunas, QUOTA_MAIN, POSISI_MAIN, kuotaAktif, quotaPosisi,
  lewatH2, fmtBatas, STATUS_LABEL,
  type PosisiMain, type RsvpMetode,
} from "../../lib/store";
import { fetchAll, rsvp, batalRsvp } from "../../lib/db";

export default function Jadwal() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [posisiPilih, setPosisiPilih] = useState<Record<string, PosisiMain>>({});
  const reload = () =>fetchAll().then(setDb).catch((e: any) =>setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err"> {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) =>u.id === db.sessionId);
  if (!me) return <div className="card"><h3>Login dulu yuk </h3><p className="muted">Daftar / login di Beranda, gratis.</p></div>;
  if (me.status !== "approved") return <div className="card"><div className="banner warn">Akun <b>{me.nama}</b>masih <b>{me.status}</b>. Minta admin approve dulu ya.</div></div>;

  const ikut = async (s: any, metode: RsvpMetode) => {
    setBusy(true); setErr("");
    try {
      await rsvp(s.id, posisiPilih[s.id] || "Depan", metode);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const batal = async (s: any) => {
    if (lewatH2(s)) return alert(`Sudah lewat batas H-2 (${fmtBatas(s)}). Tidak bisa tarik list — tetap wajib bayar. Hubungi admin jika darurat.`);
    if (!confirm("Tarik list? Kredit/utangmu untuk jadwal ini dibatalkan.")) return;
    setBusy(true);
    try { await batalRsvp(s.id); await reload(); }
    catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const terkunci = dikunciRSVP(db, me.id);
  const nLangsung = langsungBelumLunas(db, me.id).length;

  const jadwalBiasa = db.schedules.filter((s:any)=>!s.is_liga).sort((a: any, b: any) =>a.tanggal.localeCompare(b.tanggal));
  const accentFor = (idx:number)=> ["accent-gold","accent-lilac","accent-teal","accent-pink","accent-blue"][idx%5];
  const weekDays = (()=>{ const days=["Min","Sen","Sel","Rab","Kam","Jum","Sab"]; const today=new Date(); const start=new Date(today); start.setDate(today.getDate()-today.getDay()); return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); const iso=d.toISOString().slice(0,10); const has=jadwalBiasa.some((s:any)=>s.tanggal===iso); const isToday=iso===today.toISOString().slice(0,10); return {label:days[d.getDay()], num:String(d.getDate()).padStart(2,"0"), iso, has, isToday}; });})();
  return (
    <div>
      <div className="page-head" style={{ marginBottom: 6 }}><h2 style={{ margin: "4px 0" }}>Mau ikut yang mana?</h2><p>Jadwal FUN — Scores style, pilih tanggal di bawah</p></div>
      <div className="date-strip">
        {weekDays.map((d)=> (<button key={d.iso} className={`date-pill ${d.isToday ? "on" : ""} ${d.has ? "has" : ""}`} disabled={!d.has} onClick={() => d.has && document.getElementById(`jad-${d.iso}`)?.scrollIntoView({behavior:"smooth", block:"center"}) }>{d.label}<b>{d.num}</b></button>))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>Kuota 28: GK 4 · Belakang/Tengah/Depan @8. Untuk jadwal liga, buka panel Liga.</p>
      {terkunci && <div className="banner err"> {nLangsung > 0 ? `Kamu ada ${nLangsung}x bayar-di-tempat yang belum dikonfirmasi lunas admin. Selesaikan dulu untuk buka list berikutnya.` : "Kamu punya tunggakan. Lunasi ke admin dulu untuk buka list berikutnya."}</div>}
      {jadwalBiasa.length===0 && <div className="card"><p className="muted">Belum ada jadwal FUN. Admin buat di Kelola Jadwal.</p></div>}
      {jadwalBiasa.map((s: any, idx:number) => {
      const list = db.rsvps.filter((r: any) =>r.scheduleId === s.id && r.status !== "cancelled");
      const mine = list.find((r: any) =>r.userId === me.id);
      const ka = kuotaAktif(s);
      const pct = Math.min(100, Math.round((list.length / ka) * 100));
      const penuh = list.length >= ka;
      const ditutup = s.status === "tutup" || s.status === "full_booked";
      const pos = posisiPilih[s.id] || "Depan";
      const h2 = lewatH2(s);
      return (
      <div className={`match-card ${accentFor(idx)}`} key={s.id} id={`jad-${s.tanggal}`}>
            <div className="ticket">
              <div className="datebox">{s.tanggal.slice(8, 10)}<span>{s.tanggal.slice(5, 7)}/{s.tanggal.slice(0, 4)}</span></div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 17 }}>{s.jam}</b> <span className={`badge ${s.status === "buka" ? "green" : s.status === "sparing" ? "blue" : "red"}`}>{STATUS_LABEL[s.status]}</span><br />
                <small className="muted"> {s.lokasi}</small>
                <div className="progress"><i style={{ width: pct + "%", background: penuh || ditutup ? "#DC2626" : undefined }} /></div>
                <small className="muted">{list.length}/{ka} sudah isi list {penuh ? "• PENUH" : `• sisa ${ka - list.length}`} • batas tarik: {fmtBatas(s)}</small>{" "}
                {mine && <span className={`badge ${mine.status === "confirmed_lunas" ? "green" : mine.status === "confirmed_langsung" ? "blue" : "red"}`}>
                  {mine.status === "confirmed_lunas" ? ` Lunas • ${mine.posisi}` : mine.status === "confirmed_langsung" ? ` Di tempat • ${mine.posisi}` : mine.status === "no_show" ? " No-show" : ` Wajib bayar • ${mine.posisi}`}
                </span>}
              </div>
            </div>

            {s.status === "full_booked" && <div className="banner err">Lapangan full booked untuk tanggal ini.</div>}
            {s.status === "tutup" && <div className="banner warn">Jadwal ini ditutup admin.</div>}
            {s.status === "sparing" && <div className="banner info">Mode sparing — kuota 14 (GK 2 • lainnya @4). Cari lawan sparing!</div>}

            <div className="row" style={{ marginTop: 8 }}>
              {POSISI_MAIN.map((p) => {
                const isi = list.filter((r: any) => (r.posisi || "Depan") === p).length;
                const q = quotaPosisi(s, p);
                return <span key={p} className={`badge ${isi >= q ? "red" : pos === p ? "green" : "gray"}`}>{p} {isi}/{q}</span>;
              })}
            </div>

            <div style={{ marginTop: 10 }}>
              {!mine ? (
                ditutup ? null : penuh ? <div className="banner err">Kuota penuh. Coba jadwal lain ya </div> : terkunci ? null : (
                  <>
                    <label><small className="muted"><b>Main sebagai:</b></small></label>
                    <select value={pos} disabled={busy} onChange={(e) =>setPosisiPilih((v) => ({ ...v, [s.id]: e.target.value as PosisiMain }))}>
                      {POSISI_MAIN.map((p) => {
                        const isi = list.filter((r: any) => (r.posisi || "Depan") === p).length;
                        const q = quotaPosisi(s, p);
                        return <option key={p} value={p} disabled={isi >= q}>{p} — sisa {Math.max(0, q - isi)}{isi >= q ? " (PENUH)" : ""}</option>;
                      })}
                    </select>
                    <button className="btn" disabled={busy} onClick={() =>ikut(s, "deposit")}> {pos} — Potong 1 Kredit{pos === "GK" ? " (GK dulu)" : ""}</button>
                    <button className="btn secondary" disabled={busy} onClick={() =>ikut(s, "langsung")}> {pos} — Bayar Cash di Tempat ({pos === "GK" ? "15rb" : "25rb"})</button>
                  </>
                )
              ) : (
                h2 || mine.status === "wajib_bayar" || mine.status === "no_show"
                  ? <div className="banner warn">Lewat H-2 / sudah wajib bayar — tidak bisa tarik list. Hubungi admin jika darurat.</div>
                  : <button className="btn danger" disabled={busy} onClick={() =>batal(s)}>Tarik List ({mine.posisi}) — batas {fmtBatas(s)}</button>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              {POSISI_MAIN.map((p) => {
                const names = list.filter((r: any) => (r.posisi || "Depan") === p).map((r: any) =>db.users.find((u: any) =>u.id === r.userId)?.nama);
                if (names.length === 0) return null;
                return <p key={p} className="muted" style={{ margin: "4px 0" }}><small><b>{p}:</b> {names.join(", ")}</small></p>;
              })}
              {list.length === 0 && !ditutup && <p className="muted"><small>— belum ada yang isi list —</small></p>}
            </div>
          </div>
        );
      })}
      <p className="muted"><small>Aturan: tarik list terakhir H-2. Setelah itu tetap wajib bayar walau tidak datang. Belum bayar = tidak bisa ikut game berikutnya.</small></p>
    </div>
  );
}
