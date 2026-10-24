"use client";
import Link from "next/link";
import { useDB, Loading, LoadError, StatusPill, Meter, DateBox } from "../components/ui";
import { AuthPanel, AkadGate } from "../components/Account";
import { walletOf, totalKredit, dikunciRSVP, kuotaAktif, klasemen, teamNama } from "../lib/rules";
import { signOut } from "../lib/data";
import { BASECAMP } from "../lib/club";
import { AKAD_VERSION } from "../lib/akad";

function todayLocalISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function Home() {
  const { db, error, reload } = useDB();
  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="beranda" /></div>;

  const me = db.users.find((u) => u.id === db.sessionId);
  const todayISO = todayLocalISO();
  const upcoming = db.schedules.filter((s) => !s.is_liga && s.tanggal >= todayISO).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const next = upcoming[0];
  const dates = Array.from(new Set(upcoming.map((s) => s.tanggal))).sort();
  const greet = (() => { const h = new Date().getHours(); if (h < 11) return "Selamat pagi"; if (h < 15) return "Selamat siang"; if (h < 18) return "Selamat sore"; return "Selamat malam"; })();
  const standings = klasemen(db.matches, db.playerStats).slice(0, 4);
  const butuhAkad = me && (!me.setuju_akad || me.akad_version !== AKAD_VERSION);

  return (
    <div className="page wrap">
      <div className="panel dark">
        {me ? (
          <>
            <h1 className="hero" style={{ fontSize: "clamp(22px,3.5vw,32px)" }}>{greet}, {me.nama.split(" ")[0]}</h1>
            <p className="muted" style={{ marginTop: 4 }}>Saldo {totalKredit(walletOf(db, me.id))} kredit {me.is_member ? "— member" : ""}</p>
          </>
        ) : (
          <>
            <h1 className="hero">MUBA FC</h1>
            <p className="muted" style={{ marginTop: 6 }}>{BASECAMP}</p>
          </>
        )}
        {next ? (
          <div style={{ marginTop: 18, maxWidth: 420 }}>
            <h3 style={{ color: "var(--on-black)" }}>Main berikutnya</h3>
            <p style={{ fontSize: 18, fontWeight: 800, margin: "4px 0" }}>{next.tanggal} &middot; {next.jam}</p>
            <p className="muted" style={{ margin: "0 0 10px" }}>{next.lokasi}</p>
            <Meter filled={db.rsvps.filter((r) => r.scheduleId === next.id && r.status !== "cancelled").length} total={kuotaAktif(next)} />
            <div className="row" style={{ marginTop: 12 }}>
              <Link href={`/jadwal?tgl=${next.tanggal}`}><button className="btn">Isi list tanggal ini</button></Link>
              <Link href="/jadwal"><button className="btn ghost" style={{ borderColor: "var(--black-line)", color: "var(--on-black)" }}>Semua jadwal</button></Link>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <p className="muted">{db.schedules.filter((s) => !s.is_liga).length === 0 ? "Belum ada jadwal main — tanya pengurus kapan main berikutnya." : "Semua jadwal sudah lewat, menunggu jadwal baru dari admin."}</p>
            <div className="row" style={{ marginTop: 10 }}>
              <Link href="/kontak"><button className="btn ghost" style={{ borderColor: "var(--black-line)", color: "var(--on-black)" }}>Tanya jadwal ke pengurus</button></Link>
              <Link href="/klasemen"><button className="btn ghost" style={{ borderColor: "var(--black-line)", color: "var(--on-black)" }}>Lihat klasemen liga</button></Link>
            </div>
          </div>
        )}
        {!me && <div style={{ marginTop: 18 }}><a href="#akun"><button className="btn">Daftar untuk ikut main</button></a></div>}
      </div>

      {dates.length > 0 && (
        <div className="datestrip" role="list" aria-label="Pilih tanggal jadwal">
          {dates.slice(0, 8).map((iso) => {
            const d = new Date(iso + "T00:00:00");
            const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
            return <Link key={iso} href={`/jadwal?tgl=${iso}`} className="datechip">{days[d.getDay()]}<b>{String(d.getDate()).padStart(2, "0")}</b></Link>;
          })}
        </div>
      )}

      {me?.status === "pending" && <div className="note warn">Akunmu menunggu approve admin. Hubungi pengurus di menu Kontak.</div>}
      {me && dikunciRSVP(db, me.id) && <div className="note err">Ada pembayaran yang belum beres, lunasi ke admin dulu.</div>}
      {butuhAkad && me && <AkadGate userId={me.id} onDone={reload} />}

      <div className="home-grid">
        <div className="stack">
          <div className="panel">
            <div className="panel-h">
              <div><h3>Jadwal terdekat</h3><p>Upcoming, tap tanggal di atas untuk filter</p></div>
              <Link href="/jadwal" className="panel-link">{upcoming.length} upcoming</Link>
            </div>
            {upcoming.slice(0, 3).map((s) => {
              const ikut = db.rsvps.filter((r) => r.scheduleId === s.id && r.status !== "cancelled").length;
              const sisa = kuotaAktif(s) - ikut;
              return (
                <Link key={s.id} href={`/jadwal?tgl=${s.tanggal}`} className="slot" style={{ textDecoration: "none", color: "inherit", padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <DateBox iso={s.tanggal} />
                  <div style={{ flex: 1 }}>
                    <b>{s.jam} &middot; {s.lokasi}</b>
                    <div className="muted" style={{ fontSize: 13, margin: "2px 0 6px" }}>{ikut}/{kuotaAktif(s)} terisi, sisa {Math.max(0, sisa)}</div>
                    <StatusPill status={s.status} sisa={sisa} />
                  </div>
                </Link>
              );
            })}
            {upcoming.length === 0 && <p className="muted">{db.schedules.filter((x) => !x.is_liga).length === 0 ? "Belum ada jadwal. Admin buat di Kelola jadwal." : "Semua jadwal sudah lewat."}</p>}
            <Link href="/jadwal"><button className="btn ghost block" style={{ marginTop: 10 }}>Lihat dan isi list</button></Link>
          </div>

          <div className="panel">
            <div className="panel-h"><div><h3>Klasemen liga</h3><p>Ringkasan 4 tim</p></div><Link href="/klasemen" className="panel-link">Lihat lengkap</Link></div>
            {standings.every((r) => r.M === 0) ? <p className="muted">Belum ada laga liga berjalan.</p> : (
              <table className="table"><thead><tr><th>#</th><th>Tim</th><th className="n">M</th><th className="n">Poin</th></tr></thead>
                <tbody>{standings.map((r, i) => <tr key={r.tim} className={i === 0 ? "lead" : ""}><td>{i + 1}</td><td>{teamNama(r.tim)}</td><td className="n">{r.M}</td><td className="n pts">{r.P}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>

        <div className="stack">
          {me ? (
            <div className="panel dark">
              <small className="muted">Kredit kamu</small>
              <div className="bignum" style={{ margin: "4px 0" }}>{totalKredit(walletOf(db, me.id))}</div>
              <small className="muted">Paket {walletOf(db, me.id).paket} &middot; Reguler {walletOf(db, me.id).reguler} &middot; GK {walletOf(db, me.id).paket_gk + walletOf(db, me.id).reguler_gk}</small>
              <div className="row" style={{ marginTop: 14 }}>
                <Link href="/topup" style={{ flex: 1 }}><button className="btn block">Top-up</button></Link>
                <Link href="/jadwal" style={{ flex: 1 }}><button className="btn ghost block" style={{ borderColor: "var(--black-line)", color: "var(--on-black)" }}>Isi list</button></Link>
              </div>
              <button className="linkbtn" style={{ marginTop: 14, color: "var(--on-black-2)", borderColor: "var(--black-line)" }} onClick={() => signOut().then(reload)}>Keluar</button>
            </div>
          ) : (
            <div className="panel"><AuthPanel onDone={reload} /></div>
          )}
        </div>
      </div>
    </div>
  );
}
