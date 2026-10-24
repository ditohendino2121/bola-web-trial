"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Loading, LoadError, Empty, DateBox, Crest, Meter, Tabs } from "../../components/ui";
import { supa } from "../../lib/supa";
import { teamNama, TEAM_CODES, urutkanPosisi, lewatHariHLiga, hitungSkorsing, walletOf, totalKredit } from "../../lib/rules";
import { tanggalID } from "../../lib/util";

function todayLocalISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function JadwalLiga() {
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("mendatang");
  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="jadwal liga" /></div>;

  const me = db.users.find((u) => u.id === db.sessionId);
  const teams = db.teams;
  const myTeam = TEAM_CODES.find((t) => (teams[t] || []).some((m) => m.userId === me?.id));
  const myPos = myTeam ? (teams[myTeam] || []).find((m) => m.userId === me?.id)?.posisi || "Depan" : "Depan";
  const skorsing = hitungSkorsing(db.matches, db.playerStats, teams);
  const today = todayLocalISO();

  const editions = db.editions.map((ed) => ({ ed, s: db.schedules.find((x) => x.is_liga && x.edition_id === ed.id) }));
  const mendatang = editions.filter(({ ed }) => ed.tanggal >= today).sort((a, b) => a.ed.tanggal.localeCompare(b.ed.tanggal));
  const lewat = editions.filter(({ ed }) => ed.tanggal < today).sort((a, b) => b.ed.tanggal.localeCompare(a.ed.tanggal));
  const tampil = tab === "mendatang" ? mendatang : lewat;

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await reload(); } catch (e: any) { alert(e.message); } setBusy(false); };
  const konfirmasi = (scheduleId: string, metode: "deposit" | "langsung") => run(async () => {
    const { data, error: e } = await supa().rpc("rpc_rsvp", { p_schedule: scheduleId, p_posisi: myPos, p_metode: metode });
    if (e) throw new Error(e.message);
    if (!(data as any)?.ok) throw new Error((data as any)?.msg || "Gagal konfirmasi.");
  });
  const batal = (scheduleId: string) => {
    if (!confirm("Batalkan kehadiran? Kredit dikembalikan.")) return;
    run(async () => {
      const { data, error: e } = await supa().rpc("rpc_cancel", { p_schedule: scheduleId });
      if (e) throw new Error(e.message);
      if (!(data as any)?.ok) throw new Error((data as any)?.msg || "Gagal batal.");
    });
  };

  return (
    <div>
      <PageHead
        title="Jadwal liga"
        desc="Konfirmasi kehadiran tiap edisi di sini. 1 edisi = 1 kredit, batal paling lambat H-1 (kredit kembali)."
        tabs={<Tabs items={[{ key: "mendatang", label: `Mendatang (${mendatang.length})` }, { key: "lewat", label: `Sudah lewat (${lewat.length})` }]} value={tab} onChange={setTab} label="Filter jadwal liga" />}
      />
      <div className="page wrap">
        {!me && <div className="note warn">Login dulu untuk konfirmasi kehadiran. <a href="/#akun" className="linkbtn">Masuk</a></div>}
        {me && !myTeam && <div className="note info">Kamu belum masuk tim liga. Konfirmasi hanya untuk pemain yang sudah diassign admin ke tim.</div>}
        {me && myTeam && <div className="note info">Kamu di <b>{teamNama(myTeam)}</b> sebagai <b>{myPos}</b> &middot; saldo {totalKredit(walletOf(db, me.id))} kredit{(skorsing[me.id] || 0) > 0 ? ` · sedang skorsing ${skorsing[me.id]} laga` : ""}</div>}
        {me?.role === "admin" && <p className="muted"><small>Admin: buat edisi dan pertandingan baru di halaman <Link href="/liga" className="linkbtn">Liga</Link>.</small></p>}

        {tampil.length === 0 && <Empty title={tab === "mendatang" ? "Belum ada jadwal liga mendatang." : "Belum ada edisi yang lewat."} />}

        {tampil.map(({ ed, s }) => {
          const list = s ? db.rsvps.filter((r) => r.scheduleId === s.id && r.status !== "cancelled") : [];
          const mine = list.find((r) => r.userId === me?.id);
          const laga = db.matches.filter((m) => m.edition_id === ed.id);
          const sudahHariH = s ? lewatHariHLiga(s) : true;
          const timOf = (uid: string) => TEAM_CODES.find((t) => (teams[t] || []).some((m) => m.userId === uid));
          const totalSkuad = TEAM_CODES.reduce((a, t) => a + (teams[t] || []).length, 0);
          return (
            <div key={ed.id} className="panel">
              <div className="slot">
                <DateBox iso={ed.tanggal} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h3>{ed.label}</h3>
                    {s && <span className={`pill ${s.status === "buka" && !sudahHariH ? "ok" : "neutral"}`}>{sudahHariH ? "Tutup" : s.status === "buka" ? "Buka" : s.status}</span>}
                  </div>
                  <small className="muted">{tanggalID(ed.tanggal)}{s ? ` · ${s.jam}` : ""}</small>
                  {s && <div style={{ marginTop: 6 }}><Meter filled={list.length} total={totalSkuad || 40} /></div>}
                </div>
              </div>

              {laga.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {laga.map((m) => (
                    <Link key={m.id} href={`/liga/${m.id}`} className="fx">
                      <span className="fx-team home">{teamNama(m.home)} <Crest team={m.home} size="sm" /></span>
                      <span className={m.sh !== null && m.sa !== null ? "scorebox" : "scorebox time"}>{m.sh !== null && m.sa !== null ? `${m.sh} - ${m.sa}` : "vs"}</span>
                      <span className="fx-team away"><Crest team={m.away} size="sm" /> {teamNama(m.away)}</span>
                    </Link>
                  ))}
                </div>
              )}

              {s && me && myTeam && (
                <div style={{ marginTop: 12 }}>
                  {mine ? (
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className={`pill ${mine.status === "confirmed_lunas" ? "ok" : "info"}`}>Kamu sudah konfirmasi — {mine.status === "confirmed_lunas" ? "lunas (potong kredit)" : "bayar di tempat"}</span>
                      {!sudahHariH && <button className="btn danger sm" disabled={busy} onClick={() => batal(s.id)}>Batal hadir</button>}
                    </div>
                  ) : sudahHariH ? (
                    <div className="note warn">Konfirmasi sudah ditutup (hari-H).</div>
                  ) : (
                    <div className="row">
                      <button className="btn" disabled={busy} onClick={() => konfirmasi(s.id, "deposit")}>Hadir — potong 1 kredit</button>
                      <button className="btn ghost" disabled={busy} onClick={() => konfirmasi(s.id, "langsung")}>Hadir — bayar cash (Rp{myPos === "GK" ? "15.000" : "25.000"})</button>
                    </div>
                  )}
                </div>
              )}

              {s && (
                <div style={{ marginTop: 14 }}>
                  <h4>Sudah konfirmasi ({list.length})</h4>
                  <div className="grid2" style={{ marginTop: 8 }}>
                    {TEAM_CODES.map((t) => {
                      const hadir = urutkanPosisi(list.filter((r) => timOf(r.userId) === t).map((r) => ({ ...r, posisi: r.posisi })));
                      return (
                        <div key={t} style={{ borderLeft: `3px solid var(--team-${t.toLowerCase()})`, paddingLeft: 10 }}>
                          <div className="clubcell" style={{ marginBottom: 4 }}><Crest team={t} size="sm" /> {teamNama(t)} <span className="pill neutral">{hadir.length}/{(teams[t] || []).length}</span></div>
                          <div className="people">
                            {hadir.map((r) => (
                              <div key={r.id} className="person">
                                <span className="pill neutral">{r.posisi}</span> {db.users.find((u) => u.id === r.userId)?.nama || "-"}
                                {r.status === "confirmed_langsung" && <small className="muted">(cash)</small>}
                              </div>
                            ))}
                            {hadir.length === 0 && <p className="muted"><small>Belum ada.</small></p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!s && <p className="muted" style={{ marginTop: 10 }}><small>Jadwal konfirmasi untuk edisi ini belum dibuat.</small></p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
