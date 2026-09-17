"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { load, save, uid, listAktif, kuotaAktif, STATUS_LABEL, type ScheduleStatus } from "../../../lib/store";

export default function AdminJadwal() {
  const [db, setDb] = useState<any>(null);
  const [tanggal, setTanggal] = useState("");
  const [jam, setJam] = useState("20:00-22:00");
  const [lokasi, setLokasi] = useState("Lapangan ABC - Rumput");
  const [editId, setEditId] = useState<string | null>(null);
  useEffect(() => { setDb(load()); }, []);
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  if (!me || me.role !== "admin") return <div className="card"><h3>🛠️ Khusus admin</h3><p className="muted">Login sebagai <b>Admin / admin123</b>.</p></div>;

  const refresh = () => setDb(load());

  const simpan = () => {
    if (!tanggal) return alert("Isi tanggal dulu ya");
    const d = load();
    if (editId) {
      const s = d.schedules.find((x: any) => x.id === editId);
      if (!s) return;
      s.tanggal = tanggal; s.jam = jam; s.lokasi = lokasi;
      save(d); setEditId(null);
    } else {
      if (d.schedules.some((x: any) => x.tanggal === tanggal && x.jam === jam)) {
        if (!confirm("Sudah ada jadwal di tanggal & jam yang sama. Tetap buat?")) return;
      }
      d.schedules.push({ id: uid(), tanggal, jam, lokasi, kuota: 28, status: "buka" });
      save(d);
    }
    setTanggal(""); refresh();
  };

  const hapus = (id: string) => {
    const d = load();
    const ikut = listAktif(d, id).length;
    if (ikut > 0 && !confirm(`${ikut} orang sudah isi list. Hapus jadwal + hanguskan RSVP mereka? (kredit yang dipotong dikembalikan)`)) return;
    // refund deposit yang sudah potong
    d.rsvps.filter((r: any) => r.scheduleId === id && r.status === "confirmed_lunas").forEach((r: any) => {
      const w = d.wallets[r.userId] || { paket: 0, reguler: 0 };
      w.reguler += 1; d.wallets[r.userId] = w;
    });
    d.rsvps = d.rsvps.filter((r: any) => r.scheduleId !== id);
    d.schedules = d.schedules.filter((s: any) => s.id !== id);
    save(d); refresh();
  };

  const setStatus = (id: string, status: ScheduleStatus) => {
    const d = load();
    const s = d.schedules.find((x: any) => x.id === id);
    if (!s) return;
    if (status === "sparing") {
      const ikut = listAktif(d, id).length;
      if (ikut > 14 && !confirm(`${ikut} orang sudah list, melebihi kuota sparing 14. Tetap aktifkan mode sparing? (tidak ada yang ditendang otomatis, tapi list baru dikunci)`)) return;
    }
    s.status = status; save(d); refresh();
  };

  const mulaiEdit = (s: any) => { setEditId(s.id); setTanggal(s.tanggal); setJam(s.jam); setLokasi(s.lokasi); };

  return (
    <div>
      <p><Link href="/admin">← Kembali ke Admin</Link></p>
      <h2 style={{ margin: "4px 0" }}>📅 Kelola Jadwal Main</h2>
      <p className="muted">Buat jadwal baru, ubah, hapus, atau ubah status (buka / tutup / full booked / sparing).</p>

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
        <button className="btn" onClick={simpan}>{editId ? "Simpan Perubahan" : "Buat Jadwal"}</button>
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
              <button className="btn secondary small" onClick={() => mulaiEdit(s)}>✏️ Ubah</button>
              <button className="btn danger small" onClick={() => hapus(s.id)}>🗑️ Hapus</button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn secondary small" onClick={() => setStatus(s.id, "buka")}>🟢 Buka</button>
              <button className="btn secondary small" onClick={() => setStatus(s.id, "tutup")}>⏸️ Tutup</button>
              <button className="btn secondary small" onClick={() => setStatus(s.id, "full_booked")}>🔴 Full Booked</button>
              <button className="btn secondary small" onClick={() => setStatus(s.id, "sparing")}>🤝 Sparing (14)</button>
              <Link href={`/admin?jadwal=${s.id}`}><button className="btn small">👥 Roster</button></Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
