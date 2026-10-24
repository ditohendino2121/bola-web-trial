"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Loading, LoadError, Tabs, Crest, FormGuide, SponsorPanel } from "../../components/ui";
import { klasemen, teamNama, formGuide, TEAM_CODES, urutkanPosisi, hitungSkorsing } from "../../lib/rules";

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
  ms.forEach((m) => {
    const rows = playerStats.filter((p) => p.match_id === m.id);
    if (rows.length > 0) rows.forEach((ps) => { golMap[ps.user_id] = (golMap[ps.user_id] || 0) + (ps.gol || 0); });
    else (m.goals || []).forEach((g) => { golMap[g.scorerId] = (golMap[g.scorerId] || 0) + 1; });
  });
  const timOf = (id: string) => roster.find((r) => r.userId === id)?.team || "-";
  const top = Object.keys(golMap)
    .map((id) => ({ id, nama: db.users.find((x) => x.id === id)?.nama || id, tim: timOf(id), gol: golMap[id] || 0 }))
    .sort((a, b) => b.gol - a.gol);

  // Syarat masuk peringkat Kiper terbaik (khusus Overall; per edisi tiap tim cuma main 1 laga).
  const MIN_LAGA_KIPER = 4;
  // Kiper terbaik: dari kebobolan yang diinput per kiper. Laga dihitung kalau kebobolannya diisi
  // (kosong = kiper itu tidak main). Urut rata-rata kebobolan terkecil, lalu clean sheet terbanyak.
  const msIds = new Set(ms.map((m) => m.id));
  const kiper = TEAM_CODES.flatMap((t) => (db.teams[t] || []).filter((m) => m.posisi === "GK").map((m) => ({ userId: m.userId, team: t })))
    .map((g) => {
      const main = playerStats.filter((p) => p.user_id === g.userId && msIds.has(p.match_id) && p.kebobolan !== null && p.kebobolan !== undefined);
      const total = main.reduce((a, p) => a + (p.kebobolan || 0), 0);
      return {
        ...g, nama: db.users.find((u) => u.id === g.userId)?.nama || g.userId,
        main: main.length, total, cs: main.filter((p) => p.kebobolan === 0).length,
        rata: main.length ? total / main.length : null,
      };
    })
    .map((g) => ({ ...g, lolos: selectedEd !== "overall" || g.main >= MIN_LAGA_KIPER }))
    .sort((a, b) => Number(b.lolos) - Number(a.lolos) || (a.rata ?? Infinity) - (b.rata ?? Infinity) || b.cs - a.cs || b.main - a.main);

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
          <p className="muted" style={{ margin: "2px 0 8px" }}><small>Rata-rata = total kebobolan ÷ laga yang dimainkan (laga absen tidak dihitung). Urut rata-rata terkecil, lalu clean sheet terbanyak.{selectedEd === "overall" ? ` Masuk peringkat setelah main minimal ${MIN_LAGA_KIPER} laga.` : ""}</small></p>
          {kiper.length === 0 ? <p className="muted">Belum ada kiper di tim.</p> : (
            <div className="tablewrap scroll">
              <table className="table compact">
                <thead><tr><th className="pos">#</th><th>Kiper</th><th className="n">Main</th><th className="n"><abbr title="Total kebobolan">Kbl</abbr></th><th className="n"><abbr title="Rata-rata kebobolan per laga">Rata</abbr></th><th className="n"><abbr title="Clean sheet (tidak kebobolan)">CS</abbr></th></tr></thead>
                <tbody>{kiper.map((g, i) => (
                  <tr key={g.userId} className={i === 0 && g.lolos && g.main > 0 ? "lead" : ""}>
                    <td className="pos">{g.lolos ? i + 1 : "-"}</td>
                    <td>{g.nama} <small className="muted">{teamNama(g.team)}</small>{!g.lolos && <> <span className="pill neutral">belum {MIN_LAGA_KIPER} laga</span></>}</td>
                    <td className="n">{g.main}</td>
                    <td className="n">{g.main ? g.total : "-"}</td>
                    <td className="n pts">{g.rata === null ? "-" : g.rata.toFixed(1)}</td>
                    <td className="n">{g.main ? g.cs : "-"}</td>
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
