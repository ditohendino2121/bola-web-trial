"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDB, Loading, LoadError, Crest, Empty, CardTag } from "../../../components/ui";
import Icon from "../../../components/Icon";
import { supa } from "../../../lib/supa";
import { teamNama, urutkanPosisi, hitungSkorsing } from "../../../lib/rules";

type Kartu = "tidak" | "kuning" | "kuning2" | "merah";
const KARTU_OPSI: { k: Kartu; label: string }[] = [
  { k: "tidak", label: "Tanpa kartu" },
  { k: "kuning", label: "Kartu kuning" },
  { k: "kuning2", label: "2 kartu kuning (merah)" },
  { k: "merah", label: "Merah langsung" },
];

function KartuIkon({ k }: { k: Kartu }) {
  if (k === "tidak") return <>-</>;
  if (k === "kuning") return <CardTag kartu="kuning" />;
  if (k === "merah") return <CardTag kartu="merah" />;
  return <span style={{ display: "inline-flex", gap: 1 }}><CardTag kartu="kuning" /><CardTag kartu="kuning" /></span>;
}

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
        gol: ex?.gol ?? 0, kartu: (ex?.kartu as Kartu) ?? "tidak",
      };
    }));
  }, [db, matchId]);

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="detail laga" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  const isAdmin = me?.role === "admin";
  const match = db.matches.find((x) => x.id === matchId);
  if (!match) return <div className="page wrap"><Empty title="Laga tidak ditemukan" action={<div className="row" style={{ justifyContent: "center", marginTop: 10 }}><Link href="/liga"><button className="btn ghost">Ke Liga</button></Link><Link href="/klasemen"><button className="btn ghost">Ke Klasemen</button></Link></div>} /></div>;

  const skorLengkap = match.sh !== null && match.sa !== null;
  const imbang = skorLengkap && match.sh === match.sa;
  const skorsing = hitungSkorsing(db.matches, db.playerStats, db.teams);

  // Skor tersimpan otomatis saat kolom ditinggalkan (tanpa tombol simpan).
  const simpanSkor = async (nextSh: string, nextSa: string) => {
    if (!isAdmin) return;
    const shNum = nextSh === "" ? null : parseInt(nextSh);
    const saNum = nextSa === "" ? null : parseInt(nextSa);
    if (shNum === match.sh && saNum === match.sa) return;
    const patch: any = { sh: shNum, sa: saNum };
    if (shNum === null || saNum === null || shNum !== saNum) patch.penalti_pemenang = null; // bukan imbang -> adu penalti tidak berlaku
    setBusy(true);
    try {
      const { error: e } = await supa().from("league_matches").update(patch).eq("id", matchId);
      if (e) throw new Error(e.message);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const simpanPenalti = async (tim: string | null) => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { error: e } = await supa().from("league_matches").update({ penalti_pemenang: tim }).eq("id", matchId);
      if (e) throw new Error(e.message);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const simpanPenilaian = async () => {
    if (!isAdmin) return;
    const golHome = rows.filter((r) => r.team === match.home).reduce((a, c) => a + Number(c.gol || 0), 0);
    const golAway = rows.filter((r) => r.team === match.away).reduce((a, c) => a + Number(c.gol || 0), 0);
    if (match.sh !== null && golHome !== match.sh && !confirm(`Total gol ${teamNama(match.home)} di tabel = ${golHome}, tapi skor = ${match.sh}. Tetap simpan?`)) return;
    if (match.sa !== null && golAway !== match.sa && !confirm(`Total gol ${teamNama(match.away)} di tabel = ${golAway}, tapi skor = ${match.sa}. Tetap simpan?`)) return;
    setBusy(true);
    try {
      // Kolom rubrik lama (assist, aksi, SoT, blunder, nilai) tidak dipakai lagi — diisi default.
      const payload = rows.map((r) => ({
        match_id: matchId, user_id: r.user_id, team: r.team, posisi: r.posisi,
        gol: Number(r.gol) || 0, kartu: r.kartu,
        assist: 0, aksi_kunci: 0, shot_on_target: 0, blunder: 0, nilai_oto: null, override: null, catatan_override: "",
      }));
      const { error: e } = await supa().from("league_player_stats").upsert(payload, { onConflict: "match_id,user_id" });
      if (e) throw new Error(e.message);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const hapusPenilaian = async () => {
    if (!isAdmin || !confirm("Hapus semua catatan gol & kartu pertandingan ini? Tidak bisa dibatalkan.")) return;
    setBusy(true);
    try {
      const { error: e } = await supa().from("league_player_stats").delete().eq("match_id", matchId);
      if (e) throw new Error(e.message);
      await reload();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const updateRow = (idx: number, patch: any) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const adaTersimpan = db.playerStats.some((p) => p.match_id === matchId);
  const kebobolan = (team: string) => (team === match.home ? match.sa : match.sh);

  // Pencetak gol & kartu per tim (live-score style), di bawah logo masing-masing.
  const statLines = (team: string) => {
    const saved = db.playerStats.filter((p) => p.match_id === matchId && p.team === team);
    const nama = (id: string) => db.users.find((u) => u.id === id)?.nama || id;
    return [
      ...saved.filter((p) => (p.gol || 0) > 0).map((p) => <div key={`${p.user_id}-g`} className="statline"><Icon name="ball" /><span>{nama(p.user_id)} - {p.gol}</span></div>),
      ...saved.filter((p) => p.kartu && p.kartu !== "tidak").map((p) => <div key={`${p.user_id}-k`} className="statline"><KartuIkon k={p.kartu as Kartu} /><span>{nama(p.user_id)}</span></div>),
    ];
  };

  const sisi = (team: string) => (
    <div className="mc-side">
      <Crest team={team} size="lg" />
      <p className="mc-team">{teamNama(team)}</p>
      <div className="stack" style={{ gap: 2 }}>{statLines(team)}</div>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <div className="wrap" style={{ paddingBottom: 20 }}>
          <div className="crumbs"><Link href="/liga">Liga</Link> / <Link href="/klasemen">Klasemen</Link></div>
          <div className="mc">
            {sisi(match.home)}
            <div className="mc-score">
              <div className="mc-num">{skorLengkap ? `${match.sh} - ${match.sa}` : "vs"}</div>
              {imbang && match.penalti_pemenang && <small>Adu penalti: {teamNama(match.penalti_pemenang)} menang</small>}
              {imbang && !match.penalti_pemenang && <small>Imbang, adu penalti belum diisi</small>}
              <small>{match.tanggal} {match.jam}</small>
            </div>
            {sisi(match.away)}
          </div>
        </div>
      </div>

      <div className="page wrap">
        {isAdmin && (
          <div className="panel">
            <h3>Skor</h3>
            <p className="muted"><small>Tersimpan otomatis begitu kolom ditinggalkan.</small></p>
            <div className="grid2">
              <label className="field"><span>Skor {teamNama(match.home)}</span><input inputMode="numeric" value={sh} placeholder="0" disabled={busy} onChange={(e) => setSh(e.target.value.replace(/\D/g, ""))} onBlur={() => simpanSkor(sh, sa)} /></label>
              <label className="field"><span>Skor {teamNama(match.away)}</span><input inputMode="numeric" value={sa} placeholder="0" disabled={busy} onChange={(e) => setSa(e.target.value.replace(/\D/g, ""))} onBlur={() => simpanSkor(sh, sa)} /></label>
            </div>
            {imbang && (
              <div className="panel" style={{ background: "var(--gold-wash)", marginTop: 8 }}>
                <h4>Skor imbang — siapa menang adu penalti?</h4>
                <p className="muted"><small>Tidak ada hasil seri. Menang adu penalti 2 poin, kalah adu penalti 1 poin. Jumlah penendang bebas, ditentukan admin.</small></p>
                <div className="row">
                  {[match.home, match.away].map((t) => (
                    <button key={t} className={`btn sm ${match.penalti_pemenang === t ? "" : "ghost"}`} aria-pressed={match.penalti_pemenang === t} disabled={busy} onClick={() => simpanPenalti(t)}>{teamNama(t)}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="panel">
          <h3>Catatan pemain {isAdmin ? "" : "(lihat)"}</h3>
          <p className="muted"><small>Gol tiap pemain, kebobolan kiper (otomatis dari skor), dan kartu. Skorsing dihitung otomatis dari kartu.</small></p>
          <div className="grid2">
            {[match.home, match.away].map((team) => {
              const list = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.team === team);
              return (
                <div key={team}>
                  <h4 className="clubcell" style={{ marginBottom: 6 }}><Crest team={team} size="sm" /> {teamNama(team)}</h4>
                  <div className="tablewrap"><table className="table compact">
                    <thead><tr><th>Pemain</th><th>Pos</th><th className="n">Gol</th><th className="n"><abbr title="Gol kebobolan (kiper)">Kbl</abbr></th><th>Kartu</th></tr></thead>
                    <tbody>
                      {list.map(({ r, idx }) => (
                        <tr key={r.user_id}>
                          <td>{r.nama}{(skorsing[r.user_id] || 0) > 0 && <> <span className="pill bad">Skorsing {skorsing[r.user_id]} laga</span></>}</td>
                          <td>{r.posisi}</td>
                          <td className="n">{isAdmin ? <input style={{ width: 52 }} inputMode="numeric" value={r.gol} onChange={(e) => updateRow(idx, { gol: e.target.value.replace(/\D/g, "") })} /> : r.gol}</td>
                          <td className="n">{r.posisi === "GK" ? (kebobolan(team) ?? "-") : ""}</td>
                          <td>
                            {isAdmin ? (
                              <div className="row" style={{ gap: 3, flexWrap: "nowrap" }}>
                                {KARTU_OPSI.map((o) => (
                                  <button key={o.k} type="button" className="iconbtn" style={{ width: o.k === "kuning2" ? 34 : 28, height: 28 }} aria-pressed={r.kartu === o.k} aria-label={o.label} title={o.label} onClick={() => updateRow(idx, { kartu: o.k })}><KartuIkon k={o.k} /></button>
                                ))}
                              </div>
                            ) : <KartuIkon k={r.kartu} />}
                          </td>
                        </tr>
                      ))}
                      {list.length === 0 && <tr><td colSpan={5}><p className="muted" style={{ margin: "8px 0" }}>Belum ada pemain di tim ini.</p></td></tr>}
                    </tbody>
                  </table></div>
                </div>
              );
            })}
          </div>
          {isAdmin && (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" disabled={busy} onClick={simpanPenilaian}>Simpan catatan pemain</button>
              {adaTersimpan && <button className="btn danger" disabled={busy} onClick={hapusPenilaian}>Hapus catatan pertandingan ini</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
