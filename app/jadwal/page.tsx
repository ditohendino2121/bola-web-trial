"use client";
import { useEffect, useState } from "react";
import { useDB, PageHead, Loading, LoadError, StatusPill, Meter, DateBox, Empty } from "../../components/ui";
import {
  dikunciRSVP, langsungBelumLunas, POSISI_MAIN, kuotaAktif, quotaPosisi,
  lewatH2, fmtBatas,
} from "../../lib/rules";
import { rsvp, batalRsvp, type PosisiMain } from "../../lib/data";

function todayLocalISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function Jadwal() {
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [posisiPilih, setPosisiPilih] = useState<Record<string, PosisiMain>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const todayISO = todayLocalISO();
  const jadwalBiasa = db ? db.schedules.filter((s) => !s.is_liga).sort((a, b) => a.tanggal.localeCompare(b.tanggal)) : [];
  const upcoming = jadwalBiasa.filter((s) => s.tanggal >= todayISO);
  const upcomingDates = Array.from(new Set(upcoming.map((s) => s.tanggal))).sort();
  const datesKey = upcomingDates.join(",");
  useEffect(() => {
    if (!db) return;
    const q = new URLSearchParams(window.location.search).get("tgl");
    if (q && upcomingDates.includes(q)) setSelected(q);
    else if (upcomingDates.length > 0 && !selected) setSelected(upcomingDates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, datesKey]);
  const visible = selected ? upcoming.filter((s) => s.tanggal === selected) : upcoming;

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="jadwal" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  if (!me) return <div className="page wrap"><Empty title="Login dulu untuk isi list" action={<a href="/#akun"><button className="btn" style={{ marginTop: 10 }}>Ke beranda</button></a>} /></div>;
  if (me.status !== "approved") return <div className="page wrap"><div className="note warn">Akun {me.nama} masih {me.status}. Minta admin approve dulu.</div></div>;

  const ikut = async (s: any, metode: "deposit" | "langsung") => {
    setBusy(true);
    try { await rsvp(s.id, posisiPilih[s.id] || "Depan", metode); await reload(); }
    catch (e: any) { alert(e.message); }
    setBusy(false);
  };
  const batal = async (s: any) => {
    if (lewatH2(s)) return alert(`Sudah lewat batas H-2 (${fmtBatas(s)}). Tidak bisa tarik list, tetap wajib bayar. Hubungi admin jika darurat.`);
    if (!confirm("Tarik list? Kredit/utangmu untuk jadwal ini dibatalkan.")) return;
    setBusy(true);
    try { await batalRsvp(s.id); await reload(); }
    catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const terkunci = dikunciRSVP(db, me.id);
  const nLangsung = langsungBelumLunas(db, me.id).length;

  return (
    <div>
      <PageHead title="Jadwal main" desc="Pilih tanggal, lihat skuad, isi atau tarik list." />
      <div className="page wrap">
        {upcomingDates.length > 0 && (
          <div className="datestrip" role="list" aria-label="Filter tanggal">
            <button className="datechip" aria-pressed={!selected} onClick={() => setSelected(null)}>Semua<b>{upcoming.length}</b></button>
            {upcomingDates.map((iso) => {
              const d = new Date(iso + "T00:00:00");
              return <button key={iso} className="datechip" aria-pressed={iso === selected} onClick={() => setSelected(iso)}>{DAYS[d.getDay()]}<b>{String(d.getDate()).padStart(2, "0")}</b></button>;
            })}
          </div>
        )}
        <p className="muted"><small>Kuota 28: GK 4, Belakang/Tengah/Depan masing-masing 8. Untuk jadwal liga, buka menu Liga.</small></p>
        {terkunci && <div className="note err">{nLangsung > 0 ? `Kamu ada ${nLangsung}x bayar-di-tempat yang belum dikonfirmasi lunas admin. Selesaikan dulu untuk buka list berikutnya.` : "Kamu punya tunggakan. Lunasi ke admin dulu untuk buka list berikutnya."}</div>}
        {jadwalBiasa.length === 0 && <Empty title="Belum ada jadwal. Admin buat di Kelola jadwal." />}
        {upcoming.length === 0 && jadwalBiasa.length > 0 && <Empty title="Semua jadwal sudah lewat, menunggu jadwal baru dari admin." />}

        {visible.map((s) => {
          const list = db.rsvps.filter((r) => r.scheduleId === s.id && r.status !== "cancelled");
          const mine = list.find((r) => r.userId === me.id);
          const ka = kuotaAktif(s);
          const penuh = list.length >= ka;
          const ditutup = s.status === "tutup" || s.status === "full_booked";
          const pos = posisiPilih[s.id] || "Depan";
          const lewat2 = lewatH2(s);
          return (
            <div className="panel" key={s.id} id={`jad-${s.tanggal}`} style={{ marginBottom: 14 }}>
              <div className="slot">
                <DateBox iso={s.tanggal} />
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <b style={{ fontSize: 17 }}>{s.jam}</b>
                    <StatusPill status={s.status} sisa={ka - list.length} />
                  </div>
                  <small className="muted">{s.lokasi}</small>
                  <div style={{ marginTop: 6 }}><Meter filled={list.length} total={ka} /></div>
                  <small className="muted">Batas tarik list: {fmtBatas(s)}</small>
                  {mine && (
                    <div style={{ marginTop: 4 }}>
                      <span className={`pill ${mine.status === "confirmed_lunas" ? "ok" : mine.status === "confirmed_langsung" ? "info" : "bad"}`}>
                        {mine.status === "confirmed_lunas" ? `Lunas (${mine.posisi})` : mine.status === "confirmed_langsung" ? `Bayar di tempat (${mine.posisi})` : mine.status === "no_show" ? "No-show" : `Wajib bayar (${mine.posisi})`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {s.status === "full_booked" && <div className="note err" style={{ marginTop: 10 }}>Lapangan full booked untuk tanggal ini.</div>}
              {s.status === "tutup" && <div className="note warn" style={{ marginTop: 10 }}>Jadwal ini ditutup admin.</div>}
              {s.status === "sparing" && <div className="note info" style={{ marginTop: 10 }}>Mode sparing, kuota 14 (GK 2, lainnya masing-masing 4). Cari lawan sparing.</div>}

              <div className="row" style={{ marginTop: 10 }}>
                {POSISI_MAIN.map((p) => {
                  const isi = list.filter((r) => (r.posisi || "Depan") === p).length;
                  const q = quotaPosisi(s, p);
                  return <span key={p} className={`pill ${isi >= q ? "bad" : pos === p ? "ok" : "neutral"}`}>{p} {isi}/{q}</span>;
                })}
              </div>

              <div style={{ marginTop: 12 }}>
                {!mine ? (
                  ditutup ? null : penuh ? <div className="note err">Kuota penuh, coba jadwal lain.</div> : terkunci ? null : (
                    <>
                      <label className="field"><span>Main sebagai</span>
                        <select value={pos} disabled={busy} onChange={(e) => setPosisiPilih((v) => ({ ...v, [s.id]: e.target.value as PosisiMain }))}>
                          {POSISI_MAIN.map((p) => { const isi = list.filter((r) => (r.posisi || "Depan") === p).length; const q = quotaPosisi(s, p); return <option key={p} value={p} disabled={isi >= q}>{p} — sisa {Math.max(0, q - isi)}{isi >= q ? " (penuh)" : ""}</option>; })}
                        </select>
                      </label>
                      <div className="row">
                        <button className="btn" disabled={busy} onClick={() => ikut(s, "deposit")}>Pakai 1 kredit ({pos}{pos === "GK" ? ", GK dulu" : ""})</button>
                        <button className="btn ghost" disabled={busy} onClick={() => ikut(s, "langsung")}>Bayar cash di tempat (Rp{pos === "GK" ? "15.000" : "25.000"})</button>
                      </div>
                    </>
                  )
                ) : (
                  lewat2 || mine.status === "wajib_bayar" || mine.status === "no_show"
                    ? <div className="note warn">Lewat H-2 atau sudah wajib bayar, tidak bisa tarik list. Hubungi admin jika darurat.</div>
                    : <button className="btn danger" disabled={busy} onClick={() => batal(s)}>Tarik list {mine.posisi} (batas {fmtBatas(s)})</button>
                )}
              </div>

              <div className="lineup" style={{ marginTop: 12 }}>
                {POSISI_MAIN.map((p) => {
                  const names = list.filter((r) => (r.posisi || "Depan") === p).map((r) => db.users.find((u) => u.id === r.userId)?.nama || "-");
                  return (
                    <div key={p}>
                      <h4>{p} {names.length > 0 ? `(${names.length})` : ""}</h4>
                      {names.length === 0 ? <p className="muted"><small>Kosong</small></p> : names.map((n, i) => <p key={i} style={{ margin: "2px 0", fontSize: 13 }}>{n}</p>)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <p className="muted"><small>Aturan: tarik list terakhir H-2. Setelah itu tetap wajib bayar walau tidak datang. Belum bayar artinya tidak bisa ikut game berikutnya.</small></p>
      </div>
    </div>
  );
}
