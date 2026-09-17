"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAktif, kuotaAktif, STATUS_LABEL, type ScheduleStatus } from "../../../lib/store";
import { fetchAll, adminUpdate, adminInsert, adminDelete } from "../../../lib/db";

export default function AdminJadwal() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tanggal, setTanggal] = useState("");
  const [jam, setJam] = useState("20:00-22:00");
  const [lokasi, setLokasi] = useState("Lapangan ABC - Rumput");
  const [editId, setEditId] = useState<string | null>(null);
  const reload = () => fetchAll().then(setDb).catch((e: any) => setErr(e.message));
  useEffect(() => { reload(); }, []);
  if (err) return <div className="card"><div className="banner err">⚠️ {err}</div></div>;
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  if (!me || me.role !== "admin") return <div className="card"><h3>🛠️ Khusus admin</h3><p className="muted">Login dengan akun admin.</p></div>;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await reload(); } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const simpan = () =>
    run(async () => {
      if (!tanggal) return alert("Isi tanggal dulu ya");
      if (editId) {
        await adminUpdate("schedules", editId, { tanggal, jam, lokasi });
        setEditId(null);
      } else {
        if (db.schedules.some((x: any) => x.tanggal === tanggal && x.jam === jam)) {
          if (!confirm("Sudah ada jadwal di tanggal & jam yang sama. Tetap buat?")) return;
        }
        await adminInsert("schedules", { tanggal, jam, lokasi, kuota: 28, status: "buka" });
      }
      setTanggal("");
    });

  const setStatus = (id: string, status: ScheduleStatus) =>
    run(async () => {
      if (status === "sparing") {
        const ikut = listAktif(db, id).length;
        if (ikut > 14 && !confirm(`${ikut} orang sudah list, melebihi kuota sparing 14. Tetap aktifkan? (tidak ada yang ditendang otomatis)`)) return;
      }
      await adminUpdate("schedules", id, { status });
    });

  const mulaiEdit = (s: any) => { setEditId(s.id); setTanggal(s.tanggal); setJam(s.jam); setLokasi(s.lokasi); };

  return (
    <div>
      <p><Link href="/admin">← Kembali ke Admin</Link></p>
      <h2 style={{ margin: "4px 0" }}>📅 Kelola Jadwal Main</h2>
      <p className="muted">Buat jadwal baru, ubah, hapus, atau ubah status (buka / tutup / full booked / sparing).</p>
      {busy && <div className="banner info">⏳ Memproses...</div>}

      <div className="card">
        <h3>{editId ? "✏️ Ubah jadwal" : "➕ Buat jadwal baru"}</h3>
        <label><small className="muted"><b>Tanggal</b></small></label>
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        <div className="grid2">
          <div><label><small className="muted"><b>Jam</b></small></label>
            <input placeholder="20:00-22:00" value={jam} onChange={(e) => setJam(e.target.value)} /></div>
          <div><label><small className="muted"><b>Lokasi</b></small></label>
            <input placeholder="Nama lapangan" value={lokasi} onChange={(e) => setLokasi(e.target.value)} /></div>
        </div>
        <button className="btn" disabled={busy} onClick={simpan}>{editId ? "Simpan Perubahan" : "Buat Jadwal"}</button>
        {editId && <button className="btn secondary" onClick={() => { setEditId(null); setTanggal(""); }}>Batal edit</button>}
        <p className="muted"><small>Kuota otomatis 28 (GK 4 • Belakang/Tengah/Depan @8). Mode sparing otomatis jadi 14.</small></p>
      </div>

      {db.schedules.slice().sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal)).map((s: any) => {
        const ikut = listAktif(db, s.id).length;
        return (
          <div className="card" key={s.id}>
            <div className="section-title">
              <b>📅 {s.tanggal} • {s.jam}</b>
              <span className={`badge ${s.status === "buka" ? "green" : s.status === "sparing" ? "blue" : "red"}`}>{STATUS_LABEL[s.status] || s.status}</span>
            </div>
            <p className="muted"><small>📍 {s.lokasi} • {ikut}/{kuotaAktif(s)} ikut</small></p>
            <div className="row">
              <button className="btn secondary small" disabled={busy} onClick={() => mulaiEdit(s)}>✏️ Ubah</button>
              <button className="btn danger small" disabled={busy} onClick={() => hapusJadwal(s.id)}>🗑️ Hapus</button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn secondary small" disabled={busy} onClick={() => setStatus(s.id, "buka")}>🟢 Buka</button>
              <button className="btn secondary small" disabled={busy} onClick={() => setStatus(s.id, "tutup")}>⏸️ Tutup</button>
              <button className="btn secondary small" disabled={busy} onClick={() => setStatus(s.id, "full_booked")}>🔴 Full Booked</button>
              <button className="btn secondary small" disabled={busy} onClick={() => setStatus(s.id, "sparing")}>🤝 Sparing (14)</button>
              <Link href="/admin"><button className="btn small">👥 Roster</button></Link>
            </div>
          </div>
        );
      })}
    </div>
  );

  async function hapusJadwal(id: string) {
    const ikut = listAktif(db, id);
    const lunas = ikut.filter((r: any) => r.status === "confirmed_lunas" && r.metode === "deposit");
    if (ikut.length > 0 && !confirm(`${ikut.length} orang sudah isi list. Hapus jadwal + kembalikan ${lunas.length} kredit deposit?`)) return;
    await run(async () => {
      const { supa } = await import("../../../lib/supabase");
      for (const r of lunas) {
        const w = db.wallets[r.userId] || { paket: 0, reguler: 0, paket_gk: 0, reguler_gk: 0 };
        const gk = (r as any).pakaiGk ?? (r.posisi === "GK");
        const { error } = await supa().from("wallets").upsert({
          user_id: r.userId, paket: w.paket, reguler: w.reguler + (!gk ? 1 : 0),
          paket_gk: w.paket_gk, reguler_gk: w.reguler_gk + (gk ? 1 : 0),
        });
        if (error) throw new Error(error.message);
      }
      await adminDelete("schedules", id);
    });
  }
}
