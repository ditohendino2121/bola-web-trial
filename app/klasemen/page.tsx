"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Loading, LoadError, Tabs, Crest, FormGuide } from "../../components/ui";
import { klasemen, teamNama, formGuide, TEAM_CODES } from "../../lib/rules";
import { finalNilai } from "../liga/_parts/rating";

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

  const k = klasemen(ms);
  const psFiltered = playerStats.filter((p) => ms.some((m) => m.id === p.match_id));

  // Roster liga-wide (semua pemain yang sudah diassign ke tim A-D). Dipakai sebagai basis Top
  // Skor & Player Stats biar SEMUA pemain terdaftar tetap tampil, bukan cuma yang sudah main.
  const roster = TEAM_CODES.flatMap((t) => (db.teams[t] || []).map((m) => ({ userId: m.userId, team: t, posisi: m.posisi })));
  const matchHasStats = (matchId: string) => playerStats.some((p) => p.match_id === matchId);
  const golMap: Record<string, number> = {};
  roster.forEach((r) => { golMap[r.userId] = 0; });
  ms.forEach((m) => {
    if (matchHasStats(m.id)) {
      playerStats.filter((p) => p.match_id === m.id).forEach((ps) => { golMap[ps.user_id] = (golMap[ps.user_id] || 0) + (ps.gol || 0); });
    } else {
      (m.goals || []).forEach((g) => { golMap[g.scorerId] = (golMap[g.scorerId] || 0) + 1; });
    }
  });
  const rosterIds = new Set(roster.map((r) => r.userId));
  const extraIds = Object.keys(golMap).filter((id) => !rosterIds.has(id));
  const timOf = (id: string) => roster.find((r) => r.userId === id)?.team || TEAM_CODES.find((t) => (db.teams[t] || []).some((m) => m.userId === id)) || "-";
  const top = [...roster.map((r) => r.userId), ...extraIds].map((id) => {
    const u = db.users.find((x) => x.id === id);
    return { id, nama: u?.nama || id, tim: timOf(id), gol: golMap[id] || 0 };
  }).sort((a, b) => b.gol - a.gol);

  const agg: Record<string, { nama: string; team: string; posisi: string; main: number; totalNilai: number; totalGol: number; countNilai: number; terbaik: number }> = {};
  roster.forEach((r) => {
    const u = db.users.find((x) => x.id === r.userId);
    agg[r.userId] = { nama: u?.nama || r.userId, team: r.team, posisi: r.posisi, main: 0, totalNilai: 0, totalGol: 0, countNilai: 0, terbaik: 0 };
  });
  for (const ps of psFiltered) {
    const u = db.users.find((x) => x.id === ps.user_id);
    if (!agg[ps.user_id]) agg[ps.user_id] = { nama: u?.nama || ps.user_id, team: ps.team, posisi: ps.posisi, main: 0, totalNilai: 0, totalGol: 0, countNilai: 0, terbaik: 0 };
    const a = agg[ps.user_id];
    a.main += 1;
    a.totalGol += ps.gol || 0;
    if (ps.nilai_oto !== null && ps.nilai_oto !== undefined) {
      const final = finalNilai(ps.nilai_oto, ps.override);
      a.totalNilai += final; a.countNilai += 1; a.terbaik = Math.max(a.terbaik, final);
    }
  }
  const stats = Object.values(agg)
    .map((a) => ({ ...a, avg: a.countNilai ? Math.round((a.totalNilai / a.countNilai) * 10) / 10 : null }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  const tabItems = [{ key: "overall", label: "Overall" }, ...editions.map((e) => ({ key: e.id, label: e.label }))];

  // Pencetak gol per laga (live-score style di bawah skor). Fallback ke m.goals untuk laga format lama.
  const scorersFor = (m: (typeof matches)[number]) => {
    const fromStats = playerStats.filter((p) => p.match_id === m.id && (p.gol || 0) > 0);
    const list = fromStats.length > 0
      ? fromStats.map((p) => ({ nama: db.users.find((u) => u.id === p.user_id)?.nama || p.user_id, gol: p.gol }))
      : Object.entries((m.goals || []).reduce((acc: Record<string, number>, g) => { acc[g.scorerId] = (acc[g.scorerId] || 0) + 1; return acc; }, {}))
        .map(([id, gol]) => ({ nama: db.users.find((u) => u.id === id)?.nama || id, gol }));
    return list.sort((a, b) => b.gol - a.gol);
  };

  return (
    <div>
      <PageHead
        title="Klasemen"
        desc="Posisi tim, top skor, dan nilai pemain KIM x DnA Health League."
        tabs={<Tabs items={tabItems} value={selectedEd} onChange={setSelectedEd} label="Pilih edisi" />}
      />
      <div className="page wrap">
        {edLabel && (
          <div className="panel">
            <h3>Pertandingan - {edLabel.label}</h3>
            {ms.length === 0 ? <p className="muted">Belum ada laga di edisi ini.</p> : ms.map((m) => {
              const scorers = scorersFor(m);
              return (
                <div key={m.id}>
                  <Link href={`/liga/${m.id}`} className="fx">
                    <span className="fx-team home">{teamNama(m.home)} <Crest team={m.home} size="sm" /></span>
                    <span className={m.sh === null || m.sa === null ? "scorebox time" : "scorebox"}>{m.sh === null || m.sa === null ? "vs" : `${m.sh}-${m.sa}`}</span>
                    <span className="fx-team away"><Crest team={m.away} size="sm" /> {teamNama(m.away)}</span>
                  </Link>
                  {scorers.length > 0 && <p className="muted" style={{ textAlign: "center", fontSize: 11, margin: "-2px 0 8px" }}>{scorers.map((s) => `${s.nama} - ${s.gol}`).join(" · ")}</p>}
                </div>
              );
            })}
          </div>
        )}

        <div className="panel">
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th className="pos">#</th><th>Tim</th><th className="n">M</th><th className="n hide-sm">W</th><th className="n hide-sm">D</th><th className="n hide-sm">L</th><th className="n hide-sm">Gol</th><th className="n hide-sm">+/-</th><th className="n">Poin</th><th className="hide-sm">Form</th></tr></thead>
              <tbody>
                {k.map((r, i) => (
                  <tr key={r.tim} className={i === 0 ? "lead" : ""}>
                    <td className="pos">{i + 1}</td>
                    <td><div className="clubcell"><Crest team={r.tim} size="sm" /> {teamNama(r.tim)}</div></td>
                    <td className="n">{r.M}</td>
                    <td className="n hide-sm">{r.W}</td>
                    <td className="n hide-sm">{r.D}</td>
                    <td className="n hide-sm">{r.L}</td>
                    <td className="n hide-sm">{r.GM}-{r.GA}</td>
                    <td className="n hide-sm">{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
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
            <h3>Player stats</h3>
            {stats.length === 0 ? <p className="muted">Belum ada pemain diassign ke tim.</p> : (
              <div className="tablewrap scroll">
                <table className="table compact">
                  <thead><tr><th className="pos">#</th><th>Pemain</th><th>Pos</th><th className="n">Main</th><th className="n">Avg</th><th className="n hide-sm">Terbaik</th></tr></thead>
                  <tbody>{stats.map((s, i) => (
                    <tr key={s.nama + i}><td className="pos">{i + 1}</td><td>{s.nama} <small className="muted">{teamNama(s.team)}</small></td><td>{s.posisi}</td><td className="n">{s.main}</td>
                      <td className="n pts">{s.avg !== null ? s.avg.toFixed(1) : "-"}</td><td className="n hide-sm">{s.main > 0 ? s.terbaik.toFixed(1) : "-"}</td></tr>
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
                  {(db.teams[t] || []).map((m, i) => {
                    const u = db.users.find((x) => x.id === m.userId);
                    return <div key={i} className="person"><span className="pill neutral">{m.posisi}</span> {u?.nama || m.userId}</div>;
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
