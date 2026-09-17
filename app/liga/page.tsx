"use client";
import { useEffect, useState } from "react";
import { klasemen, topSkor, QUOTA_POSISI } from "../../lib/store";
import { fetchAll, adminInsert, adminUpdate, adminDelete } from "../../lib/db";
import { supa } from "../../lib/supabase";

const medals = ["🥇", "🥈", "🥉"];

export default function Liga() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tim, setTim] = useState("A"); const [posisi, setPosisi] = useState("Depan");
  const [sh, setSh] = useState(""); const [sa, setSa] = useState("");
  const [golInput, setGolInput] = useState(""); const [matchId, setMatchId] = useState("");
  const [ntHome, setNtHome] = useState("A"); const [ntAway, setNtAway] = useState("B");
  const [ntTgl, setNtTgl] = useState(""); const [ntJam, setNtJam] = useState("20:00"); const [ntLok, setNtLok] = useState("");
  const reload = () => fetchAll().then(setDb).catch((e: any) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  const isAdmin = me?.role === "admin";
  const isMember = !!me?.is_member;
  const k = klasemen(db.matches); const ts = topSkor(db);
  const locked: boolean = !!db.leagueLocked;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await reload(); } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const daftar = () =>
    run(async () => {
      if (!me) return alert("Login dulu ya");
      if (me.status !== "approved") return alert("Akunmu belum di-approve admin");
      if (!isMember) return alert("Liga khusus ⭐ Member (beli paket 90rb dulu di Top-Up) 💪");
      if (locked) return alert("Skuad liga sudah dikunci. Hubungi admin untuk pergantian pemain.");
      const semua: any[] = ([] as any[]).concat(db.teams.A || [], db.teams.B || [], db.teams.C || [], db.teams.D || []);
      if (semua.some((m: any) => m.userId === me.id)) return alert("Kamu sudah terdaftar di sebuah tim. 1 orang 1 tim ya!");
      const arr = db.teams[tim] || [];
      if (arr.filter((m: any) => m.posisi === posisi).length >= (QUOTA_POSISI[posisi] || 99)) return alert(`Slot ${posisi} Tim ${tim} penuh!`);
      if (arr.length >= 7) return alert(`Tim ${tim} sudah penuh (7 orang)`);
      await adminInsert("league_members", { team: tim, user_id: me.id, posisi });
    });

  const simpanSkor = () =>
    run(async () => {
      if (!isAdmin) return alert("Hanya admin yang bisa input skor");
      const mid = matchId || db.matches[0]?.id;
      if (!mid) return;
      const names = golInput.split(",").map((s) => s.trim()).filter(Boolean);
      const goals = [];
      for (const n of names) {
        const u = db.users.find((x: any) => x.nama.toLowerCase() === n.toLowerCase());
        goals.push({ scorerId: u ? u.id : n });
      }
      await adminUpdate("league_matches", mid, { sh: parseInt(sh), sa: parseInt(sa), goals });
      setSh(""); setSa(""); setGolInput("");
    });

  const tambahMatch = () =>
    run(async () => {
      if (ntHome === ntAway) return alert("Tim home & away harus beda");
      await adminInsert("league_matches", {
        home: ntHome, away: ntAway, sh: null, sa: null, goals: [],
        tanggal: ntTgl || null, jam: ntJam, lokasi: ntLok,
      });
      setNtTgl(""); setNtLok("");
    });

  const hapusMatch = (id: string) => {
    if (!confirm("Hapus pertandingan ini?")) return;
    run(() => adminDelete("league_matches", id).then(() => {}));
  };

  const toggleLock = () => {
    if (!db.leagueLocked && !confirm("Kunci skuad? Setelah dikunci pemain tidak bisa daftar/pindah tim.")) return;
    run(() => adminUpdate("league_meta", 1, { locked: !db.leagueLocked }, "id").then(() => {}));
  };

  const keluarkan = (t: string, userId: string) => {
    if (!confirm("Keluarkan pemain ini dari tim? (untuk pergantian)")) return;
    run(async () => {
      const { error } = await supa().from("league_members").delete().eq("team", t).eq("user_id", userId);
      if (error) throw new Error(error.message);
    });
  };

  return (
    <div>
      <h2 style={{ margin: "4px 0" }}>🏆 Liga 6 Bulan {locked && <span className="badge red">🔒 Skuad dikunci</span>}</h2>
      <p className="muted">Khusus ⭐ Member • 4 tim @7 orang (GK 1, Belakang 2, Tengah 2, Depan 2) • Menang 3, seri 1.</p>
      {me && !isMember && <div className="banner warn">Liga khusus member. <b>Beli paket 90rb di Top-Up</b> untuk jadi member permanen + daftar liga! 💪</div>}

      {!locked && (
        <div className="card">
          <h3>📝 Daftar tim {isMember ? "" : "(khusus member)"}</h3>
          <div className="grid2">
            <select value={tim} onChange={(e) => setTim(e.target.value)}>{["A", "B", "C", "D"].map((t) => <option key={t} value={t}>Tim {t} — {(db.teams[t] || []).length}/7</option>)}</select>
            <select value={posisi} onChange={(e) => setPosisi(e.target.value)}>{Object.keys(QUOTA_POSISI).map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <button className="btn" disabled={busy} onClick={daftar}>Gabung Tim {tim} sebagai {posisi} ➜</button>
        </div>
      )}

      <div className="grid2">
        {(["A", "B", "C", "D"] as const).map((t) => (
          <div className={`card teamcard ${t}`} key={t}>
            <b>Tim {t}</b> <span className="badge blue">{(db.teams[t] || []).length}/7</span>
            {(db.teams[t] || []).map((m: any, i: number) => {
              const u = db.users.find((x: any) => x.id === m.userId);
              return <p key={i}><span className="badge gray">{m.posisi}</span> {u?.nama || m.userId} {isAdmin && <button className="btn secondary small" disabled={busy} onClick={() => keluarkan(t, m.userId)}>Keluarkan</button>}</p>;
            })}
            {(db.teams[t] || []).length === 0 && <p className="muted">Belum ada yang daftar.</p>}
          </div>
        ))}
      </div>

      {isAdmin && <div className="card"><button className="btn secondary" disabled={busy} onClick={toggleLock}>{locked ? "🔓 Buka Kunci Skuad" : "🔒 Kunci Skuad"}</button></div>}

      <div className="card">
        <h3>📊 Klasemen</h3>
        <div className="tblwrap"><table>
          <thead><tr><th>#</th><th>Tim</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Gol</th><th>+/-</th><th>Poin</th></tr></thead>
          <tbody>{k.map((r: any, i: number) => <tr key={r.tim}><td>{i + 1}</td><td><b>Tim {r.tim}</b></td><td>{r.M}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td><td>{r.GM}-{r.GA}</td><td>{r.GD > 0 ? "+" + r.GD : r.GD}</td><td><b>{r.P}</b></td></tr>)}</tbody>
        </table></div>
      </div>

      <div className="card">
        <h3>👟 Top Skor</h3>
        {ts.length === 0 && <p className="muted">Belum ada gol.</p>}
        {ts.map((r: any, i: number) => <p key={i}><span className="medal">{medals[i] || "⚽"}</span> <b>{r.nama}</b> (Tim {r.tim}) — <b>{r.gol} gol</b></p>)}
      </div>

      <div className="card">
        <h3>📅 Pertandingan</h3>
        {db.matches.map((m: any) => (
          <p key={m.id}><b>Tim {m.home}</b> vs <b>Tim {m.away}</b>{" "}
            <span className={`badge ${m.sh === null ? "gray" : "green"}`}>{m.sh === null ? "belum main" : `${m.sh} : ${m.sa}`}</span>
            {m.tanggal ? <small className="muted"> • {m.tanggal} {m.jam || ""} {m.lokasi || ""}</small> : null}{" "}
            {isAdmin && <button className="btn secondary small" disabled={busy} onClick={() => hapusMatch(m.id)}>Hapus</button>}</p>
        ))}
        {isAdmin && (
          <div style={{ marginTop: 10 }}>
            <h4>➕ Buat jadwal tanding (admin, kapan saja)</h4>
            <div className="grid2">
              <select value={ntHome} onChange={(e) => setNtHome(e.target.value)}>{["A", "B", "C", "D"].map((t) => <option key={t} value={t}>Home: Tim {t}</option>)}</select>
              <select value={ntAway} onChange={(e) => setNtAway(e.target.value)}>{["A", "B", "C", "D"].map((t) => <option key={t} value={t}>Away: Tim {t}</option>)}</select>
            </div>
            <div className="grid2">
              <input type="date" value={ntTgl} onChange={(e) => setNtTgl(e.target.value)} />
              <input placeholder="Jam, cth 20:00" value={ntJam} onChange={(e) => setNtJam(e.target.value)} />
            </div>
            <input placeholder="Lokasi (opsional)" value={ntLok} onChange={(e) => setNtLok(e.target.value)} />
            <button className="btn secondary" disabled={busy} onClick={tambahMatch}>Tambah Pertandingan</button>
            <h4 style={{ marginTop: 12 }}>✏️ Input skor & gol</h4>
            <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">— Pilih pertandingan —</option>
              {db.matches.map((m: any) => <option key={m.id} value={m.id}>Tim {m.home} vs Tim {m.away}{m.tanggal ? ` (${m.tanggal})` : ""}</option>)}
            </select>
            <div className="grid2">
              <input placeholder="Skor home" value={sh} onChange={(e) => setSh(e.target.value)} />
              <input placeholder="Skor away" value={sa} onChange={(e) => setSa(e.target.value)} />
            </div>
            <input placeholder="Pencetak gol, cth: Budi, Budi, Andi" value={golInput} onChange={(e) => setGolInput(e.target.value)} />
            <button className="btn" disabled={busy} onClick={simpanSkor}>Simpan Skor ✅</button>
          </div>
        )}
      </div>
    </div>
  );
}
