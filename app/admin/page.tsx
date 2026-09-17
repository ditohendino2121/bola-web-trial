"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  walletOf, listAktif, kuotaAktif, quotaPosisi,
  POSISI_MAIN, STATUS_LABEL, tunggakanOf, hargaSekali, totalTunggakanRp,
} from "../../lib/store";
import { supa, fetchAll, adminUpdate, adminInsert, adminDelete } from "../../lib/db";
import { downloadCSV, today, acakTim, buildWAList } from "../../lib/export";

export default function Admin() {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [jadwalId, setJadwalId] = useState("");
  const [acak, setAcak] = useState<Record<string, { nama: string; posisi: string }[]> | null>(null);
  const [bantuanUser, setBantuanUser] = useState("");
  const [bantuanKredit, setBantuanKredit] = useState("1");
  const [bantuanAlasan, setBantuanAlasan] = useState("");
  const [walkinUser, setWalkinUser] = useState("");
  const [walkinPosisi, setWalkinPosisi] = useState<"GK" | "Belakang" | "Tengah" | "Depan">("Depan");
  const [walkinCara, setWalkinCara] = useState<"potong" | "cash">("potong");
  const [manualText, setManualText] = useState("");
  const manualLabel = (u: any) => `${u.nama} (${u.wa})`;
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

  const refresh = reload;
  const namaOf = (id: string) => db.users.find((u: any) => u.id === id)?.nama || id;
  const sb = () => supa();

  const approve = (id: string, ok: boolean) =>
    run(() => adminUpdate("profiles", id, { status: ok ? "approved" : "rejected" }).then(() => {}));

  const verifKlaim = async (txId: string, ok: boolean) => {
    const t = db.txs.find((x: any) => x.id === txId);
    if (!t) return;
    let alasan = "";
    if (!ok) {
      const a = prompt("Alasan penolakan untuk pemain:");
      if (a === null) return;
      alasan = a;
    }
    await run(async () => {
      if (ok) {
        await adminUpdate("txs", txId, { status: "success" });
        const w = walletOf(db, t.userId);
        const gk = !!t.isGk;
        const patch = t.paket === "4x"
          ? (gk ? { paket_gk: w.paket_gk + 4 } : { paket: w.paket + 4 })
          : (gk ? { reguler_gk: w.reguler_gk + 1 } : { reguler: w.reguler + 1 });
        // upsert wallet
        const { error } = await sb().from("wallets").upsert({ user_id: t.userId, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
        if (error) throw new Error(error.message);
        if (t.paket === "4x") await adminUpdate("profiles", t.userId, { is_member: true });
      } else {
        await adminUpdate("txs", txId, { status: "rejected", catatan: (t.catatan || "") + ` [Ditolak: ${alasan}]` });
      }
    });
  };

  const manualTopup = (userId: string, kind: "1x" | "4x", isGK = false) =>
    run(async () => {
      const w = walletOf(db, userId);
      const patch = kind === "1x"
        ? (isGK ? { reguler_gk: w.reguler_gk + 1 } : { reguler: w.reguler + 1 })
        : (isGK ? { paket_gk: w.paket_gk + 4 } : { paket: w.paket + 4 });
      const rp = kind === "1x" ? (isGK ? 15000 : 25000) : (isGK ? 50000 : 90000);
      const { error } = await sb().from("wallets").upsert({ user_id: userId, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
      if (error) throw new Error(error.message);
      await adminInsert("txs", {
        user_id: userId, label: `Top-up manual ${kind}${isGK ? " (harga GK)" : ""} (cash)`,
        kredit_paket: kind === "4x" ? 4 : 0, kredit_reguler: kind === "1x" ? 1 : 0,
        rupiah: rp, metode: "manual_cash", status: "success", is_gk: isGK,
      });
      if (kind === "4x") await adminUpdate("profiles", userId, { is_member: true });
    });

  const kurangiKredit = async (userId: string, kind: "paket" | "reguler" | "paket_gk" | "reguler_gk") => {
    const w = walletOf(db, userId);
    if ((w[kind] || 0) < 1) return alert("Kreditnya sudah 0");
    const alasan = prompt(`Kurangi 1 kredit ${kind} untuk ${namaOf(userId)}?\nIsi alasan (cth: walk-in tanpa list, koreksi):`);
    if (alasan === null) return;
    await run(async () => {
      const { error } = await sb().from("wallets").upsert({
        user_id: userId,
        paket: w.paket - (kind === "paket" ? 1 : 0),
        reguler: w.reguler - (kind === "reguler" ? 1 : 0),
        paket_gk: w.paket_gk - (kind === "paket_gk" ? 1 : 0),
        reguler_gk: w.reguler_gk - (kind === "reguler_gk" ? 1 : 0),
      });
      if (error) throw new Error(error.message);
      await adminInsert("txs", {
        user_id: userId, label: `Kurangi 1 kredit ${kind} manual`, rupiah: 0,
        metode: "koreksi_minus", status: "success", private_note: alasan,
      });
    });
  };

  const beriBantuan = () =>
    run(async () => {
      if (!bantuanUser) return alert("Pilih pemain dulu");
      const n = parseInt(bantuanKredit) || 1;
      const w = walletOf(db, bantuanUser);
      const { error } = await sb().from("wallets").upsert({ user_id: bantuanUser, paket: w.paket, reguler: w.reguler + n });
      if (error) throw new Error(error.message);
      await adminInsert("txs", {
        user_id: bantuanUser, label: "Kredit admin", kredit_reguler: n,
        rupiah: 0, metode: "bantuan_privat", status: "success", private_note: bantuanAlasan,
      });
      setBantuanUser(""); setBantuanAlasan("");
      alert("Kredit bantuan masuk. Pemain hanya melihat label netral 'Kredit admin'.");
    });

  const toggleMember = (userId: string) => {
    const u = db.users.find((x: any) => x.id === userId);
    run(() => adminUpdate("profiles", userId, { is_member: !u?.is_member }).then(() => {}));
  };

  const hapusTx = async (txId: string) => {
    const t = db.txs.find((x: any) => x.id === txId);
    if (!t) return;
    const granted = (t.kreditPaket || 0) + (t.kreditReguler || 0);
    if (!confirm(`Hapus "${t.label}"?${granted > 0 && t.status === "success" ? `\nKredit yang sudah masuk (${granted}) akan ditarik kembali.` : ""}`)) return;
    await run(async () => {
      if (t.status === "success" && granted > 0) {
        const w = walletOf(db, t.userId);
        const gk = !!t.isGk;
        const { error } = await sb().from("wallets").upsert({
          user_id: t.userId,
          paket: Math.max(0, w.paket - (!gk ? (t.kreditPaket || 0) : 0)),
          reguler: Math.max(0, w.reguler - (!gk ? (t.kreditReguler || 0) : 0)),
          paket_gk: Math.max(0, w.paket_gk - (gk ? (t.kreditPaket || 0) : 0)),
          reguler_gk: Math.max(0, w.reguler_gk - (gk ? (t.kreditReguler || 0) : 0)),
        });
        if (error) throw new Error(error.message);
      }
      await adminDelete("txs", txId);
    });
  };

  const checkin = (rsvpId: string, aksi: "lunas" | "belum" | "nodatang") =>
    run(async () => {
      const r = db.rsvps.find((x: any) => x.id === rsvpId);
      if (!r) return;
      const nominal = hargaSekali(r.posisi || "");
      const nominalStr = nominal.toLocaleString("id-ID");
      if (aksi === "lunas") {
        await adminUpdate("rsvps", rsvpId, { status: "confirmed_lunas" });
        await adminInsert("txs", {
          user_id: r.userId, label: `Pelunasan di lapangan (${nominalStr})`, rupiah: nominal,
          metode: "pelunasan_cash", status: "success",
        });
      } else if (aksi === "belum") {
        await adminUpdate("rsvps", rsvpId, { status: "wajib_bayar" });
        await adminInsert("txs", {
          user_id: r.userId, label: `Tunggakan: hadir tapi belum bayar (${nominalStr})`, rupiah: nominal,
          metode: "tagihan", status: "success",
        });
      } else {
        if (r.status === "confirmed_lunas") {
          await adminUpdate("rsvps", rsvpId, { status: "no_show" });
        } else {
          await adminUpdate("rsvps", rsvpId, { status: "wajib_bayar" });
          await adminInsert("txs", {
            user_id: r.userId, label: `Tunggakan: tidak datang & belum bayar (${nominalStr})`, rupiah: nominal,
            metode: "tagihan", status: "success",
          });
        }
      }
    });

  const voidTunggakan = async (rsvpId: string) => {
    const alasan = prompt("Alasan void (hanya terlihat admin):");
    if (alasan === null) return;
    await run(async () => {
      const r = db.rsvps.find((x: any) => x.id === rsvpId);
      await adminUpdate("rsvps", rsvpId, { status: "cancelled" });
      await adminInsert("txs", {
        user_id: r.userId, label: "Tunggakan di-void admin", rupiah: 0,
        metode: "void", status: "success", private_note: alasan,
      });
    });
  };

  const tambahWalkin = () =>
    run(async () => {
      if (!jadwal || !walkinUser) return alert("Pilih pemain dulu");
      if (jadwal.status === "full_booked" || jadwal.status === "tutup") return alert("Jadwal tutup/full booked");
      if (roster.some((r: any) => r.userId === walkinUser)) return alert("Pemain ini sudah ada di list");
      if (roster.length >= kuotaAktif(jadwal)) return alert("Kuota sudah penuh");
      if (roster.filter((r: any) => (r.posisi || "Depan") === walkinPosisi).length >= quotaPosisi(jadwal, walkinPosisi)) return alert(`Slot ${walkinPosisi} penuh`);
      const w = walletOf(db, walkinUser);
      const isGK = walkinPosisi === "GK";
      if (walkinCara === "potong") {
        const total = w.paket + w.reguler + w.paket_gk + w.reguler_gk;
        if (total < 1) return alert("Kredit pemain 0 — pakai Lunas Cash atau isi kredit dulu");
        let patch: any;
        let pakaiGk = false;
        if (isGK) {
          if (w.paket_gk > 0) { patch = { paket_gk: w.paket_gk - 1 }; pakaiGk = true; }
          else if (w.reguler_gk > 0) { patch = { reguler_gk: w.reguler_gk - 1 }; pakaiGk = true; }
          else if (w.paket > 0) patch = { paket: w.paket - 1 };
          else patch = { reguler: w.reguler - 1 };
        } else {
          patch = w.paket > 0 ? { paket: w.paket - 1 } : { reguler: w.reguler - 1 };
        }
        const { error } = await sb().from("wallets").upsert({ user_id: walkinUser, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
        if (error) throw new Error(error.message);
        await adminInsert("rsvps", { schedule_id: jadwal.id, user_id: walkinUser, status: "confirmed_lunas", posisi: walkinPosisi, metode: "deposit", pakai_gk: pakaiGk });
        await adminInsert("txs", { user_id: walkinUser, label: `Walk-in ${jadwal.tanggal} ${walkinPosisi} (potong 1 kredit)`, metode: "potong_deposit", status: "success" });
      } else {
        const nominal = isGK ? 15000 : 25000;
        await adminInsert("rsvps", { schedule_id: jadwal.id, user_id: walkinUser, status: "confirmed_lunas", posisi: walkinPosisi, metode: "langsung" });
        await adminInsert("txs", { user_id: walkinUser, label: `Walk-in ${jadwal.tanggal} ${walkinPosisi} (lunas cash ${nominal.toLocaleString("id-ID")})`, rupiah: nominal, metode: "pelunasan_cash", status: "success" });
      }
      setWalkinUser("");
    });

  const exportPemain = () => {
    const rows = db.users.map((u: any) => {
      const w = walletOf(db, u.id);
      const main = db.rsvps.filter((r: any) => r.userId === u.id && r.status !== "cancelled").length;
      return [u.nama, u.wa, u.email || "", u.role, u.status, u.is_member ? "Member" : "Non-member", w.paket, w.reguler, w.paket_gk, w.reguler_gk, totalTunggakanRp(db, u.id), main];
    });
    downloadCSV(`pemain-${today()}.csv`, ["Nama", "WA", "Email", "Role", "Status", "Member", "Kredit Paket", "Kredit Reguler", "Kredit Paket GK", "Kredit Reguler GK", "Tunggakan Rp", "Total Ikut"], rows);
  };

  const jadwal = db.schedules.find((s: any) => s.id === jadwalId) || db.schedules.slice().sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal))[0];
  const roster = jadwal ? listAktif(db, jadwal.id) : [];

  const salinWA = () => {
    if (!jadwal) return;
    const t = buildWAList(
      jadwal,
      (p) => quotaPosisi(jadwal, p as any),
      (p) => roster.filter((r: any) => (r.posisi || "Depan") === p).map((r: any) => namaOf(r.userId)),
    );
    const done = () => alert("Template WA tersalin! Paste ke grup ✅");
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
      {busy && <div className="banner info">⏳ Memproses...</div>}

      <div className="card">
        <h3>✅ Approve pendaftar <span className="badge blue">{pendings.length}</span></h3>
        {pendings.length === 0 && <p className="muted">Tidak ada antrian. Santai ☕</p>}
        {pendings.map((u: any) => (
          <div key={u.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 17 }}>{u.nama}</b><br /><small className="muted">{u.wa} • {u.email}</small></div>
            <button className="btn small" disabled={busy} onClick={() => approve(u.id, true)}>Approve ✅</button>
            <button className="btn danger small" disabled={busy} onClick={() => approve(u.id, false)}>Tolak</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>💳 Verifikasi pembayaran <span className="badge yellow">{klaims.length}</span></h3>
        {klaims.length === 0 && <p className="muted">Tidak ada klaim menunggu.</p>}
        {klaims.map((t: any) => (
          <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <b>{namaOf(t.userId)}</b> — Paket {t.paket}{t.isGk ? " (harga GK 🧤)" : ""} (Rp{(t.rupiah || 0).toLocaleString("id-ID")}) via <span className="badge gray">{t.metode}</span>
            <br /><small className="muted">{t.catatan || ""} {t.bukti ? `• Bukti: ${t.bukti}` : ""} • {String(t.tanggal).slice(0, 16).replace("T", " ")}</small>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn small" disabled={busy} onClick={() => verifKlaim(t.id, true)}>Setujui ✅</button>
              <button className="btn danger small" disabled={busy} onClick={() => verifKlaim(t.id, false)}>Tolak</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>👥 Roster per tanggal</h3>
        <select value={jadwal?.id || ""} disabled={busy} onChange={(e) => { setJadwalId(e.target.value); setAcak(null); }}>
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
                          <button className="btn small" disabled={busy} onClick={() => checkin(r.id, "lunas")}>Lunas ✅</button>
                          {(r.status !== "wajib_bayar") && <button className="btn secondary small" disabled={busy} onClick={() => checkin(r.id, "belum")}>Belum bayar</button>}
                          {(r.status === "confirmed_utang" || r.status === "wajib_bayar") && <button className="btn secondary small" disabled={busy} onClick={() => voidTunggakan(r.id)}>Void</button>}
                        </>
                      )}
                      {r.status === "confirmed_lunas" && <button className="btn secondary small" disabled={busy} onClick={() => checkin(r.id, "nodatang")}>Tidak datang</button>}
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
                <select value={walkinPosisi} onChange={(e) => setWalkinPosisi(e.target.value as any)}>
                  {POSISI_MAIN.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <select value={walkinCara} onChange={(e) => setWalkinCara(e.target.value as any)}>
                <option value="potong">Potong 1 kredit pemain</option>
                <option value="cash">Lunas cash di tempat (GK 15rb / lainnya 25rb)</option>
              </select>
              <button className="btn" disabled={busy} onClick={tambahWalkin}>Tambah ke List ➜</button>
            </div>
            {acak && (
              <div className="card" style={{ background: "#211a08" }}>
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
        <p className="muted"><small>Pilih pemain dulu (ketik untuk cari), baru tombol aksi muncul. Untuk cash tanpa klaim / koreksi / ⭐.</small></p>
        <input
          list="manual-pemain-list"
          placeholder="🔍 Ketik nama atau pilih dari daftar..."
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />
        <datalist id="manual-pemain-list">
          {db.users.filter((u: any) => u.status === "approved").map((u: any) => (
            <option key={u.id} value={manualLabel(u)} />
          ))}
        </datalist>
        {(() => {
          const u = db.users.find((x: any) => x.status === "approved" && (manualLabel(x) === manualText || x.nama === manualText));
          if (!u) return <p className="muted"><small>{manualText ? "Nama tidak cocok — pilih dari daftar." : "Belum ada pemain dipilih."}</small></p>;
          const w = walletOf(db, u.id);
          return (
            <div className="card" style={{ background: "#211a08", borderColor: "var(--gold-deep)" }}>
              <div className="section-title">
                <div><b style={{ fontSize: 18 }}>{u.nama}</b> {u.is_member && <span className="badge yellow">⭐ Member</span>}<br />
                <small className="muted">{u.wa} • P{w.paket} / R{w.reguler} / GK {w.paket_gk + w.reguler_gk}</small></div>
                <button className="btn secondary small" onClick={() => setManualText("")}>✖ Ganti</button>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn secondary small" disabled={busy} onClick={() => manualTopup(u.id, "1x")}>+1 cash</button>
                <button className="btn secondary small" disabled={busy} onClick={() => manualTopup(u.id, "4x")}>+4 cash</button>
                <button className="btn secondary small" disabled={busy} onClick={() => manualTopup(u.id, "1x", true)}>+1 GK</button>
                <button className="btn secondary small" disabled={busy} onClick={() => manualTopup(u.id, "4x", true)}>+4 GK</button>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn secondary small" disabled={busy} onClick={() => kurangiKredit(u.id, "reguler")}>−1 R</button>
                <button className="btn secondary small" disabled={busy} onClick={() => kurangiKredit(u.id, "paket")}>−1 P</button>
                <button className="btn secondary small" disabled={busy} onClick={() => kurangiKredit(u.id, "reguler_gk")}>−1 RGK</button>
                <button className="btn secondary small" disabled={busy} onClick={() => toggleMember(u.id)}>{u.is_member ? "Cabut ⭐" : "Jadi ⭐"}</button>
              </div>
            </div>
          );
        })()}
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
        <button className="btn" disabled={busy} onClick={beriBantuan}>Beri Kredit Bantuan</button>
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
        <h3>📒 Kas terakhir <small className="muted">(salah input? hapus — kredit ikut ditarik)</small></h3>
        <div className="tblwrap"><table>
          <thead><tr><th>Waktu</th><th>Pemain</th><th>Keterangan</th><th>Rp</th><th></th></tr></thead>
          <tbody>{db.txs.slice().reverse().slice(0, 30).map((t: any) => (
            <tr key={t.id}><td>{String(t.tanggal).slice(5, 16).replace("T", " ")}</td><td>{db.users.find((u: any) => u.id === t.userId)?.nama}</td>
              <td>{t.metode === "bantuan_privat" ? "🎗️ Kredit admin (privat)" : t.label} <span className="badge gray">{t.metode}</span>{t.privateNote ? <><br /><small className="muted">🔒 {t.privateNote}</small></> : ""}</td>
              <td>{(t.rupiah || 0).toLocaleString("id-ID")}</td>
              <td><button className="btn danger small" disabled={busy} onClick={() => hapusTx(t.id)}>Hapus</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}
