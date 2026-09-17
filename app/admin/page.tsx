"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  load, save, uid, walletOf, listAktif, kuotaAktif, quotaPosisi,
  POSISI_MAIN, STATUS_LABEL, tunggakanOf,
} from "../../lib/store";
import { downloadCSV, today, acakTim } from "../../lib/export";

export default function Admin() {
  const [db, setDb] = useState<any>(null);
  const [jadwalId, setJadwalId] = useState("");
  const [acak, setAcak] = useState<Record<string, { nama: string; posisi: string }[]> | null>(null);
  const [bantuanUser, setBantuanUser] = useState("");
  const [bantuanKredit, setBantuanKredit] = useState("1");
  const [bantuanAlasan, setBantuanAlasan] = useState("");
  const [walkinUser, setWalkinUser] = useState("");
  const [walkinPosisi, setWalkinPosisi] = useState<"GK" | "Belakang" | "Tengah" | "Depan">("Depan");
  const [walkinCara, setWalkinCara] = useState<"potong" | "cash">("potong");
  useEffect(() => { setDb(load()); }, []);
  if (!db) return <div className="card"><p>Memuat...</p></div>;
  const me = db.users.find((u: any) => u.id === db.sessionId);
  if (!me || me.role !== "admin") return <div className="card"><h3>🛠️ Khusus admin</h3><p className="muted">Login sebagai <b>Admin / admin123</b> di Beranda.</p></div>;

  const refresh = () => setDb(load());
  const namaOf = (id: string) => db.users.find((u: any) => u.id === id)?.nama || id;

  // ---- approve ----
  const approve = (id: string, ok: boolean) => {
    const d = load(); const u = d.users.find((x: any) => x.id === id);
    if (!u) return;
    u.status = ok ? "approved" : "rejected"; save(d); refresh();
  };

  // ---- verifikasi klaim ----
  const verifKlaim = (txId: string, ok: boolean, alasan = "") => {
    const d = load(); const t = d.txs.find((x: any) => x.id === txId);
    if (!t || t.status !== "pending") return;
    if (ok) {
      t.status = "success";
      const w = d.wallets[t.userId] || { paket: 0, reguler: 0 };
      if (t.paket === "4x") { w.paket += 4; const u = d.users.find((x: any) => x.id === t.userId); if (u) u.is_member = true; }
      else w.reguler += 1;
      d.wallets[t.userId] = w;
    } else {
      if (!alasan) { const a = prompt("Alasan penolakan untuk pemain:"); if (a === null) return; alasan = a; }
      t.status = "rejected"; t.catatan = (t.catatan || "") + ` [Ditolak: ${alasan}]`;
    }
    save(d); refresh();
  };

  // ---- hapus transaksi kas (salah input) + reverse kredit yang pernah diberikan ----
  const hapusTx = (txId: string) => {
    const d = load(); const t = d.txs.find((x: any) => x.id === txId);
    if (!t) return;
    const granted = (t.kreditPaket || 0) + (t.kreditReguler || 0);
    if (!confirm(`Hapus "${t.label}" (${(t.rupiah || 0).toLocaleString("id-ID")})?${granted > 0 && t.status === "success" ? `\nKredit yang sudah masuk (${granted}) akan ditarik kembali.` : ""}`)) return;
    if (t.status === "success" && granted > 0) {
      const w = d.wallets[t.userId] || { paket: 0, reguler: 0 };
      w.paket = Math.max(0, w.paket - (t.kreditPaket || 0));
      w.reguler = Math.max(0, w.reguler - (t.kreditReguler || 0));
      d.wallets[t.userId] = w;
    }
    d.txs = d.txs.filter((x: any) => x.id !== txId);
    save(d); refresh();
  };

  // ---- kurangi kredit manual ----
  const kurangiKredit = (userId: string, kind: "paket" | "reguler") => {
    const d = load(); const w = d.wallets[userId] || { paket: 0, reguler: 0 };
    if ((w[kind] || 0) < 1) return alert("Kreditnya sudah 0");
    const alasan = prompt(`Kurangi 1 kredit ${kind} untuk ${namaOf(userId)}?\nIsi alasan (cth: walk-in tanpa list, koreksi):`);
    if (alasan === null) return;
    w[kind] -= 1; d.wallets[userId] = w;
    d.txs.push({ id: uid(), userId, label: `Kurangi 1 kredit ${kind} manual`, kreditPaket: 0, kreditReguler: 0, rupiah: 0, metode: "koreksi_minus", tanggal: new Date().toISOString(), status: "success", privateNote: alasan });
    save(d); refresh();
  };

  // ---- kredit manual: cash / bantuan privat / koreksi ----
  const manualTopup = (userId: string, kind: "1x" | "4x", metode: string) => {
    const d = load(); const w = d.wallets[userId] || { paket: 0, reguler: 0 };
    if (kind === "1x") w.reguler += 1; else { w.paket += 4; const u = d.users.find((x: any) => x.id === userId); if (u) u.is_member = true; }
    d.wallets[userId] = w;
    d.txs.push({ id: uid(), userId, label: `Top-up manual ${kind} (${metode})`, kreditPaket: kind === "4x" ? 4 : 0, kreditReguler: kind === "1x" ? 1 : 0, rupiah: kind === "1x" ? 25000 : 90000, metode: `manual_${metode}`, tanggal: new Date().toISOString(), status: "success" });
    save(d); refresh();
  };
  const beriBantuan = () => {
    if (!bantuanUser) return alert("Pilih pemain dulu");
    const d = load(); const w = d.wallets[bantuanUser] || { paket: 0, reguler: 0 };
    const n = parseInt(bantuanKredit) || 1; w.reguler += n; d.wallets[bantuanUser] = w;
    d.txs.push({ id: uid(), userId: bantuanUser, label: "Kredit admin", kreditPaket: 0, kreditReguler: n, rupiah: 0, metode: "bantuan_privat", tanggal: new Date().toISOString(), status: "success", privateNote: bantuanAlasan });
    save(d); setBantuanUser(""); setBantuanAlasan(""); refresh();
    alert("Kredit bantuan masuk. Pemain hanya melihat label netral 'Kredit admin'.");
  };
  const toggleMember = (userId: string) => {
    const d = load(); const u = d.users.find((x: any) => x.id === userId);
    if (!u) return; u.is_member = !u.is_member; save(d); refresh();
  };

  // ---- check-in ----
  const checkin = (rsvpId: string, aksi: "lunas" | "belum" | "nodatang") => {
    const d = load(); const r = d.rsvps.find((x: any) => x.id === rsvpId);
    if (!r) return;
    if (aksi === "lunas") {
      r.status = "confirmed_lunas";
      d.txs.push({ id: uid(), userId: r.userId, label: "Pelunasan di lapangan (25rb)", kreditPaket: 0, kreditReguler: 0, rupiah: 25000, metode: "pelunasan_cash", tanggal: new Date().toISOString(), status: "success" });
    } else if (aksi === "belum") {
      r.status = "wajib_bayar";
      d.txs.push({ id: uid(), userId: r.userId, label: "Tunggakan: hadir tapi belum bayar (25rb)", kreditPaket: 0, kreditReguler: 0, rupiah: 25000, metode: "tagihan", tanggal: new Date().toISOString(), status: "success" });
    } else {
      if (r.status === "confirmed_lunas") { r.status = "no_show"; } // deposit hangus, tanpa utang
      else {
        r.status = "wajib_bayar";
        d.txs.push({ id: uid(), userId: r.userId, label: "Tunggakan: tidak datang & belum bayar (25rb)", kreditPaket: 0, kreditReguler: 0, rupiah: 25000, metode: "tagihan", tanggal: new Date().toISOString(), status: "success" });
      }
    }
    save(d); refresh();
  };
  const voidTunggakan = (rsvpId: string) => {
    const alasan = prompt("Alasan void (hanya terlihat admin):");
    if (alasan === null) return;
    const d = load(); const r = d.rsvps.find((x: any) => x.id === rsvpId);
    if (!r) return;
    r.status = "cancelled";
    d.txs.push({ id: uid(), userId: r.userId, label: "Tunggakan di-void admin", kreditPaket: 0, kreditReguler: 0, rupiah: 0, metode: "void", tanggal: new Date().toISOString(), status: "success", privateNote: alasan });
    save(d); refresh();
  };

  // ---- export pemain ----
  const exportPemain = () => {
    const rows = db.users.map((u: any) => {
      const w = walletOf(db, u.id);
      const tung = tunggakanOf(db, u.id).length;
      const main = db.rsvps.filter((r: any) => r.userId === u.id && r.status !== "cancelled").length;
      return [u.nama, u.wa, u.role, u.status, u.is_member ? "Member" : "Non-member", w.paket, w.reguler, tung > 0 ? 25000 * tung : 0, main];
    });
    downloadCSV(`pemain-${today()}.csv`, ["Nama", "WA", "Role", "Status", "Member", "Kredit Paket", "Kredit Reguler", "Tunggakan Rp", "Total Ikut"], rows);
  };

  // ---- roster per jadwal ----
  const jadwal = db.schedules.find((s: any) => s.id === jadwalId) || db.schedules.slice().sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal))[0];
  const roster = jadwal ? listAktif(db, jadwal.id) : [];

  const salinWA = () => {
    if (!jadwal) return;
    let t = `📋 LIST MAIN — ${jadwal.tanggal} ${jadwal.jam}\n📍 ${jadwal.lokasi}\n\n`;
    POSISI_MAIN.forEach((p) => {
      const arr = roster.filter((r: any) => (r.posisi || "Depan") === p);
      t += `*${p} (${arr.length}/${quotaPosisi(jadwal, p)})*\n`;
      arr.forEach((r: any, i: number) => {
        const mark = r.status === "confirmed_lunas" ? "✅" : r.status === "confirmed_langsung" ? "💵" : "⏳";
        t += `${i + 1}. ${namaOf(r.userId)} ${mark}\n`;
      });
      t += "\n";
    });
    t += `Total ${roster.length}/${kuotaAktif(jadwal)} • ✅ lunas • 💵 bayar di tempat • ⏳ utang`;
    const done = () => alert("List tersalin! Paste ke grup WA ✅");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(done).catch(() => { prompt("Copy manual:", t); });
    else prompt("Copy manual:", t);
  };

  const exportJadwal = (denganTim: boolean) => {
    if (!jadwal) return;
    const timMap: Record<string, string> = {};
    if (denganTim && acak) Object.entries(acak).forEach(([tm, arr]) => arr.forEach((p) => { timMap[p.nama] = tm; }));
    const rows = roster.map((r: any, i: number) => {
      const u = db.users.find((x: any) => x.id === r.userId);
      const st = r.status === "confirmed_lunas" ? "Lunas" : r.status === "confirmed_langsung" ? "Bayar di tempat" : r.status === "wajib_bayar" ? "Wajib bayar" : "Utang";
      const base: (string | number)[] = [i + 1, u?.nama || "", u?.wa || "", r.posisi || "", st];
      if (denganTim) base.push(timMap[u?.nama || ""] || "");
      return base;
    });
    const head = denganTim ? ["No", "Nama", "WA", "Posisi", "Bayar", "Tim Acak"] : ["No", "Nama", "WA", "Posisi", "Bayar"];
    downloadCSV(`jadwal-${jadwal.tanggal}${denganTim ? "-tim" : ""}.csv`, head, rows);
  };

  const jalankanAcak = () => {
    const peserta = roster.map((r: any) => ({ nama: namaOf(r.userId), posisi: r.posisi || "Depan" }));
    if (peserta.length === 0) return alert("Belum ada yang isi list");
    setAcak(acakTim(peserta));
  };

  // ---- walk-in H-day: pemain datang tanpa isi list ----
  const tambahWalkin = () => {
    if (!jadwal || !walkinUser) return alert("Pilih pemain dulu");
    const d = load();
    const s = d.schedules.find((x: any) => x.id === jadwal.id);
    if (!s) return;
    if (s.status === "full_booked" || s.status === "tutup") return alert("Jadwal ini sedang tutup/full booked");
    if (d.rsvps.some((r: any) => r.scheduleId === s.id && r.userId === walkinUser && r.status !== "cancelled")) return alert("Pemain ini sudah ada di list");
    const aktif = d.rsvps.filter((r: any) => r.scheduleId === s.id && r.status !== "cancelled");
    if (aktif.length >= kuotaAktif(s)) return alert("Kuota sudah penuh");
    if (aktif.filter((r: any) => (r.posisi || "Depan") === walkinPosisi).length >= quotaPosisi(s, walkinPosisi as any)) return alert(`Slot ${walkinPosisi} penuh`);
    if (walkinCara === "potong") {
      const w = d.wallets[walkinUser] || { paket: 0, reguler: 0 };
      if (w.paket + w.reguler < 1) return alert("Kredit pemain 0 — pakai opsi Lunas Cash atau isi kredit dulu");
      if (w.paket > 0) w.paket -= 1; else w.reguler -= 1;
      d.wallets[walkinUser] = w;
      d.rsvps.push({ id: uid(), scheduleId: s.id, userId: walkinUser, status: "confirmed_lunas", posisi: walkinPosisi, metode: "deposit" });
      d.txs.push({ id: uid(), userId: walkinUser, label: `Walk-in ${s.tanggal} ${walkinPosisi} (potong 1 kredit)`, kreditPaket: 0, kreditReguler: 0, rupiah: 0, metode: "potong_deposit", tanggal: new Date().toISOString(), status: "success" });
    } else {
      d.rsvps.push({ id: uid(), scheduleId: s.id, userId: walkinUser, status: "confirmed_lunas", posisi: walkinPosisi, metode: "langsung" });
      d.txs.push({ id: uid(), userId: walkinUser, label: `Walk-in ${s.tanggal} ${walkinPosisi} (lunas cash 25rb)`, kreditPaket: 0, kreditReguler: 0, rupiah: 25000, metode: "pelunasan_cash", tanggal: new Date().toISOString(), status: "success" });
    }
    save(d); setWalkinUser(""); refresh();
  };

  const pendings = db.users.filter((u: any) => u.status === "pending");
  const klaims = db.txs.filter((t: any) => t.status === "pending");

  return (
    <div>
      <div className="section-title">
        <h2 style={{ margin: "4px 0" }}>🛠️ Panel Admin</h2>
        <div className="row">
          <Link href="/admin/jadwal"><button className="btn small">📅 Kelola Jadwal</button></Link>
          <Link href="/admin/keuangan"><button className="btn small">💰 Keuangan & PL</button></Link>
        </div>
      </div>
      <p className="muted">Semua kerjaan lapangan cukup dari HP di halaman ini.</p>

      <div className="card">
        <h3>✅ Approve pendaftar <span className="badge blue">{pendings.length}</span></h3>
        {pendings.length === 0 && <p className="muted">Tidak ada antrian. Santai ☕</p>}
        {pendings.map((u: any) => (
          <div key={u.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 17 }}>{u.nama}</b><br /><small className="muted">{u.wa}</small></div>
            <button className="btn small" onClick={() => approve(u.id, true)}>Approve ✅</button>
            <button className="btn danger small" onClick={() => approve(u.id, false)}>Tolak</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>💳 Verifikasi pembayaran <span className="badge yellow">{klaims.length}</span></h3>
        {klaims.length === 0 && <p className="muted">Tidak ada klaim menunggu.</p>}
        {klaims.map((t: any) => (
          <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <b>{namaOf(t.userId)}</b> — Paket {t.paket} (Rp{(t.rupiah || 0).toLocaleString("id-ID")}) via <span className="badge gray">{t.metode}</span>
            <br /><small className="muted">{t.catatan || ""} {t.bukti ? `• Bukti: ${t.bukti}` : ""} • {t.tanggal.slice(0, 16).replace("T", " ")}</small>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn small" onClick={() => verifKlaim(t.id, true)}>Setujui ✅</button>
              <button className="btn danger small" onClick={() => verifKlaim(t.id, false)}>Tolak</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>👥 Roster per tanggal</h3>
        <select value={jadwal?.id || ""} onChange={(e) => { setJadwalId(e.target.value); setAcak(null); }}>
          {db.schedules.slice().sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal)).map((s: any) => (
            <option key={s.id} value={s.id}>{s.tanggal} {s.jam} — {(STATUS_LABEL[s.status] || s.status)} ({listAktif(db, s.id).length}/{kuotaAktif(s)})</option>
          ))}
        </select>
        {jadwal && (
          <div>
            <p className="muted"><small>📍 {jadwal.lokasi} • Batas tarik list: H-2</small></p>
            {POSISI_MAIN.map((p) => {
              const arr = roster.filter((r: any) => (r.posisi || "Depan") === p);
              return (
                <div key={p} style={{ marginBottom: 8 }}>
                  <b>{p} <span className="badge blue">{arr.length}/{quotaPosisi(jadwal, p)}</span></b>
                  {arr.map((r: any) => (
                    <div key={r.id} className="row" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                      <div style={{ flex: 1 }}>
                        <b>{namaOf(r.userId)}</b>{" "}
                        <span className={`badge ${r.status === "confirmed_lunas" ? "green" : r.status === "confirmed_langsung" ? "blue" : r.status === "no_show" ? "gray" : "red"}`}>
                          {r.status === "confirmed_lunas" ? "✅ Lunas" : r.status === "confirmed_langsung" ? "💵 Di tempat" : r.status === "no_show" ? "🚫 No-show" : r.status === "wajib_bayar" ? "🔒 Wajib bayar" : "⏳ Utang"}
                        </span>
                      </div>
                      {(r.status === "confirmed_langsung" || r.status === "confirmed_utang" || r.status === "wajib_bayar") && (
                        <>
                          <button className="btn small" onClick={() => checkin(r.id, "lunas")}>Lunas ✅</button>
                          {(r.status !== "wajib_bayar") && <button className="btn secondary small" onClick={() => checkin(r.id, "belum")}>Belum bayar</button>}
                          {(r.status === "confirmed_utang" || r.status === "wajib_bayar") && <button className="btn secondary small" onClick={() => voidTunggakan(r.id)}>Void</button>}
                        </>
                      )}
                      {r.status === "confirmed_lunas" && <button className="btn secondary small" onClick={() => checkin(r.id, "nodatang")}>Tidak datang</button>}
                    </div>
                  ))}
                  {arr.length === 0 && <p className="muted"><small>— kosong —</small></p>}
                </div>
              );
            })}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn secondary small" onClick={salinWA}>📋 Salin ke WA</button>
              <button className="btn secondary small" onClick={() => exportJadwal(false)}>⬇️ CSV Jadwal</button>
              <button className="btn secondary small" onClick={() => window.print()}>🖨️ Cetak / PDF</button>
              <button className="btn warn small" onClick={jalankanAcak}>🎲 Acak 4 Tim</button>
            </div>
            <div className="card" style={{ background: "#211a08", borderColor: "var(--gold-deep)" }}>
              <h4>🚶 Walk-in H-day (datang tanpa isi list)</h4>
              <div className="grid2">
                <select value={walkinUser} onChange={(e) => setWalkinUser(e.target.value)}>
                  <option value="">— Pilih pemain —</option>
                  {db.users.filter((u: any) => u.status === "approved" && !roster.some((r: any) => r.userId === u.id)).map((u: any) => <option key={u.id} value={u.id}>{u.nama} (P{walletOf(db, u.id).paket}/R{walletOf(db, u.id).reguler})</option>)}
                </select>
                <select value={walkinPosisi} onChange={(e) => setWalkinPosisi(e.target.value as "GK" | "Belakang" | "Tengah" | "Depan")}>
                  {POSISI_MAIN.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <select value={walkinCara} onChange={(e) => setWalkinCara(e.target.value as any)}>
                <option value="potong">Potong 1 kredit pemain</option>
                <option value="cash">Lunas cash 25rb di tempat</option>
              </select>
              <button className="btn" onClick={tambahWalkin}>Tambah ke List ➜</button>
            </div>
            {acak && (
              <div className="card" style={{ background: "#FFFBEB" }}>
                <h4>🎲 Hasil acakan (bisa acak ulang)</h4>
                {Object.entries(acak).map(([tm, arr]) => (
                  <p key={tm}><b>Tim {tm} ({arr.length})</b><br /><small>{arr.map((p) => `${p.nama} (${p.posisi})`).join(", ")}</small></p>
                ))}
                <button className="btn secondary small" onClick={() => exportJadwal(true)}>⬇️ CSV + kolom Tim</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>➕ Kredit manual (cash / bantuan / koreksi)</h3>
        <p className="muted"><small>Untuk yang bayar cash di lapangan <b>tanpa klaim</b>, atau kasus khusus. Bantuan privat hanya terlihat di sini.</small></p>
        {db.users.filter((u: any) => u.status === "approved").map((u: any) => (
          <div key={u.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ flex: 1 }}><b>{u.nama}</b> {u.is_member && <span className="badge yellow">⭐ Member</span>}<br /><small className="muted">P{walletOf(db, u.id).paket} / R{walletOf(db, u.id).reguler}</small></div>
            <button className="btn secondary small" onClick={() => manualTopup(u.id, "1x", "cash")}>+1 cash</button>
            <button className="btn secondary small" onClick={() => manualTopup(u.id, "4x", "cash")}>+4 cash</button>
            <button className="btn secondary small" onClick={() => kurangiKredit(u.id, "reguler")}>−1 R</button>
            <button className="btn secondary small" onClick={() => kurangiKredit(u.id, "paket")}>−1 P</button>
            <button className="btn secondary small" onClick={() => toggleMember(u.id)}>{u.is_member ? "Cabut ⭐" : "Jadi ⭐"}</button>
          </div>
        ))}
        <h4 style={{ marginTop: 12 }}>🎗️ Kredit bantuan (privat)</h4>
        <div className="grid2">
          <select value={bantuanUser} onChange={(e) => setBantuanUser(e.target.value)}>
            <option value="">— Pilih pemain —</option>
            {db.users.filter((u: any) => u.status === "approved").map((u: any) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </select>
          <select value={bantuanKredit} onChange={(e) => setBantuanKredit(e.target.value)}>
            <option value="1">+1 kredit</option><option value="2">+2 kredit</option><option value="4">+4 kredit</option>
          </select>
        </div>
        <input placeholder="Alasan privat (hanya admin yang lihat)" value={bantuanAlasan} onChange={(e) => setBantuanAlasan(e.target.value)} />
        <button className="btn" onClick={beriBantuan}>Beri Kredit Bantuan</button>
      </div>

      <div className="card">
        <div className="section-title">
          <h3>👥 Database pemain ({db.users.length})</h3>
        </div>
        <div className="row">
          <button className="btn secondary small" onClick={exportPemain}>⬇️ Export Excel (CSV)</button>
          <button className="btn secondary small" onClick={() => window.print()}>🖨️ Cetak / PDF</button>
        </div>
        <div className="tblwrap"><table>
          <thead><tr><th>Nama</th><th>WA</th><th>Status</th><th>Member</th><th>Kredit</th><th>Tunggakan</th></tr></thead>
          <tbody>{db.users.map((u: any) => (
            <tr key={u.id}><td><b>{u.nama}</b></td><td>{u.wa}</td><td><span className="badge blue">{u.status}</span></td>
              <td>{u.is_member ? <span className="badge yellow">⭐ Member</span> : <span className="badge gray">Non</span>}</td>
              <td>P{walletOf(db, u.id).paket}/R{walletOf(db, u.id).reguler}</td>
              <td>{tunggakanOf(db, u.id).length > 0 ? <span className="badge red">🔒 {tunggakanOf(db, u.id).length}x</span> : "-"}</td></tr>
          ))}</tbody>
        </table></div>
      </div>

      <div className="card">
        <h3>📒 Kas terakhir <small className="muted">(salah input? hapus di sini — kredit yang terlanjur masuk ikut ditarik)</small></h3>
        <div className="tblwrap"><table>
          <thead><tr><th>Waktu</th><th>Pemain</th><th>Keterangan</th><th>Rp</th><th></th></tr></thead>
          <tbody>{db.txs.slice().reverse().slice(0, 30).map((t: any) => (
            <tr key={t.id}><td>{t.tanggal.slice(5, 16).replace("T", " ")}</td><td>{db.users.find((u: any) => u.id === t.userId)?.nama}</td>
              <td>{t.metode === "bantuan_privat" ? "🎗️ Kredit admin (privat)" : t.label} <span className="badge gray">{t.metode}</span>{t.privateNote ? <><br /><small className="muted">🔒 {t.privateNote}</small></> : ""}</td>
              <td>{t.rupiah.toLocaleString("id-ID")}</td>
              <td><button className="btn danger small" onClick={() => hapusTx(t.id)}>Hapus</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}
