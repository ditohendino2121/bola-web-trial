"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Loading, LoadError, Tabs, Crest, FormGuide, SponsorPanel } from "../../components/ui";
import { klasemen, teamNama, formGuide, TEAM_CODES, urutkanPosisi, hitungSkorsing, statusLaga, rekapPemain, urutPoin, POIN_PEMAIN, MIN_LAGA_PENGHARGAAN, KIPER_BONUS_PENUH, type RekapPemain } from "../../lib/rules";

export default function KlasemenPage() {
  const { db, error, reload } = useDB();
  const [selectedEd, setSelectedEd] = useState<string>("overall");
  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="klasemen" /></div>;

  const editions = db.editions || [];
  const matches = db.matches || [];
  const playerStats = db.playerStats || [];
  const ms = selectedEd === "overall" ? matches : matches.filter((m) => m.edition_id === selectedEd);
  const edLabel = selectedEd === "overall" ? null : editions.find((e) => e.id === selectedEd);
  const k = klasemen(ms, playerStats);
  const skorsing = hitungSkorsing(matches, playerStats, db.teams);

  // Top skor: semua pemain terdaftar ikut tampil (0 gol kalau belum mencetak). Fallback m.goals untuk laga format lama.
  const roster = TEAM_CODES.flatMap((t) => (db.teams[t] || []).map((m) => ({ userId: m.userId, team: t })));
  const golMap: Record<string, number> = {};
  roster.forEach((r) => { golMap[r.userId] = 0; });
  ms.filter((m) => m.selesai).forEach((m) => {
    const rows = playerStats.filter((p) => p.match_id === m.id);
    if (rows.length > 0) rows.forEach((ps) => { golMap[ps.user_id] = (golMap[ps.user_id] || 0) + (ps.gol || 0); });
    else (m.goals || []).forEach((g) => { golMap[g.scorerId] = (golMap[g.scorerId] || 0) + 1; });
  });
  const timOf = (id: string) => roster.find((r) => r.userId === id)?.team || "-";
  const top = Object.keys(golMap)
    .map((id) => ({ id, nama: db.users.find((x) => x.id === id)?.nama || id, tim: timOf(id), gol: golMap[id] || 0 }))
    .sort((a, b) => b.gol - a.gol);

  // Penghargaan: rekap poin dari absensi, gol, assist, clean sheet, kartu (lihat POIN_PEMAIN di lib/rules).
  // Syarat minimal laga hanya berlaku di Overall; per edisi tiap tim cuma main 1 laga.
  const overall = selectedEd === "overall";
  const minLaga = overall ? MIN_LAGA_PENGHARGAAN : 1;
  const namaOf = (id: string) => db.users.find((u) => u.id === id)?.nama || id;
  const rekap = rekapPemain(ms, playerStats, db.teams).map((r) => ({ ...r, nama: namaOf(r.userId), lolos: r.main >= minLaga }));
  const peringkat = (list: typeof rekap) => list.slice().sort((a, b) => Number(b.lolos) - Number(a.lolos) || urutPoin(a, b));
  const terbaik = peringkat(rekap);
  const bek = peringkat(rekap.filter((r) => r.posisi === "Belakang"));
  const mid = peringkat(rekap.filter((r) => r.posisi === "Tengah"));
  // Kiper terbaik: rata-rata kebobolan per laga dihadiri, dikurangi bonus kalau hadir penuh. Urut terkecil, lalu clean sheet.
  const kiper = rekap.filter((r) => r.posisi === "GK")
    .map((g) => {
      const rata = g.main ? g.kebobolan / g.main : null;
      return { ...g, rataAkhir: rata === null ? null : Math.max(0, rata - (g.penuh ? KIPER_BONUS_PENUH : 0)) };
    })
    .sort((a, b) => Number(b.lolos) - Number(a.lolos) || (a.rataAkhir ?? Infinity) - (b.rataAkhir ?? Infinity) || b.cs - a.cs || b.main - a.main);
  const syarat = overall ? ` Masuk peringkat setelah hadir minimal ${MIN_LAGA_PENGHARGAAN} laga.` : "";

  const tabItems = [{ key: "overall", label: "Overall" }, ...editions.map((e) => ({ key: e.id, label: e.label }))];

  return (
    <div>
      <PageHead
        title="Klasemen"
        desc="Menang 3, menang adu penalti 2, kalah adu penalti 1, kalah 0. Urutan: poin, selisih gol, gol, fair play."
        tabs={<Tabs items={tabItems} value={selectedEd} onChange={setSelectedEd} label="Pilih edisi" />}
      />
      <div className="page wrap">
        <SponsorPanel />
        {edLabel && (
          <div className="panel">
            <h3>Pertandingan - {edLabel.label}</h3>
            {ms.length === 0 ? <p className="muted">Belum ada laga di edisi ini.</p> : ms.map((m) => {
              const skor = m.sh !== null && m.sa !== null;
              const pk = skor && m.sh === m.sa && m.penalti_pemenang;
              return (
                <Link key={m.id} href={`/liga/${m.id}`} className="fx">
                  <span className="fx-team home">{teamNama(m.home)} <Crest team={m.home} size="sm" /></span>
                  <span className="stack" style={{ gap: 2, alignItems: "center" }}>
                    <span className={skor ? "scorebox" : "scorebox time"}>{skor ? `${m.sh} - ${m.sa}` : "vs"}</span>
                    {pk && <small className="muted" style={{ fontSize: 10 }}>PK: {teamNama(m.penalti_pemenang!)}</small>}
                    {statusLaga(m) === "live" && <span className="pill bad" style={{ fontSize: 10, padding: "1px 6px" }}>LIVE</span>}
                    {statusLaga(m) === "selesai" && <small className="muted" style={{ fontSize: 10 }}>Selesai</small>}
                  </span>
                  <span className="fx-team away"><Crest team={m.away} size="sm" /> {teamNama(m.away)}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="panel">
          <div className="tablewrap">
            <table className="table">
              <thead><tr>
                <th className="pos">#</th><th>Tim</th><th className="n">M</th>
                <th className="n hide-sm"><abbr title="Menang">W</abbr></th>
                <th className="n hide-sm"><abbr title="Menang adu penalti">WP</abbr></th>
                <th className="n hide-sm"><abbr title="Kalah adu penalti">LP</abbr></th>
                <th className="n hide-sm"><abbr title="Kalah">L</abbr></th>
                <th className="n hide-sm">Gol</th><th className="n">+/-</th>
                <th className="n hide-sm"><abbr title="Poin fair play: kuning 1, 2 kuning 3, merah 4 (makin kecil makin baik)">FP</abbr></th>
                <th className="n">Poin</th><th className="hide-sm">Form</th>
              </tr></thead>
              <tbody>
                {k.map((r, i) => (
                  <tr key={r.tim} className={i === 0 ? "lead" : ""}>
                    <td className="pos">{i + 1}</td>
                    <td><div className="clubcell"><Crest team={r.tim} size="sm" /> {teamNama(r.tim)}</div></td>
                    <td className="n">{r.M}</td>
                    <td className="n hide-sm">{r.W}</td>
                    <td className="n hide-sm">{r.WP}</td>
                    <td className="n hide-sm">{r.LP}</td>
                    <td className="n hide-sm">{r.L}</td>
                    <td className="n hide-sm">{r.GM}-{r.GA}</td>
                    <td className="n">{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                    <td className="n hide-sm">{r.FP}</td>
                    <td className="n pts">{r.P}</td>
                    <td className="hide-sm"><FormGuide results={formGuide(matches, r.tim)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <TabelPoin judul="Pemain terbaik" ket={`Semua posisi.${syarat}`} list={terbaik} minLaga={minLaga} tampilPos />
        <div className="grid2">
          <TabelPoin judul="Bek terbaik" ket={`Pemain belakang.${syarat}`} list={bek} minLaga={minLaga} />
          <TabelPoin judul="Midfield terbaik" ket={`Pemain tengah.${syarat}`} list={mid} minLaga={minLaga} />
        </div>
        <CaraHitung />

        <div className="grid2">
        <div className="panel">
          <h3>Top skor</h3>
          {top.length === 0 ? <p className="muted">Belum ada pemain diassign ke tim.</p> : (
            <div className="tablewrap scroll">
              <table className="table compact">
                <thead><tr><th className="pos">#</th><th>Pemain</th><th>Tim</th><th className="n">Gol</th></tr></thead>
                <tbody>{top.map((r, i) => <tr key={r.id}><td className="pos">{i + 1}</td><td>{r.nama}</td><td>{teamNama(r.tim)}</td><td className="n pts">{r.gol}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Kiper terbaik</h3>
          <p className="muted" style={{ margin: "2px 0 8px" }}><small>Rata-rata = total kebobolan ÷ laga yang dihadiri. Hadir di semua laga: rata-rata dikurangi {String(KIPER_BONUS_PENUH).replace(".", ",")}. Urut rata-rata terkecil, lalu clean sheet terbanyak.{syarat}</small></p>
          {kiper.length === 0 ? <p className="muted">Belum ada kiper di tim.</p> : (
            <div className="tablewrap scroll">
              <table className="table compact">
                <thead><tr><th className="pos">#</th><th>Kiper</th><th className="n"><abbr title="Laga dihadiri / laga tim">Main</abbr></th><th className="n"><abbr title="Total kebobolan">Kbl</abbr></th><th className="n"><abbr title="Clean sheet (tidak kebobolan)">CS</abbr></th><th className="n"><abbr title="Rata-rata kebobolan per laga, setelah bonus hadir penuh">Rata</abbr></th></tr></thead>
                <tbody>{kiper.map((g, i) => (
                  <tr key={g.userId} className={i === 0 && g.lolos ? "lead" : ""}>
                    <td className="pos">{g.lolos ? i + 1 : "-"}</td>
                    <td>{g.nama} <small className="muted">{teamNama(g.team)}</small>{g.penuh && <> <span className="pill ok">Hadir penuh</span></>}{!g.lolos && <> <span className="pill neutral">belum {minLaga} laga</span></>}</td>
                    <td className="n">{g.main}/{g.lagaTim}</td>
                    <td className="n">{g.main ? g.kebobolan : "-"}</td>
                    <td className="n">{g.main ? g.cs : "-"}</td>
                    <td className="n pts">{g.rataAkhir === null ? "-" : g.rataAkhir.toFixed(1)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        </div>

        <div className="panel">
          <h3>Tim dan pemain</h3>
          <div className="grid2">
            {TEAM_CODES.map((t) => (
              <div key={t} style={{ borderLeft: `3px solid var(--team-${t.toLowerCase()})`, paddingLeft: 12 }}>
                <div className="clubcell" style={{ marginBottom: 6 }}><Crest team={t} /> <b>{teamNama(t)}</b> <span className="pill neutral">{(db.teams[t] || []).length}/10</span></div>
                <div className="people">
                  {urutkanPosisi(db.teams[t] || []).map((m, i) => {
                    const u = db.users.find((x) => x.id === m.userId);
                    return <div key={i} className="person"><span className="pill neutral">{m.posisi}</span> {u?.nama || m.userId} {(skorsing[m.userId] || 0) > 0 && <span className="pill bad">Skorsing {skorsing[m.userId]} laga</span>}</div>;
                  })}
                  {(db.teams[t] || []).length === 0 && <p className="muted"><small>Belum ada pemain.</small></p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type BarisPoin = RekapPemain & { nama: string; lolos: boolean };

function TabelPoin({ judul, ket, list, minLaga, tampilPos }: { judul: string; ket: string; list: BarisPoin[]; minLaga: number; tampilPos?: boolean }) {
  return (
    <div className="panel">
      <h3>{judul}</h3>
      <p className="muted" style={{ margin: "2px 0 8px" }}><small>{ket}</small></p>
      {list.length === 0 ? <p className="muted">Belum ada pemain di posisi ini.</p> : (
        <div className="tablewrap scroll">
          <table className="table compact">
            <thead><tr>
              <th className="pos">#</th><th>Pemain</th><th className="n"><abbr title="Laga dihadiri / laga tim">Main</abbr></th>
              <th className="n">Gol</th><th className="n"><abbr title="Assist">Ast</abbr></th><th className="n"><abbr title="Clean sheet">CS</abbr></th>
              <th className="n"><abbr title="Poin kartu (dikurangkan)">Kartu</abbr></th><th className="n">Poin</th>
            </tr></thead>
            <tbody>{list.map((r, i) => (
              <tr key={r.userId} className={i === 0 && r.lolos && r.poin > 0 ? "lead" : ""}>
                <td className="pos">{r.lolos ? i + 1 : "-"}</td>
                <td>
                  {r.nama} <small className="muted">{tampilPos ? `${r.posisi} · ` : ""}{teamNama(r.team)}</small>
                  {r.penuh && <> <span className="pill ok">Hadir penuh</span></>}
                  {!r.lolos && <> <span className="pill neutral">belum {minLaga} laga</span></>}
                </td>
                <td className="n">{r.main}/{r.lagaTim}</td>
                <td className="n">{r.gol}</td>
                <td className="n">{r.assist}</td>
                <td className="n">{r.cs}</td>
                <td className="n">{r.kartu ? `-${r.kartu}` : 0}</td>
                <td className="n pts">{r.poin}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const POSISI_KOLOM = ["GK", "Belakang", "Tengah", "Depan"] as const;
function CaraHitung() {
  const P = POIN_PEMAIN;
  const sel = (v: number) => (v ? `+${v}` : "-");
  return (
    <details className="panel">
      <summary><b>Cara hitung poin penghargaan</b></summary>
      <div className="tablewrap" style={{ marginTop: 8 }}>
        <table className="table compact">
          <thead><tr><th>Aksi</th>{POSISI_KOLOM.map((k) => <th key={k} className="n">{k}</th>)}</tr></thead>
          <tbody>
            <tr><td>Hadir di laga</td><td className="n" colSpan={4}>+{P.hadir} per laga</td></tr>
            <tr><td>Hadir di semua laga tim</td><td className="n" colSpan={4}>+{P.hadirPenuh} bonus</td></tr>
            <tr><td>Gol</td>{POSISI_KOLOM.map((k) => <td key={k} className="n">{sel(P.gol[k])}</td>)}</tr>
            <tr><td>Assist</td>{POSISI_KOLOM.map((k) => <td key={k} className="n">{sel(P.assist[k])}</td>)}</tr>
            <tr><td>Clean sheet</td>{POSISI_KOLOM.map((k) => <td key={k} className="n">{sel(P.cleanSheet[k])}</td>)}</tr>
            <tr><td>Kartu kuning / 2 kuning / merah</td><td className="n" colSpan={4}>-1 / -3 / -4</td></tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 8 }}><small>
        Clean sheet kiper = kiper itu tidak kebobolan. Clean sheet bek dan tengah = timnya tidak kebobolan di laga yang dia hadiri.
        Hanya laga yang sudah selesai yang dihitung. Kalau poin sama, urutan dilihat dari gol + assist, lalu laga dihadiri, lalu kartu paling sedikit.
        Kiper terbaik tetap memakai rata-rata kebobolan.
      </small></p>
    </details>
  );
}
