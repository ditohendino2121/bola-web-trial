"use client";
import { useEffect, useState } from "react";
import { load, save, uid, klasemen, topSkor, QUOTA_POSISI } from "../../lib/store";

const medals = ["🥇", "🥈", "🥉"];

export default function Liga() {
  const [db, setDb] = useState<any>(null);
  const [tim, setTim] = useState("A"); const [posisi, setPosisi] = useState("Depan");
  const [sh, setSh] = useState(""); const [sa, setSa] = useState("");
  const [golInput, setGolInput] = useState(""); const [matchId, setMatchId] = useState("");
  const [ntHome, setNtHome] = useState("A"); const [ntAway, setNtAway] = useState("B");
  const [ntTgl, setNtTgl] = useState(""); const [ntJam, setNtJam] = useState("20:00"); const [ntLok, setNtLok] = useState("");
  useEffect(() => { setDb(load()); }, []);
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  const isAdmin = me?.role === "admin";
  const isMember = !!me?.is_member;
  const k = klasemen(db.matches); const ts = topSkor(db);
  const locked: boolean = !!db.leagueLocked;

  const daftar = () => {
    if (!me) return alert("Login dulu ya");
    if (me.status !== "approved") return alert("Akunmu belum di-approve admin");
    if (!isMember) return alert("Liga khusus ⭐ Member (beli paket 90rb dulu di Top-Up). Biar pada semangat jadi member! 💪");
    if (locked) return alert("Skuad liga sudah dikunci 6 bulan. Hubungi admin untuk pergantian pemain.");
    const d = load();
    const sudah = (Object.entries(d.teams as Record<string, any[]>) as [string, any[]][]).find(([, arr]) => arr.some((m: any) => m.userId === me.id));
    if (sudah) return alert(`Kamu sudah di Tim ${sudah[0]}. 1 orang 1 tim ya!`);
    const arr = d.teams[tim] as any[];
    const countPos = arr.filter((m: any) => m.posisi === posisi).length;
    if (countPos >= (QUOTA_POSISI[posisi] || 99)) return alert(`Slot ${posisi} Tim ${tim} penuh. Pilih posisi/tim lain!`);
    if (arr.length >= 7) return alert(`Tim ${tim} penuh (7 orang)`);
    arr.push({ userId: me.id, posisi }); save(d); setDb(load());
  };

  const simpanSkor = () => {
    if (!isAdmin) return alert("Hanya admin yang bisa input skor");
    const d = load();
    const m = d.matches.find((x: any) => x.id === (matchId || d.matches[0]?.id));
    if (!m) return;
    m.sh = parseInt(sh); m.sa = parseInt(sa);
    const names = golInput.split(",").map((s) => s.trim()).filter(Boolean);
    m.goals = names.map((n) => {
      const u = d.users.find((x: any) => x.nama.toLowerCase() === n.toLowerCase());
      return { scorerId: u ? u.id : n };
    });
    save(d); setDb(load()); setSh(""); setSa(""); setGolInput("");
  };

  const tambahMatch = () => {
    if (!isAdmin) return;
    if (ntHome === ntAway) return alert("Tim home & away harus beda");
    const d = load();
    d.matches.push({ id: uid(), home: ntHome, away: ntAway, sh: null, sa: null, goals: [], tanggal: ntTgl, jam: ntJam, lokasi: ntLok });
    save(d); setDb(load()); setNtTgl(""); setNtLok("");
  };
  const hapusMatch = (id: string) => {
    if (!confirm("Hapus pertandingan ini?")) return;
    const d = load(); d.matches = d.matches.filter((x: any) => x.id !== id);
    save(d); setDb(load());
  };
  const toggleLock = () => {
    const d = load();
    if (!d.leagueLocked && !confirm("Kunci skuad 6 bulan? Setelah dikunci pemain tidak bisa daftar/pindah tim.")) return;
    d.leagueLocked = !d.leagueLocked; save(d); setDb(load());
  };
  const keluarkan = (t: string, userId: string) => {
    if (!confirm("Keluarkan pemain ini dari tim? (untuk pergantian)")) return;
    const d = load(); d.teams[t] = (d.teams[t] as any[]).filter((m: any) => m.userId !== userId);
    save(d); setDb(load());
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
          <button className="btn" onClick={daftar}>Gabung Tim {tim} sebagai {posisi} ➜</button>
        </div>
      )}

      <div className="grid2">
        {(["A", "B", "C", "D"] as const).map((t) => (
          <div className={`card teamcard ${t}`} key={t}>
            <b>Tim {t}</b> <span className="badge blue">{(db.teams[t] || []).length}/7</span>
            {(db.teams[t] || []).map((m: any, i: number) => {
              const u = db.users.find((x: any) => x.id === m.userId);
              return <p key={i}><span className="badge gray">{m.posisi}</span> {u?.nama || m.userId} {isAdmin && <button className="btn secondary small" onClick={() => keluarkan(t, m.userId)}>Keluarkan</button>}</p>;
            })}
            {(db.teams[t] || []).length === 0 && <p className="muted">Belum ada yang daftar.</p>}
          </div>
        ))}
      </div>

      {isAdmin && <div className="card"><button className="btn secondary" onClick={toggleLock}>{locked ? "🔓 Buka Kunci Skuad" : "🔒 Kunci Skuad 6 Bulan"}</button></div>}

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
            {isAdmin && <button className="btn secondary small" onClick={() => hapusMatch(m.id)}>Hapus</button>}</p>
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
            <button className="btn secondary" onClick={tambahMatch}>Tambah Pertandingan</button>
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
            <button className="btn" onClick={simpanSkor}>Simpan Skor ✅</button>
          </div>
        )}
      </div>
    </div>
  );
}
