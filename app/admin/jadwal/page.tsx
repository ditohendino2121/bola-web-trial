"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Loading, LoadError, Empty } from "../../../components/ui";
import { listAktif, kuotaAktif, STATUS_LABEL } from "../../../lib/rules";
import { supa } from "../../../lib/supa";
import { updateRow, insertRow, deleteRow, type ScheduleStatus } from "../../../lib/data";

export default function AdminJadwal() {
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [tanggal, setTanggal] = useState("");
  const [jam, setJam] = useState("20:00-22:00");
  const [lokasi, setLokasi] = useState("Lapangan ABC - Rumput");
  const [editId, setEditId] = useState<string | null>(null);

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="kelola jadwal" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  if (!me || me.role !== "admin") return <div className="page wrap"><Empty title="Khusus admin — login dengan akun admin." /></div>;

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await reload(); } catch (e: any) { alert(e.message); } setBusy(false); };

  const simpan = () => run(async () => {
    if (!tanggal) return alert("Isi tanggal dulu.");
    if (editId) {
      await updateRow("schedules", editId, { tanggal, jam, lokasi });
      setEditId(null);
    } else {
      if (db.schedules.some((x) => x.tanggal === tanggal && x.jam === jam) && !confirm("Sudah ada jadwal di tanggal & jam yang sama. Tetap buat?")) return;
      await insertRow("schedules", { tanggal, jam, lokasi, kuota: 28, status: "buka" });
    }
    setTanggal("");
  });

  const setStatus = (id: string, status: ScheduleStatus) => run(async () => {
    if (status === "sparing") {
      const ikut = listAktif(db, id).length;
      if (ikut > 14 && !confirm(`${ikut} orang sudah list, melebihi kuota sparing 14. Tetap aktifkan? (tidak ada yang ditendang otomatis)`)) return;
    }
    await updateRow("schedules", id, { status });
  });

  const mulaiEdit = (s: any) => { setEditId(s.id); setTanggal(s.tanggal); setJam(s.jam); setLokasi(s.lokasi); };

  const hapusJadwal = async (id: string) => {
    const ikut = listAktif(db, id);
    const lunas = ikut.filter((r: any) => r.status === "confirmed_lunas" && r.metode === "deposit");
    if (ikut.length > 0 && !confirm(`${ikut.length} orang sudah isi list. Hapus jadwal + kembalikan ${lunas.length} kredit deposit?`)) return;
    if (ikut.length === 0 && !confirm("Hapus jadwal ini?")) return;
    await run(async () => {
      for (const r of lunas) {
        const w = db.wallets[r.userId] || { paket: 0, reguler: 0, paket_gk: 0, reguler_gk: 0 };
        const gk = (r as any).pakaiGk ?? r.posisi === "GK";
        const { error: e } = await supa().from("wallets").upsert({ user_id: r.userId, paket: w.paket, reguler: w.reguler + (!gk ? 1 : 0), paket_gk: w.paket_gk, reguler_gk: w.reguler_gk + (gk ? 1 : 0) });
        if (e) throw new Error(e.message);
      }
      await deleteRow("schedules", id);
    });
  };

  return (
    <div>
      <PageHead title="Kelola jadwal main" desc="Buat jadwal baru, ubah, hapus, atau ubah status (buka / tutup / full booked / sparing)." crumbs={[{ href: "/admin", label: "Admin" }]} />
      <div className="page wrap">
        {busy && <div className="note info">Memproses...</div>}

        <div className="panel">
          <h3>{editId ? "Ubah jadwal" : "Buat jadwal baru"}</h3>
          <label className="field"><span>Tanggal</span><input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></label>
          <div className="grid2">
            <label className="field"><span>Jam</span><input placeholder="20:00-22:00" value={jam} onChange={(e) => setJam(e.target.value)} /></label>
            <label className="field"><span>Lokasi</span><input placeholder="Nama lapangan" value={lokasi} onChange={(e) => setLokasi(e.target.value)} /></label>
          </div>
          <div className="row">
            <button className="btn" disabled={busy} onClick={simpan}>{editId ? "Simpan perubahan" : "Buat jadwal"}</button>
            {editId && <button className="btn ghost" onClick={() => { setEditId(null); setTanggal(""); }}>Batal edit</button>}
          </div>
          <p className="muted"><small>Kuota otomatis 28 (GK 4, Belakang/Tengah/Depan masing-masing 8). Mode sparing otomatis jadi 14.</small></p>
        </div>

        {db.schedules.slice().sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map((s) => {
          const ikut = listAktif(db, s.id).length;
          return (
            <div className="panel" key={s.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{s.tanggal} &middot; {s.jam}</b>
                <span className={`pill ${s.status === "buka" ? "ok" : s.status === "sparing" ? "info" : "bad"}`}>{STATUS_LABEL[s.status] || s.status}</span>
              </div>
              <p className="muted"><small>{s.lokasi} &middot; {ikut}/{kuotaAktif(s)} ikut</small></p>
              <div className="row">
                <button className="btn ghost sm" disabled={busy} onClick={() => mulaiEdit(s)}>Ubah</button>
                <button className="btn danger sm" disabled={busy} onClick={() => hapusJadwal(s.id)}>Hapus</button>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn ghost sm" disabled={busy} onClick={() => setStatus(s.id, "buka")}>Buka</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => setStatus(s.id, "tutup")}>Tutup</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => setStatus(s.id, "full_booked")}>Full booked</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => setStatus(s.id, "sparing")}>Sparing (14)</button>
                <Link href="/admin?tab=roster"><button className="btn sm">Roster</button></Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
