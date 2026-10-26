"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDB, Loading, LoadError, Crest, Empty, CardTag, Sponsors } from "../../../components/ui";
import Icon from "../../../components/Icon";
import { supa } from "../../../lib/supa";
import { mapPlayerStat } from "../../../lib/data";
import { teamNama, urutkanPosisi, hitungSkorsing, statusLaga, isAdmin as isAdminRole } from "../../../lib/rules";

type Kartu = "tidak" | "kuning" | "kuning2" | "merah";
const KARTU_OPSI: { k: Kartu; label: string }[] = [
  { k: "tidak", label: "Tanpa kartu" },
  { k: "kuning", label: "Kartu kuning" },
  { k: "kuning2", label: "2 kartu kuning (merah)" },
  { k: "merah", label: "Merah langsung" },
];
const JEDA_SIMPAN = 500; // ms setelah berhenti mengetik baru disimpan

function KartuIkon({ k }: { k: Kartu }) {
  if (k === "tidak") return <>-</>;
  if (k === "kuning") return <CardTag kartu="kuning" />;
  if (k === "merah") return <CardTag kartu="merah" />;
  return <span style={{ display: "inline-flex", gap: 1 }}><CardTag kartu="kuning" /><CardTag kartu="kuning" /></span>;
}

export default function LigaDetail() {
  const params = useParams() as any;
  const matchId = params.matchId as string;
  const { db, error, reload, setDb } = useDB();
  const [busy, setBusy] = useState(false);
  const [sh, setSh] = useState(""); const [sa, setSa] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<"" | "menyimpan" | "tersimpan" | "gagal">("");
  const initFor = useRef<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Isi form dari database SEKALI per laga (bukan tiap db berubah), supaya ketikan yang belum
  // tersimpan tidak tertimpa saat data lokal diperbarui setelah simpan.
  useEffect(() => {
    if (!db || initFor.current === matchId) return;
    const m = db.matches.find((x) => x.id === matchId);
    if (!m) return;
    initFor.current = matchId;
    setSh(m.sh !== null ? String(m.sh) : ""); setSa(m.sa !== null ? String(m.sa) : "");
    const all = [
      ...urutkanPosisi(db.teams[m.home] || []).map((x) => ({ ...x, team: m.home })),
      ...urutkanPosisi(db.teams[m.away] || []).map((x) => ({ ...x, team: m.away })),
    ];
    const existing = db.playerStats.filter((p) => p.match_id === matchId);
    setRows(all.map((mem) => {
      const ex = existing.find((e) => e.user_id === mem.userId);
      return {
        user_id: mem.userId, team: mem.team, posisi: mem.posisi,
        nama: db.users.find((u) => u.id === mem.userId)?.nama || mem.userId,
        hadir: ex ? ex.hadir : false,
        gol: ex ? String(ex.gol ?? 0) : "0", assist: ex ? String(ex.assist ?? 0) : "0", og: ex ? String(ex.gol_bunuh_diri ?? 0) : "0", kartu: (ex?.kartu as Kartu) ?? "tidak",
        kebobolan: ex?.kebobolan === null || ex?.kebobolan === undefined ? "" : String(ex.kebobolan),
      };
    }));
  }, [db, matchId]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="detail laga" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  const isAdmin = isAdminRole(me);
  const match = db.matches.find((x) => x.id === matchId);
  if (!match) return <div className="page wrap"><Empty title="Laga tidak ditemukan" action={<div className="row" style={{ justifyContent: "center", marginTop: 10 }}><Link href="/liga"><button className="btn ghost">Ke Liga</button></Link><Link href="/klasemen"><button className="btn ghost">Ke Klasemen</button></Link></div>} /></div>;

  // Tampilan atas pakai nilai yang sedang diketik (langsung berubah, tidak menunggu database).
  const skorLengkap = sh !== "" && sa !== "";
  const statusMain = statusLaga({ ...match, sh: sh === "" ? null : Number(sh), sa: sa === "" ? null : Number(sa) });
  const bisaEdit = isAdmin && !match.selesai; // laga selesai terkunci sampai admin "Buka lagi"
  const imbang = skorLengkap && sh === sa;
  const skorsing = hitungSkorsing(db.matches, db.playerStats, db.teams);

  const patchMatchLokal = (patch: any) => setDb((prev) => prev ? { ...prev, matches: prev.matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m)) } : prev);

  const jalankan = async (fn: () => Promise<void>) => {
    setStatus("menyimpan");
    try { await fn(); setStatus("tersimpan"); }
    catch (e: any) { setStatus("gagal"); alert(e.message); }
  };
  const antre = (key: string, fn: () => Promise<void>, segera = false) => {
    clearTimeout(timers.current[key]);
    if (segera) { delete timers.current[key]; jalankan(fn); return; }
    setStatus("menyimpan");
    timers.current[key] = setTimeout(() => { delete timers.current[key]; jalankan(fn); }, JEDA_SIMPAN);
  };

  const simpanSkor = async (nextSh: string, nextSa: string) => {
    const shNum = nextSh === "" ? null : parseInt(nextSh);
    const saNum = nextSa === "" ? null : parseInt(nextSa);
    const patch: any = { sh: shNum, sa: saNum };
    if (shNum === null || saNum === null || shNum !== saNum) patch.penalti_pemenang = null; // bukan imbang -> adu penalti tidak berlaku
    const { error: e } = await supa().from("league_matches").update(patch).eq("id", matchId);
    if (e) throw new Error(e.message);
    patchMatchLokal(patch);
  };

  const simpanPenalti = (tim: string | null) => antre("penalti", async () => {
    const { error: e } = await supa().from("league_matches").update({ penalti_pemenang: tim }).eq("id", matchId);
    if (e) throw new Error(e.message);
    patchMatchLokal({ penalti_pemenang: tim });
  }, true);

  // Kolom rubrik lama (aksi, SoT, blunder, nilai) tidak dipakai lagi — diisi default.
  const simpanBaris = async (r: any) => {
    const { data, error: e } = await supa().from("league_player_stats").upsert({
      match_id: matchId, user_id: r.user_id, team: r.team, posisi: r.posisi, hadir: !!r.hadir,
      gol: Number(r.gol) || 0, assist: Number(r.assist) || 0, gol_bunuh_diri: Number(r.og) || 0, kartu: r.kartu,
      // Kiper hadir: kosong dianggap 0. Kiper absen: null, tidak ikut hitungan rata-rata.
      kebobolan: r.posisi === "GK" && r.hadir ? Number(r.kebobolan) || 0 : null,
      aksi_kunci: 0, shot_on_target: 0, blunder: 0, nilai_oto: null, override: null, catatan_override: "",
    }, { onConflict: "match_id,user_id" }).select().single();
    if (e) throw new Error(e.message);
    const ps = mapPlayerStat(data);
    setDb((prev) => prev ? { ...prev, playerStats: [...prev.playerStats.filter((p) => !(p.match_id === matchId && p.user_id === r.user_id)), ps] } : prev);
  };
  const ubahBaris = (idx: number, patchAwal: any, segera = false) => {
    let patch = patchAwal;
    // Absen: semua catatan dikosongkan. Mengisi gol/assist/kebobolan/kartu otomatis menandai hadir.
    if (patch.hadir === false) patch = { ...patch, gol: "0", assist: "0", og: "0", kartu: "tidak", kebobolan: "" };
    else if (!rows[idx].hadir && (["gol", "assist", "og", "kebobolan"].some((k) => k in patch && patch[k] !== "") || (patch.kartu && patch.kartu !== "tidak"))) patch = { ...patch, hadir: true };
    const baru = { ...rows[idx], ...patch };
    const nextRows = rows.map((r, i) => (i === idx ? baru : r));
    setRows(nextRows);
    antre(`row-${baru.user_id}`, () => simpanBaris(baru), segera);
    // Skor otomatis = gol pemain tim sendiri + gol bunuh diri pemain lawan.
    if ("gol" in patch || "og" in patch) {
      const sum = (team: string, f: "gol" | "og") => nextRows.filter((r) => r.team === team).reduce((a, c) => a + (Number(c[f]) || 0), 0);
      const nextSh = String(sum(match.home, "gol") + sum(match.away, "og"));
      const nextSa = String(sum(match.away, "gol") + sum(match.home, "og"));
      setSh(nextSh); setSa(nextSa);
      antre("skor", () => simpanSkor(nextSh, nextSa));
    }
  };

  const hadirSemua = (team: string) => {
    const nextRows = rows.map((r) => (r.team === team && !r.hadir ? { ...r, hadir: true } : r));
    nextRows.forEach((r, i) => { if (r !== rows[i]) antre(`row-${r.user_id}`, () => simpanBaris(r), true); });
    setRows(nextRows);
  };

  // Reset total: skor, adu penalti, dan semua catatan pemain laga ini kembali kosong.
  // Tutup laga: skor dikunci (kosong -> 0), baru masuk klasemen & statistik.
  const selesaikan = async () => {
    if (!isAdmin) return;
    const fSh = sh === "" ? 0 : Number(sh), fSa = sa === "" ? 0 : Number(sa);
    if (fSh === fSa && !match.penalti_pemenang) return alert("Skor imbang. Pilih dulu pemenang adu penalti, baru pertandingan bisa diselesaikan.");
    const pk = fSh === fSa ? ` (adu penalti: ${teamNama(match.penalti_pemenang!)} menang)` : "";
    if (!confirm(`Selesaikan pertandingan dengan skor akhir ${teamNama(match.home)} ${fSh} - ${fSa} ${teamNama(match.away)}${pk}?
Setelah ini skor terkunci dan masuk klasemen.`)) return;
    Object.values(timers.current).forEach(clearTimeout); timers.current = {};
    setBusy(true);
    try {
      await Promise.all(rows.map((r) => simpanBaris(r))); // pastikan semua catatan pemain tersimpan
      const patch = { sh: fSh, sa: fSa, selesai: true };
      const { error: e } = await supa().from("league_matches").update(patch).eq("id", matchId);
      if (e) throw new Error(e.message);
      setSh(String(fSh)); setSa(String(fSa));
      patchMatchLokal(patch);
      setStatus("tersimpan");
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };
  const bukaLagi = async () => {
    if (!isAdmin || !confirm("Buka lagi pertandingan ini untuk koreksi? Hasilnya keluar dari klasemen sampai diselesaikan lagi.")) return;
    setBusy(true);
    try {
      const { error: e } = await supa().from("league_matches").update({ selesai: false }).eq("id", matchId);
      if (e) throw new Error(e.message);
      patchMatchLokal({ selesai: false });
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const resetPertandingan = async () => {
    if (!isAdmin || !confirm("Reset pertandingan ini? Skor, adu penalti, absensi, gol, assist, kebobolan, dan kartu semuanya dihapus. Tidak bisa dibatalkan.")) return;
    Object.values(timers.current).forEach(clearTimeout); timers.current = {};
    setBusy(true);
    try {
      const { error: e1 } = await supa().from("league_player_stats").delete().eq("match_id", matchId);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supa().from("league_matches").update({ sh: null, sa: null, penalti_pemenang: null, selesai: false }).eq("id", matchId);
      if (e2) throw new Error(e2.message);
      initFor.current = null;
      await reload();
      setStatus("");
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };


  // Pencetak gol & kartu per tim (dari isian lokal, jadi langsung muncul).
  const statLines = (team: string) => {
    const tim = rows.filter((r) => r.team === team);
    const lawan = rows.filter((r) => r.team !== team);
    return [
      ...tim.filter((r) => Number(r.gol) > 0).map((r) => <div key={`${r.user_id}-g`} className="statline"><Icon name="ball" /><span>{r.nama} - {Number(r.gol)}</span></div>),
      ...lawan.filter((r) => Number(r.og) > 0).map((r) => <div key={`${r.user_id}-og`} className="statline"><Icon name="ball" /><span>{r.nama} (bunuh diri){Number(r.og) > 1 ? ` - ${Number(r.og)}` : ""}</span></div>),
      ...tim.filter((r) => r.kartu !== "tidak").map((r) => <div key={`${r.user_id}-k`} className="statline"><KartuIkon k={r.kartu} /><span>{r.nama}</span></div>),
    ];
  };
  const sisi = (team: string) => (
    <div className="mc-side">
      <Crest team={team} size="lg" />
      <p className="mc-team">{teamNama(team)}</p>
      <div className="stack" style={{ gap: 2 }}>{statLines(team)}</div>
    </div>
  );

  const labelStatus = status === "menyimpan" ? "Menyimpan..." : status === "tersimpan" ? "Tersimpan" : status === "gagal" ? "Gagal menyimpan" : "";

  return (
    <div>
      <div className="page-head">
        <div className="wrap" style={{ paddingBottom: 20 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="crumbs"><Link href="/liga">Liga</Link> / <Link href="/klasemen">Klasemen</Link></div>
            <a href={`/liga/${matchId}/layar`} target="_blank" rel="noreferrer" className="mast-chip ghost" style={{ marginLeft: 0 }}>Tampilan layar</a>
          </div>
          <Sponsors className="mc-sponsors" label="Dipersembahkan oleh" />
          <div className="mc">
            {sisi(match.home)}
            <div className="mc-score">
              {statusMain === "live" && <span className="pill bad">LIVE</span>}
              {statusMain === "selesai" && <span className="pill neutral">Selesai</span>}
              <div className="mc-num">{skorLengkap ? `${sh} - ${sa}` : "vs"}</div>
              {imbang && match.penalti_pemenang && <small>Adu penalti: {teamNama(match.penalti_pemenang)} menang</small>}
              {imbang && !match.penalti_pemenang && <small>Imbang, adu penalti belum diisi</small>}
              <small>{match.tanggal} {match.jam}</small>
            </div>
            {sisi(match.away)}
          </div>
        </div>
      </div>

      <div className="page wrap">
        {isAdmin && labelStatus && <div className={`note ${status === "gagal" ? "err" : status === "tersimpan" ? "ok" : "info"}`} role="status">{labelStatus}</div>}

        {isAdmin && (
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3>Skor: {teamNama(match.home)} {sh || 0} - {sa || 0} {teamNama(match.away)}</h3>
              {match.selesai
                ? <button className="btn ghost sm" disabled={busy} onClick={bukaLagi}>Buka lagi untuk koreksi</button>
                : <button className="btn dark" disabled={busy} onClick={selesaikan}>Pertandingan selesai</button>}
            </div>
            {match.selesai && <div className="note ok" style={{ margin: "8px 0" }}>Pertandingan selesai — skor dan catatan pemain terkunci, sudah masuk klasemen.</div>}
            <p className="muted"><small>Dihitung otomatis dari tabel di bawah: gol pemain tim sendiri + gol bunuh diri pemain lawan.</small></p>
            {imbang && (
              <div className="panel" style={{ background: "var(--gold-wash)", marginTop: 8 }}>
                <h4>Skor imbang — siapa menang adu penalti?</h4>
                <p className="muted"><small>Tidak ada hasil seri. Menang adu penalti 2 poin, kalah adu penalti 1 poin. Jumlah penendang bebas, ditentukan admin.</small></p>
                <div className="row">
                  {[match.home, match.away].map((t) => (
                    <button key={t} className={`btn sm ${match.penalti_pemenang === t ? "" : "ghost"}`} aria-pressed={match.penalti_pemenang === t} disabled={busy || !!match.selesai} onClick={() => simpanPenalti(t)}>{teamNama(t)}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="panel">
          <h3>Catatan pemain {isAdmin ? "" : "(lihat)"}</h3>
          <p className="muted"><small>Centang Hadir untuk tiap pemain yang main — absensi dipakai untuk penghargaan pemain terbaik. Lalu isi gol, assist, kebobolan kiper, dan kartu (mengisinya otomatis mencentang Hadir). {isAdmin ? "Tersimpan otomatis. " : ""}Skorsing dihitung otomatis dari kartu.</small></p>
          <div className="grid2">
            {[match.home, match.away].map((team) => {
              const list = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.team === team);
              return (
                <div key={team}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <h4 className="clubcell"><Crest team={team} size="sm" /> {teamNama(team)} <small className="muted">{list.filter(({ r }) => r.hadir).length}/{list.length} hadir</small></h4>
                    {bisaEdit && list.some(({ r }) => !r.hadir) && <button className="btn ghost sm" onClick={() => hadirSemua(team)}>Semua hadir</button>}
                  </div>
                  <div className="tablewrap"><table className="table compact">
                    <thead><tr><th>Pemain</th><th>Pos</th><th>Hadir</th><th className="n">Gol</th><th className="n"><abbr title="Assist">Ast</abbr></th><th className="n"><abbr title="Gol bunuh diri (masuk ke skor lawan)">BD</abbr></th><th className="n"><abbr title="Gol kebobolan (kiper)">Kbl</abbr></th><th>Kartu</th></tr></thead>
                    <tbody>
                      {list.map(({ r, idx }) => (
                        <tr key={r.user_id} style={r.hadir ? undefined : { opacity: 0.55 }}>
                          <td>{r.nama}{(skorsing[r.user_id] || 0) > 0 && <> <span className="pill bad">Skorsing {skorsing[r.user_id]} laga</span></>}</td>
                          <td>{r.posisi}</td>
                          <td>{bisaEdit ? <input type="checkbox" checked={!!r.hadir} aria-label={`${r.nama} hadir`} onChange={(e) => ubahBaris(idx, { hadir: e.target.checked }, true)} /> : (r.hadir ? "Ya" : "-")}</td>
                          <td className="n">{bisaEdit ? <input style={{ width: 52 }} inputMode="numeric" value={r.gol} onChange={(e) => ubahBaris(idx, { gol: e.target.value.replace(/\D/g, "") })} /> : r.gol}</td>
                          <td className="n">{bisaEdit ? <input style={{ width: 52 }} inputMode="numeric" value={r.assist} onChange={(e) => ubahBaris(idx, { assist: e.target.value.replace(/\D/g, "") })} /> : r.assist}</td>
                          <td className="n">{bisaEdit ? <input style={{ width: 44 }} inputMode="numeric" value={r.og} onChange={(e) => ubahBaris(idx, { og: e.target.value.replace(/\D/g, "") })} /> : (Number(r.og) > 0 ? r.og : "")}</td>
                          <td className="n">{r.posisi !== "GK" ? "" : bisaEdit ? <input style={{ width: 52 }} inputMode="numeric" placeholder="0" title="Gol kebobolan kiper ini" value={r.kebobolan} onChange={(e) => ubahBaris(idx, { kebobolan: e.target.value.replace(/\D/g, "") })} /> : (r.hadir ? r.kebobolan || "0" : "-")}</td>
                          <td>
                            {bisaEdit ? (
                              <div className="row" style={{ gap: 3, flexWrap: "nowrap" }}>
                                {KARTU_OPSI.map((o) => (
                                  <button key={o.k} type="button" className="iconbtn" style={{ width: o.k === "kuning2" ? 34 : 28, height: 28 }} aria-pressed={r.kartu === o.k} aria-label={o.label} title={o.label} onClick={() => ubahBaris(idx, { kartu: o.k }, true)}><KartuIkon k={o.k} /></button>
                                ))}
                              </div>
                            ) : <KartuIkon k={r.kartu} />}
                          </td>
                        </tr>
                      ))}
                      {list.length === 0 && <tr><td colSpan={8}><p className="muted" style={{ margin: "8px 0" }}>Belum ada pemain di tim ini.</p></td></tr>}
                    </tbody>
                  </table></div>
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="panel" style={{ borderColor: "#F3C9C3" }}>
            <h3>Reset pertandingan</h3>
            <p className="muted"><small>Kosongkan skor, adu penalti, absensi, gol, assist, kebobolan, dan kartu laga ini — misalnya setelah selesai tes.</small></p>
            <button className="btn danger" disabled={busy} onClick={resetPertandingan}>Reset pertandingan</button>
          </div>
        )}
      </div>
    </div>
  );
}
