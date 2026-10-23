"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDB, Loading, LoadError, Crest, Empty, CardTag } from "../../../components/ui";
import Icon from "../../../components/Icon";
import { supa } from "../../../lib/supa";
import { teamNama, urutkanPosisi } from "../../../lib/rules";
import { hitungNilaiOto, finalNilai } from "../_parts/rating";

export default function LigaDetail() {
  const params = useParams() as any;
  const matchId = params.matchId as string;
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [sh, setSh] = useState(""); const [sa, setSa] = useState("");
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!db) return;
    const m = db.matches.find((x) => x.id === matchId);
    if (m) { setSh(m.sh !== null ? String(m.sh) : ""); setSa(m.sa !== null ? String(m.sa) : ""); }
    const homeMembers = urutkanPosisi(db.teams[m?.home || ""] || []);
    const awayMembers = urutkanPosisi(db.teams[m?.away || ""] || []);
    const all = [...homeMembers.map((x) => ({ ...x, team: m?.home })), ...awayMembers.map((x) => ({ ...x, team: m?.away }))];
    const existing = db.playerStats.filter((p) => p.match_id === matchId);
    setRows(all.map((mem) => {
      const ex = existing.find((e) => e.user_id === mem.userId);
      return {
        user_id: mem.userId, team: mem.team, posisi: mem.posisi,
        nama: db.users.find((u) => u.id === mem.userId)?.nama || mem.userId,
        gol: ex?.gol ?? 0, assist: ex?.assist ?? 0, aksi_kunci: ex?.aksi_kunci ?? 0, shot_on_target: ex?.shot_on_target ?? 0,
        kartu: ex?.kartu ?? "tidak", blunder: ex?.blunder ?? 0, override: ex?.override ?? null, catatan_override: ex?.catatan_override ?? "",
      };
    }));
  }, [db, matchId]);

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="detail laga" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  const isAdmin = me?.role === "admin";
  const match = db.matches.find((x) => x.id === matchId);
  if (!match) return <div className="page wrap"><Empty title="Laga tidak ditemukan" action={<div className="row" style={{ justifyContent: "center", marginTop: 10 }}><Link href="/liga"><button className="btn ghost">Ke Liga</button></Link><Link href="/klasemen"><button className="btn ghost">Ke Klasemen</button></Link></div>} /></div>;

  const kebobolanFor = (team: string) => team === match.home ? (sa === "" ? 0 : Number(sa) || 0) : (sh === "" ? 0 : Number(sh) || 0);
  const cleanSheet = sh !== "" && sa !== "";

  const saveSkor = async () => {
    if (!isAdmin) return alert("Hanya admin.");
    setBusy(true);
    try {
      const shNum = sh === "" ? null : parseInt(sh);
      const saNum = sa === "" ? null : parseInt(sa);
      const { error: e } = await supa().from("league_matches").update({ sh: shNum, sa: saNum }).eq("id", matchId);
      if (e) throw new Error(e.message);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  // Fix dari versi lama: validasi SEMUA baris dulu (override wajib catatan) sebelum menulis apa
  // pun. Dulu validasi di tengah loop, jadi sebagian baris bisa sudah tersimpan saat baris lain
  // gagal — sekarang berhenti total sebelum ada yang ditulis.
  const saveNilai = async () => {
    if (!isAdmin) return alert("Hanya admin.");
    const totalHomeGol = rows.filter((r) => r.team === match.home).reduce((a, c) => a + Number(c.gol || 0), 0);
    const totalAwayGol = rows.filter((r) => r.team === match.away).reduce((a, c) => a + Number(c.gol || 0), 0);
    if (sh !== "" && totalHomeGol !== Number(sh) && !confirm(`Total gol tim ${teamNama(match.home)} di tabel = ${totalHomeGol}, tapi skor = ${sh}. Tetap simpan?`)) return;
    if (sa !== "" && totalAwayGol !== Number(sa) && !confirm(`Total gol tim ${teamNama(match.away)} di tabel = ${totalAwayGol}, tapi skor = ${sa}. Tetap simpan?`)) return;
    if ((sh === "" || sa === "") && !confirm("Skor belum diisi — nilai oto untuk kebobolan/clean sheet dihitung asumsi 0. Tetap simpan nilai sekarang?")) return;

    const missing = rows.filter((r) => r.override !== "" && r.override !== null && r.override !== undefined && !isNaN(parseFloat(r.override)) && !r.catatan_override);
    if (missing.length > 0) return alert(`Override wajib diisi catatan untuk: ${missing.map((r) => r.nama).join(", ")}.`);

    setBusy(true);
    try {
      const payload = rows.map((r) => {
        const { nilai_oto } = hitungNilaiOto({
          posisi: r.posisi, gol: Number(r.gol) || 0, assist: Number(r.assist) || 0,
          aksi_kunci: Number(r.aksi_kunci) || 0, shot_on_target: Number(r.shot_on_target) || 0,
          kartu: r.kartu, blunder: Number(r.blunder) || 0, kebobolan: kebobolanFor(r.team), cleanSheet,
        });
        const ov = r.override === "" || r.override === null || r.override === undefined ? null : (isNaN(parseFloat(r.override)) ? null : parseFloat(r.override));
        return {
          match_id: matchId, user_id: r.user_id, team: r.team, posisi: r.posisi,
          gol: Number(r.gol) || 0, assist: Number(r.assist) || 0, aksi_kunci: Number(r.aksi_kunci) || 0, shot_on_target: Number(r.shot_on_target) || 0,
          kartu: r.kartu, blunder: Number(r.blunder) || 0, nilai_oto, override: ov, catatan_override: r.catatan_override || "",
        };
      });
      const { error: e } = await supa().from("league_player_stats").upsert(payload, { onConflict: "match_id,user_id" });
      if (e) throw new Error(e.message);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const updateRow = (idx: number, patch: any) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const hapusNilai = async () => {
    if (!isAdmin) return alert("Hanya admin.");
    if (!confirm("Hapus SEMUA nilai pertandingan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    setBusy(true);
    try {
      const { error: e } = await supa().from("league_player_stats").delete().eq("match_id", matchId);
      if (e) throw new Error(e.message);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };
  const adaNilaiTersimpan = db.playerStats.some((p) => p.match_id === matchId);

  // Live-score style: pencetak gol/assist/kartu per tim, ditaruh di bawah crest masing-masing.
  const statLinesFor = (team: string) => {
    const teamRows = rows.filter((r) => r.team === team);
    const lines: { key: string; node: React.ReactNode }[] = [];
    teamRows.forEach((r) => { if (Number(r.gol) > 0) lines.push({ key: `${r.user_id}-gol`, node: <><Icon name="ball" /><span>{r.nama} - {Number(r.gol)}</span></> }); });
    teamRows.forEach((r) => { if (Number(r.assist) > 0) lines.push({ key: `${r.user_id}-ast`, node: <><Icon name="boot" /><span>{r.nama} - {Number(r.assist)}</span></> }); });
    teamRows.forEach((r) => { if (r.kartu === "kuning" || r.kartu === "merah") lines.push({ key: `${r.user_id}-kartu`, node: <><CardTag kartu={r.kartu} /><span>{r.nama}</span></> }); });
    return lines.map((l) => <div key={l.key} className="statline">{l.node}</div>);
  };

  const renderRow = (r: any, idx: number) => {
    const { nilai_oto } = hitungNilaiOto({
      posisi: r.posisi, gol: Number(r.gol) || 0, assist: Number(r.assist) || 0,
      aksi_kunci: Number(r.aksi_kunci) || 0, shot_on_target: Number(r.shot_on_target) || 0,
      kartu: r.kartu, blunder: Number(r.blunder) || 0, kebobolan: kebobolanFor(r.team), cleanSheet,
    });
    const final = finalNilai(nilai_oto, r.override === "" ? null : r.override);
    return (
      <tr key={r.user_id}>
        <td><b>{r.nama}</b></td>
        <td>{r.posisi}</td>
        <td><input style={{ width: 52 }} type="number" min={0} value={r.gol} disabled={!isAdmin} onChange={(e) => updateRow(idx, { gol: e.target.value })} /></td>
        <td><input style={{ width: 52 }} type="number" min={0} value={r.assist} disabled={!isAdmin} onChange={(e) => updateRow(idx, { assist: e.target.value })} /></td>
        <td><input style={{ width: 52 }} type="number" min={0} value={r.aksi_kunci} disabled={!isAdmin} onChange={(e) => updateRow(idx, { aksi_kunci: e.target.value })} /></td>
        <td><input style={{ width: 52 }} type="number" min={0} value={r.shot_on_target} disabled={!isAdmin} onChange={(e) => updateRow(idx, { shot_on_target: e.target.value })} /></td>
        <td>
          <div className="row" style={{ gap: 3, flexWrap: "nowrap" }}>
            <button type="button" className="iconbtn" style={{ width: 28, height: 28 }} aria-pressed={r.kartu === "tidak"} aria-label="Tanpa kartu" disabled={!isAdmin} onClick={() => updateRow(idx, { kartu: "tidak" })}>-</button>
            <button type="button" className="iconbtn" style={{ width: 28, height: 28 }} aria-pressed={r.kartu === "kuning"} aria-label="Kartu kuning" disabled={!isAdmin} onClick={() => updateRow(idx, { kartu: "kuning" })}><CardTag kartu="kuning" /></button>
            <button type="button" className="iconbtn" style={{ width: 28, height: 28 }} aria-pressed={r.kartu === "merah"} aria-label="Kartu merah" disabled={!isAdmin} onClick={() => updateRow(idx, { kartu: "merah" })}><CardTag kartu="merah" /></button>
          </div>
        </td>
        <td><input style={{ width: 52 }} type="number" min={0} max={2} value={r.blunder} disabled={!isAdmin} onChange={(e) => updateRow(idx, { blunder: e.target.value })} /></td>
        <td><b>{nilai_oto.toFixed(1)}</b></td>
        <td><b>{final.toFixed(1)}</b></td>
        <td>
          {isAdmin ? (
            <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
              <input style={{ width: 52 }} placeholder="±0.5" value={r.override ?? ""} onChange={(e) => updateRow(idx, { override: e.target.value })} />
              <input style={{ width: 96 }} placeholder="catatan" value={r.catatan_override} onChange={(e) => updateRow(idx, { catatan_override: e.target.value })} />
            </div>
          ) : (r.override ? `${r.override} (${r.catatan_override})` : "-")}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <p className="wrap" style={{ paddingTop: 16 }}><Link href="/liga" className="linkbtn">Kembali ke Liga</Link></p>
      <div className="wrap" style={{ textAlign: "center", padding: "20px 0" }}>
        <div className="row" style={{ justifyContent: "center", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ minWidth: 120 }}>
            <Crest team={match.home} size="lg" /><p style={{ fontWeight: 700, marginTop: 6 }}>{teamNama(match.home)}</p>
            <div className="stack" style={{ gap: 2, marginTop: 6 }}>{statLinesFor(match.home)}</div>
          </div>
          <div className="scorebox" style={{ fontSize: 28, padding: "8px 18px" }}>{match.sh === null || match.sa === null ? "vs" : `${match.sh} - ${match.sa}`}</div>
          <div style={{ minWidth: 120 }}>
            <Crest team={match.away} size="lg" /><p style={{ fontWeight: 700, marginTop: 6 }}>{teamNama(match.away)}</p>
            <div className="stack" style={{ gap: 2, marginTop: 6 }}>{statLinesFor(match.away)}</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 10 }}><small>{match.tanggal} {match.jam} {match.lokasi}</small></p>
      </div>

      <div className="page wrap">
        <div className="panel">
          <h3>Skor</h3>
          <div className="grid2">
            <label className="field"><span>Skor {teamNama(match.home)}</span><input value={sh} onChange={(e) => setSh(e.target.value)} placeholder="0" disabled={!isAdmin} /></label>
            <label className="field"><span>Skor {teamNama(match.away)}</span><input value={sa} onChange={(e) => setSa(e.target.value)} placeholder="0" disabled={!isAdmin} /></label>
          </div>
          {isAdmin && <button className="btn" disabled={busy} onClick={saveSkor}>Simpan skor</button>}
        </div>

        <div className="panel">
          <h3>Penilaian pemain {isAdmin ? "(admin)" : "(lihat)"}</h3>
          <p className="muted"><small>Base 6.0 + gol/assist/aksi/clean sheet/kebobolan/kartu/blunder jadi nilai oto. Override maks ±0.5, wajib catatan.</small></p>
          <div className="grid2">
            {([match.home, match.away] as const).map((team) => {
              const rowsWithIdx = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.team === team);
              return (
                <div key={team}>
                  <h4><Crest team={team} size="sm" /> {teamNama(team)}</h4>
                  <div className="tablewrap"><table className="table compact">
                    <thead><tr><th>Pemain</th><th>Pos</th><th>Gol</th><th>Ast</th><th><abbr title="Save untuk GK, tekel untuk Belakang/Tengah">Aksi</abbr></th><th><abbr title="Shot on target">SoT</abbr></th><th>Kartu</th><th>Blun</th><th>Oto</th><th>Final</th><th>Override</th></tr></thead>
                    <tbody>
                      {rowsWithIdx.map(({ r, idx }) => renderRow(r, idx))}
                      {rowsWithIdx.length === 0 && <tr><td colSpan={10}><p className="muted" style={{ margin: "8px 0" }}>Belum ada pemain di tim ini.</p></td></tr>}
                    </tbody>
                  </table></div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            {isAdmin && <button className="btn" disabled={busy} onClick={saveNilai}>Simpan nilai</button>}
            {isAdmin && adaNilaiTersimpan && <button className="btn danger" disabled={busy} onClick={hapusNilai}>Hapus nilai pertandingan ini</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
