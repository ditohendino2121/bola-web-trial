"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDB, PageHead, Tabs, Loading, LoadError, Empty } from "../../components/ui";
import {
  walletOf, listAktif, kuotaAktif, quotaPosisi,
  POSISI_MAIN, STATUS_LABEL, tunggakanOf, hargaSekali, totalTunggakanRp,
  langsungBelumLunas, TARIF_KREDIT, nominalWallet, refundableWallet, totalBantuanGranted, totalMasuk, isAdmin } from "../../lib/rules";
import { supa } from "../../lib/supa";
import { updateRow, insertRow, deleteRow } from "../../lib/data";
import { downloadCSV, today, acakTim, buildWAList } from "../../lib/util";
import AkunTab from "./_parts/AkunTab";

type Tab = "kelola-jadwal" | "approval" | "roster" | "kredit-manual" | "database" | "arus-kas" | "wallet" | "akun";
const TABS: { key: Tab; label: string }[] = [
  { key: "kelola-jadwal", label: "Kelola jadwal" },
  { key: "approval", label: "Approval & pembayaran" },
  { key: "roster", label: "Roster jadwal" },
  { key: "kredit-manual", label: "Kredit manual" },
  { key: "database", label: "Database pemain" },
  { key: "arus-kas", label: "Arus kas" },
  { key: "wallet", label: "Wallet" },
  { key: "akun", label: "Akun & akses" },
];

export default function Admin() {
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("approval");
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
  const [alihText, setAlihText] = useState("");
  const [alihPickAlih, setAlihPickAlih] = useState("");
  const [walletSearch, setWalletSearch] = useState("");
  const [refundText, setRefundText] = useState("");
  const refundLabel = (u: any) => `${u.nama} (${u.wa})`;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (q && TABS.some((t) => t.key === q)) setTab(q);
  }, []);
  const switchTab = (k: string) => {
    setTab(k as Tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", k);
    history.replaceState(null, "", url.toString());
  };

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="panel admin" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  if (!me || !isAdmin(me)) return <div className="page wrap"><Empty title="Khusus admin — login dengan akun admin." /></div>;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await reload(); } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const namaOf = (id: string) => db.users.find((u) => u.id === id)?.nama || id;
  const sb = () => supa();

  const approve = (id: string, ok: boolean) => run(() => updateRow("profiles", id, { status: ok ? "approved" : "rejected" }));

  const verifKlaim = async (txId: string, ok: boolean) => {
    const t = db.txs.find((x) => x.id === txId);
    if (!t) return;
    let alasan = "";
    if (!ok) {
      const a = prompt("Alasan penolakan untuk pemain:");
      if (a === null) return;
      alasan = a;
    }
    await run(async () => {
      if (ok) {
        await updateRow("txs", txId, { status: "success" });
        const w = walletOf(db, t.userId);
        const gk = !!t.isGk;
        const patch = t.paket === "4x" ? (gk ? { paket_gk: w.paket_gk + 4 } : { paket: w.paket + 4 }) : (gk ? { reguler_gk: w.reguler_gk + 1 } : { reguler: w.reguler + 1 });
        const { error: e } = await sb().from("wallets").upsert({ user_id: t.userId, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
        if (e) throw new Error(e.message);
        if (t.paket === "4x") await updateRow("profiles", t.userId, { is_member: true });
      } else {
        await updateRow("txs", txId, { status: "rejected", catatan: (t.catatan || "") + ` [Ditolak: ${alasan}]` });
      }
    });
  };

  const manualTopup = (userId: string, kind: "1x" | "4x", isGK = false) => run(async () => {
    const w = walletOf(db, userId);
    const patch = kind === "1x" ? (isGK ? { reguler_gk: w.reguler_gk + 1 } : { reguler: w.reguler + 1 }) : (isGK ? { paket_gk: w.paket_gk + 4 } : { paket: w.paket + 4 });
    const rp = kind === "1x" ? (isGK ? 15000 : 25000) : (isGK ? 50000 : 90000);
    const { error: e } = await sb().from("wallets").upsert({ user_id: userId, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
    if (e) throw new Error(e.message);
    await insertRow("txs", { user_id: userId, label: `Top-up manual ${kind}${isGK ? " (harga GK)" : ""} (cash)`, kredit_paket: kind === "4x" ? 4 : 0, kredit_reguler: kind === "1x" ? 1 : 0, rupiah: rp, metode: "manual_cash", status: "success", is_gk: isGK });
    if (kind === "4x") await updateRow("profiles", userId, { is_member: true });
  });

  const kurangiKredit = async (userId: string, kind: "paket" | "reguler" | "paket_gk" | "reguler_gk") => {
    const w = walletOf(db, userId);
    if ((w as any)[kind] < 1) {
      const labelMap: any = { paket: "Paket (P)", reguler: "Reguler (R)", paket_gk: "Paket GK (PGK)", reguler_gk: "Reguler GK (RGK)" };
      return alert(`${labelMap[kind]} sudah 0, tidak bisa dikurangi.\nSisa: P${w.paket} / R${w.reguler} / PGK${w.paket_gk} / RGK${w.reguler_gk}`);
    }
    const alasan = prompt(`Kurangi 1 kredit ${kind} untuk ${namaOf(userId)}?\nIsi alasan (cth: walk-in tanpa list, koreksi):`);
    if (alasan === null) return;
    await run(async () => {
      const { error: e } = await sb().from("wallets").upsert({
        user_id: userId,
        paket: w.paket - (kind === "paket" ? 1 : 0), reguler: w.reguler - (kind === "reguler" ? 1 : 0),
        paket_gk: w.paket_gk - (kind === "paket_gk" ? 1 : 0), reguler_gk: w.reguler_gk - (kind === "reguler_gk" ? 1 : 0),
      });
      if (e) throw new Error(e.message);
      await insertRow("txs", { user_id: userId, label: `Kurangi 1 kredit ${kind} manual`, rupiah: 0, metode: "koreksi_minus", status: "success", private_note: alasan });
    });
  };

  const beriBantuan = () => run(async () => {
    if (!bantuanUser) return alert("Pilih pemain dulu.");
    const n = parseInt(bantuanKredit) || 1;
    const w = walletOf(db, bantuanUser);
    const { error: e } = await sb().from("wallets").upsert({ user_id: bantuanUser, paket: w.paket, reguler: w.reguler + n });
    if (e) throw new Error(e.message);
    await insertRow("txs", { user_id: bantuanUser, label: "Kredit admin", kredit_reguler: n, rupiah: 0, metode: "bantuan_privat", status: "success", private_note: bantuanAlasan });
    setBantuanUser(""); setBantuanAlasan("");
    alert("Kredit bantuan masuk. Pemain hanya melihat label netral 'Kredit admin'.");
  });

  const toggleMember = (userId: string) => {
    const u = db.users.find((x) => x.id === userId);
    run(() => updateRow("profiles", userId, { is_member: !u?.is_member }));
  };

  const hapusTx = async (txId: string) => {
    const t = db.txs.find((x) => x.id === txId);
    if (!t) return;
    const granted = (t.kreditPaket || 0) + (t.kreditReguler || 0);
    if (!confirm(`Hapus "${t.label}"?${granted > 0 && t.status === "success" ? `\nKredit yang sudah masuk (${granted}) akan ditarik kembali.` : ""}`)) return;
    await run(async () => {
      if (t.status === "success" && granted > 0) {
        const w = walletOf(db, t.userId);
        const gk = !!t.isGk;
        const { error: e } = await sb().from("wallets").upsert({
          user_id: t.userId,
          paket: Math.max(0, w.paket - (!gk ? (t.kreditPaket || 0) : 0)), reguler: Math.max(0, w.reguler - (!gk ? (t.kreditReguler || 0) : 0)),
          paket_gk: Math.max(0, w.paket_gk - (gk ? (t.kreditPaket || 0) : 0)), reguler_gk: Math.max(0, w.reguler_gk - (gk ? (t.kreditReguler || 0) : 0)),
        });
        if (e) throw new Error(e.message);
      }
      await deleteRow("txs", txId);
    });
  };

  const checkin = (rsvpId: string, aksi: "lunas" | "belum" | "nodatang") => run(async () => {
    const r = db.rsvps.find((x) => x.id === rsvpId);
    if (!r) return;
    const nominal = hargaSekali(r.posisi || "");
    const nominalStr = nominal.toLocaleString("id-ID");
    if (aksi === "lunas") {
      await updateRow("rsvps", rsvpId, { status: "confirmed_lunas" });
      await insertRow("txs", { user_id: r.userId, label: `Pelunasan di lapangan (${nominalStr})`, rupiah: nominal, metode: "pelunasan_cash", status: "success" });
    } else if (aksi === "belum") {
      await updateRow("rsvps", rsvpId, { status: "wajib_bayar" });
      await insertRow("txs", { user_id: r.userId, label: `Tunggakan: hadir tapi belum bayar (${nominalStr})`, rupiah: nominal, metode: "tagihan", status: "success" });
    } else {
      if (r.status === "confirmed_lunas") {
        await updateRow("rsvps", rsvpId, { status: "no_show" });
      } else {
        await updateRow("rsvps", rsvpId, { status: "wajib_bayar" });
        await insertRow("txs", { user_id: r.userId, label: `Tunggakan: tidak datang & belum bayar (${nominalStr})`, rupiah: nominal, metode: "tagihan", status: "success" });
      }
    }
  });

  const voidTunggakan = async (rsvpId: string) => {
    const alasan = prompt("Alasan void (hanya terlihat admin):");
    if (alasan === null) return;
    await run(async () => {
      const r = db.rsvps.find((x) => x.id === rsvpId);
      await updateRow("rsvps", rsvpId, { status: "cancelled" });
      await insertRow("txs", { user_id: r!.userId, label: "Tunggakan di-void admin", rupiah: 0, metode: "void", status: "success", private_note: alasan });
    });
  };

  const tambahWalkin = () => run(async () => {
    if (!jadwal || !walkinUser) return alert("Pilih pemain dulu.");
    if (jadwal.status === "full_booked" || jadwal.status === "tutup") return alert("Jadwal tutup/full booked.");
    if (roster.some((r: any) => r.userId === walkinUser)) return alert("Pemain ini sudah ada di list.");
    if (roster.length >= kuotaAktif(jadwal)) return alert("Kuota sudah penuh.");
    if (roster.filter((r: any) => (r.posisi || "Depan") === walkinPosisi).length >= quotaPosisi(jadwal, walkinPosisi)) return alert(`Slot ${walkinPosisi} penuh.`);
    const w = walletOf(db, walkinUser);
    const isGK = walkinPosisi === "GK";
    if (walkinCara === "potong") {
      const total = w.paket + w.reguler + w.paket_gk + w.reguler_gk;
      if (total < 1) return alert("Kredit pemain 0, pakai Lunas cash atau isi kredit dulu.");
      let patch: any; let pakaiGk = false;
      if (isGK) {
        if (w.paket_gk > 0) { patch = { paket_gk: w.paket_gk - 1 }; pakaiGk = true; }
        else if (w.reguler_gk > 0) { patch = { reguler_gk: w.reguler_gk - 1 }; pakaiGk = true; }
        else if (w.paket > 0) patch = { paket: w.paket - 1 };
        else patch = { reguler: w.reguler - 1 };
      } else {
        patch = w.paket > 0 ? { paket: w.paket - 1 } : { reguler: w.reguler - 1 };
      }
      const { error: e } = await sb().from("wallets").upsert({ user_id: walkinUser, paket: w.paket, reguler: w.reguler, paket_gk: w.paket_gk, reguler_gk: w.reguler_gk, ...patch });
      if (e) throw new Error(e.message);
      await insertRow("rsvps", { schedule_id: jadwal.id, user_id: walkinUser, status: "confirmed_lunas", posisi: walkinPosisi, metode: "deposit", pakai_gk: pakaiGk });
      await insertRow("txs", { user_id: walkinUser, label: `Walk-in ${jadwal.tanggal} ${walkinPosisi} (potong 1 kredit)`, metode: "potong_deposit", status: "success" });
    } else {
      const nominal = isGK ? 15000 : 25000;
      await insertRow("rsvps", { schedule_id: jadwal.id, user_id: walkinUser, status: "confirmed_lunas", posisi: walkinPosisi, metode: "langsung" });
      await insertRow("txs", { user_id: walkinUser, label: `Walk-in ${jadwal.tanggal} ${walkinPosisi} (lunas cash ${nominal.toLocaleString("id-ID")})`, rupiah: nominal, metode: "pelunasan_cash", status: "success" });
    }
    setWalkinUser("");
  });

  const exportPemain = () => {
    const rows = db.users.map((u) => {
      const w = walletOf(db, u.id);
      const r = refundableWallet(db, u.id);
      const main = db.rsvps.filter((rr) => rr.userId === u.id && rr.status !== "cancelled").length;
      return [u.nama, u.wa, u.email || "", u.role, u.status, u.is_member ? "Member" : "Non-member", w.paket, w.reguler, w.paket_gk, w.reguler_gk, r.bantuanSisa, r.nominal, totalTunggakanRp(db, u.id), main];
    });
    downloadCSV(`pemain-${today()}.csv`, ["Nama", "WA", "Email", "Role", "Status", "Member", "Kredit Paket", "Kredit Reguler", "Kredit Paket GK", "Kredit Reguler GK", "Bantuan dikecualikan", "Nominal refund Rp", "Tunggakan Rp", "Total Ikut"], rows as any);
  };

  const jadwal = db.schedules.find((s) => s.id === jadwalId) || db.schedules.slice().sort((a, b) => a.tanggal.localeCompare(b.tanggal))[0];
  const roster = jadwal ? listAktif(db, jadwal.id) : [];

  const salinWA = () => {
    if (!jadwal) return;
    const t = buildWAList(jadwal, (p) => quotaPosisi(jadwal, p as any), (p) => roster.filter((r: any) => (r.posisi || "Depan") === p).map((r: any) => namaOf(r.userId)));
    const done = () => alert("Template WA tersalin, paste ke grup.");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(done).catch(() => prompt("Salin manual:", t));
    else prompt("Salin manual:", t);
  };

  const exportJadwal = (denganTim: boolean) => {
    if (!jadwal) return;
    const timMap: Record<string, string> = {};
    if (denganTim && acak) Object.entries(acak).forEach(([tm, arr]) => arr.forEach((p) => { timMap[p.nama] = tm; }));
    const rows = roster.map((r: any, i: number) => {
      const u = db.users.find((x) => x.id === r.userId);
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
    if (peserta.length === 0) return alert("Belum ada yang isi list.");
    setAcak(acakTim(peserta));
  };

  const pendings = db.users.filter((u) => u.status === "pending");
  const klaims = db.txs.filter((t) => t.status === "pending");

  const walletRows = db.users
    .map((u) => {
      const w = walletOf(db, u.id);
      const r = refundableWallet(db, u.id);
      const m = totalMasuk(db, u.id);
      const tung = totalTunggakanRp(db, u.id);
      const belumLunas = langsungBelumLunas(db, u.id).length;
      return { u, w, ...r, masuk: m, tung, belumLunas, totalKredit: r.sisa.paket + r.sisa.reguler + r.sisa.paket_gk + r.sisa.reguler_gk };
    })
    .filter((x) => { if (!walletSearch) return true; const q = walletSearch.toLowerCase(); return x.u.nama.toLowerCase().includes(q) || x.u.wa.includes(q); })
    .sort((a, b) => b.nominal - a.nominal || b.totalKredit - a.totalKredit);
  const walletTotal = walletRows.reduce((a, r) => ({ kredit: a.kredit + r.totalKredit, nominal: a.nominal + r.nominal, bantuan: a.bantuan + r.bantuanSisa, masukKredit: a.masukKredit + r.masuk.total, masukNominal: a.masukNominal + r.masuk.nominal }), { kredit: 0, nominal: 0, bantuan: 0, masukKredit: 0, masukNominal: 0 });

  const exportWallet = () => {
    const rows = walletRows.map((r) => [r.u.nama, r.u.wa, r.w.paket, r.w.reguler, r.w.paket_gk, r.w.reguler_gk, r.totalKredit, r.bantuanSisa, r.nominal, r.masuk.p, r.masuk.r, r.masuk.pgk, r.masuk.rgk, r.masuk.total, r.masuk.nominal, r.tung, r.u.is_member ? "Member" : "Non-member"]);
    downloadCSV(`wallet-${today()}.csv`, ["Nama", "WA", "Sisa P", "Sisa R", "Sisa PGK", "Sisa RGK", "Sisa total", "Bantuan dikecualikan", "Nominal sisa Rp", "Masuk P", "Masuk R", "Masuk PGK", "Masuk RGK", "Masuk total", "Nominal masuk Rp", "Tunggakan Rp", "Member"], rows as any);
  };

  const refundPreview = (() => {
    const u = db.users.find((x) => x.status === "approved" && (refundLabel(x) === refundText || x.nama === refundText));
    if (!u) return null;
    const r = refundableWallet(db, u.id);
    const tung = totalTunggakanRp(db, u.id);
    const belum = langsungBelumLunas(db, u.id).length;
    return { u, ...r, tung, belum, blok: tung > 0 || belum > 0 };
  })();

  const doRefund = () => run(async () => {
    if (!refundPreview) return alert("Pilih pemain dulu.");
    const { u, sisa, refundable, bantuanSisa, nominal, tung, belum } = refundPreview as any;
    if (nominal <= 0) return alert("Nominal 0, tidak ada yang bisa ditarik.");
    if (tung > 0 || belum > 0) return alert(`Masih ada tunggakan (Rp${tung.toLocaleString("id-ID")}) atau bayar-di-tempat belum lunas (${belum}x). Selesaikan dulu baru bisa tarik dana.`);
    const detail = `P${sisa.paket} R${sisa.reguler} PGK${sisa.paket_gk} RGK${sisa.reguler_gk} -> refundable P${refundable.paket} R${refundable.reguler} PGK${refundable.paket_gk} RGK${refundable.reguler_gk} (bantuan ${bantuanSisa} dikecualikan)`;
    if (!confirm(`Tarik dana full untuk ${u.nama}?\nSisa: ${detail}\nNominal: Rp${nominal.toLocaleString("id-ID")}\n\nKredit akan jadi 0. Lanjut?`)) return;
    const { error: wErr } = await sb().from("wallets").upsert({ user_id: u.id, paket: 0, reguler: 0, paket_gk: 0, reguler_gk: 0 });
    if (wErr) throw new Error(wErr.message);
    await insertRow("txs", { user_id: u.id, label: `Refund tarik dana full (${detail})`, kredit_paket: 0, kredit_reguler: 0, rupiah: 0, metode: "refund", status: "success", private_note: `Refund Rp${nominal} — ${detail}` });
    await insertRow("expenses", { tanggal: today(), jenis: "Refund Pemain", keterangan: `Refund ${u.nama} — Rp${nominal.toLocaleString("id-ID")} (${detail})`, nominal });
    if (u.is_member && confirm("Pemain ini Member. Cabut status Member sekalian? (kredit paket ikut ditarik)")) {
      await updateRow("profiles", u.id, { is_member: false });
    }
    setRefundText("");
    alert(`Refund Rp${nominal.toLocaleString("id-ID")} tercatat. Wallet ${u.nama} sekarang 0.`);
  });

  return (
    <div>
      <PageHead title="Panel admin" desc="Semua kerjaan lapangan, pakai tab di bawah, data tidak hilang." tabs={<Tabs items={TABS} value={tab} onChange={switchTab} label="Tab admin" />} />
      <div className="page wrap">
        {busy && <div className="note info">Memproses...</div>}

        {tab === "kelola-jadwal" && (
          <div className="panel">
            <h3>Kelola jadwal</h3>
            <p className="muted">Buat, ubah, hapus, atau ubah status jadwal (buka / tutup / full booked / sparing).</p>
            <Link href="/admin/jadwal"><button className="btn">Buka kelola jadwal</button></Link>
            <div style={{ marginTop: 10 }}>
              {db.schedules.slice().sort((a, b) => a.tanggal.localeCompare(b.tanggal)).slice(0, 3).map((s) => (
                <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}><b>{s.tanggal} {s.jam}</b> — {s.lokasi} <span className="pill neutral">{STATUS_LABEL[s.status] || s.status}</span> <span className="pill info">{listAktif(db, s.id).length}/{kuotaAktif(s)}</span></div>
              ))}
              {db.schedules.length === 0 && <p className="muted">Belum ada jadwal.</p>}
            </div>
          </div>
        )}

        {tab === "approval" && (
          <div className="stack">
            <div className="panel">
              <h3>Approve pendaftar <span className="pill info">{pendings.length}</span></h3>
              {pendings.length === 0 && <p className="muted">Tidak ada antrian.</p>}
              {pendings.map((u) => (
                <div key={u.id} className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <div style={{ flex: 1 }}><b style={{ fontSize: 17 }}>{u.nama}</b><br /><small className="muted">{u.wa} &middot; {u.email}</small></div>
                  <button className="btn sm" disabled={busy} onClick={() => approve(u.id, true)}>Approve</button>
                  <button className="btn danger sm" disabled={busy} onClick={() => approve(u.id, false)}>Tolak</button>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Verifikasi pembayaran <span className="pill warn">{klaims.length}</span></h3>
              {klaims.length === 0 && <p className="muted">Tidak ada klaim menunggu.</p>}
              {klaims.map((t) => (
                <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <b>{namaOf(t.userId)}</b> — Paket {t.paket}{t.isGk ? " (harga GK)" : ""} (Rp{(t.rupiah || 0).toLocaleString("id-ID")}) via <span className="pill neutral">{t.metode}</span>
                  <br /><small className="muted">{t.catatan || ""} {t.bukti ? `Bukti: ${t.bukti}` : ""} &middot; {String(t.tanggal).slice(0, 16).replace("T", " ")}</small>
                  <div className="row" style={{ marginTop: 6 }}>
                    <button className="btn sm" disabled={busy} onClick={() => verifKlaim(t.id, true)}>Setujui</button>
                    <button className="btn danger sm" disabled={busy} onClick={() => verifKlaim(t.id, false)}>Tolak</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Tunggakan dan void</h3>
              <p className="muted">Kelola lunas / belum bayar / void via Roster jadwal, buka tab Roster untuk check-in lapang.</p>
              <button className="btn ghost sm" onClick={() => switchTab("roster")}>Ke roster</button>
            </div>
          </div>
        )}

        {tab === "roster" && (
          <div className="panel">
            <h3>Roster per tanggal</h3>
            <select value={jadwal?.id || ""} disabled={busy} onChange={(e) => { setJadwalId(e.target.value); setAcak(null); }}>
              {db.schedules.slice().sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map((s) => (
                <option key={s.id} value={s.id}>{s.tanggal} {s.jam} — {STATUS_LABEL[s.status] || s.status} ({listAktif(db, s.id).length}/{kuotaAktif(s)})</option>
              ))}
            </select>
            {jadwal && (
              <div>
                <p className="muted"><small>{jadwal.lokasi} &middot; batas tarik list H-2</small></p>
                {POSISI_MAIN.map((p) => {
                  const arr = roster.filter((r: any) => (r.posisi || "Depan") === p);
                  return (
                    <div key={p} style={{ marginBottom: 8 }}>
                      <b>{p} <span className="pill info">{arr.length}/{quotaPosisi(jadwal, p)}</span></b>
                      {arr.map((r: any) => (
                        <div key={r.id} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}>
                          <div style={{ flex: 1 }}>
                            <b>{namaOf(r.userId)}</b>{" "}
                            <span className={`pill ${r.status === "confirmed_lunas" ? "ok" : r.status === "confirmed_langsung" ? "info" : r.status === "no_show" ? "neutral" : "bad"}`}>
                              {r.status === "confirmed_lunas" ? "Lunas" : r.status === "confirmed_langsung" ? "Di tempat" : r.status === "no_show" ? "No-show" : r.status === "wajib_bayar" ? "Wajib bayar" : "Utang"}
                            </span>
                            {r.is_alihan && <span className="pill warn" style={{ marginLeft: 6 }}>Alihan</span>}
                          </div>
                          {(r.status === "confirmed_langsung" || r.status === "confirmed_utang" || r.status === "wajib_bayar") && (<>
                            <button className="btn sm" disabled={busy} onClick={() => checkin(r.id, "lunas")}>Lunas</button>
                            {r.status !== "wajib_bayar" && <button className="btn ghost sm" disabled={busy} onClick={() => checkin(r.id, "belum")}>Belum bayar</button>}
                            {(r.status === "confirmed_utang" || r.status === "wajib_bayar") && <button className="btn ghost sm" disabled={busy} onClick={() => voidTunggakan(r.id)}>Void</button>}
                          </>)}
                          {r.status === "confirmed_lunas" && <button className="btn ghost sm" disabled={busy} onClick={() => checkin(r.id, "nodatang")}>Tidak datang</button>}
                          {r.is_alihan && r.alih_dari && <small className="muted" style={{ marginLeft: 6 }}>dari {namaOf(r.alih_dari)}</small>}
                        </div>
                      ))}
                      {arr.length === 0 && <p className="muted"><small>Kosong</small></p>}
                    </div>
                  );
                })}

                <div className="panel" style={{ background: "var(--gold-wash)" }}>
                  <h4>Alih slot (admin gantikan pemain)</h4>
                  <p className="muted"><small>Pemain out hubungi admin, admin pilih slot dan pengganti (posisi sama, maks 1x oper, deposit hangus privat).</small></p>
                  <select value={alihText} onChange={(e) => { setAlihText(e.target.value); setAlihPickAlih(""); }} style={{ marginBottom: 6 }}>
                    <option value="">— Pilih slot yang mau dialihkan —</option>
                    {roster.filter((r: any) => (r.status === "confirmed_lunas" || r.status === "confirmed_langsung") && !r.is_alihan).map((r: any) => (
                      <option key={r.id} value={r.id}>{namaOf(r.userId)} — {r.posisi} &middot; {r.status === "confirmed_lunas" ? "Lunas" : "Di tempat"}</option>
                    ))}
                  </select>
                  {alihText && (
                    <select value={alihPickAlih} onChange={(e) => setAlihPickAlih(e.target.value)} style={{ marginBottom: 6 }}>
                      <option value="">— Pilih pengganti —</option>
                      {db.users.filter((u) => u.status === "approved" && !roster.some((x: any) => x.userId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.nama} ({u.wa})</option>)}
                    </select>
                  )}
                  <button className="btn" disabled={busy || !alihText || !alihPickAlih} onClick={async () => {
                    const rId = alihText; const gId = alihPickAlih;
                    if (!rId || !gId) return;
                    const hasil = await supa().rpc("rpc_alih_slot", { p_rsvp_id: rId, p_pengganti: gId });
                    if (hasil.error) return alert(hasil.error.message);
                    const d: any = hasil.data;
                    if (!d?.ok) return alert(d?.msg || "Gagal alih.");
                    await reload();
                    setAlihText(""); setAlihPickAlih("");
                  }}>Alihkan slot</button>
                </div>

                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn ghost sm" onClick={salinWA}>Salin ke WA</button>
                  <button className="btn ghost sm" onClick={() => exportJadwal(false)}>CSV jadwal</button>
                  <button className="btn ghost sm" onClick={() => window.print()}>Cetak / PDF</button>
                  <button className="btn warn sm" onClick={jalankanAcak}>Acak 4 tim</button>
                </div>

                <div className="panel" style={{ background: "var(--gold-wash)" }}>
                  <h4>Walk-in hari-H (datang tanpa isi list)</h4>
                  <div className="grid2">
                    <select value={walkinUser} onChange={(e) => setWalkinUser(e.target.value)}>
                      <option value="">— Pilih pemain —</option>
                      {db.users.filter((u) => u.status === "approved" && !roster.some((r: any) => r.userId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.nama} (P{walletOf(db, u.id).paket}/R{walletOf(db, u.id).reguler})</option>)}
                    </select>
                    <select value={walkinPosisi} onChange={(e) => setWalkinPosisi(e.target.value as any)}>
                      {POSISI_MAIN.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <select value={walkinCara} onChange={(e) => setWalkinCara(e.target.value as any)}>
                    <option value="potong">Potong 1 kredit pemain</option>
                    <option value="cash">Lunas cash di tempat (GK Rp15.000 / lainnya Rp25.000)</option>
                  </select>
                  <button className="btn" disabled={busy} onClick={tambahWalkin}>Tambah ke list</button>
                </div>

                {acak && (
                  <div className="panel" style={{ background: "var(--gold-wash)" }}>
                    <h4>Hasil acakan (bisa acak ulang)</h4>
                    {Object.entries(acak).map(([tm, arr]) => (<p key={tm}><b>Tim {tm} ({arr.length})</b><br /><small>{arr.map((p) => `${p.nama} (${p.posisi})`).join(", ")}</small></p>))}
                    <button className="btn ghost sm" onClick={() => exportJadwal(true)}>CSV + kolom tim</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "kredit-manual" && (
          <div className="panel">
            <h3>Kredit manual (cash / bantuan / koreksi)</h3>
            <p className="muted"><small>Pilih pemain dulu (ketik untuk cari), baru tombol aksi muncul. Untuk cash tanpa klaim / koreksi.</small></p>
            <input list="manual-pemain-list" placeholder="Ketik nama atau pilih dari daftar..." value={manualText} onChange={(e) => setManualText(e.target.value)} />
            <datalist id="manual-pemain-list">{db.users.filter((u) => u.status === "approved").map((u) => <option key={u.id} value={manualLabel(u)} />)}</datalist>
            {(() => {
              const u = db.users.find((x) => x.status === "approved" && (manualLabel(x) === manualText || x.nama === manualText));
              if (!u) return <p className="muted"><small>{manualText ? "Nama tidak cocok, pilih dari daftar." : "Belum ada pemain dipilih."}</small></p>;
              const w = walletOf(db, u.id);
              return (
                <div className="panel" style={{ background: "var(--gold-wash)" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div><b style={{ fontSize: 18 }}>{u.nama}</b> {u.is_member && <span className="pill warn">Member</span>}<br /><small className="muted">{u.wa} &middot; P{w.paket} / R{w.reguler} / PGK{w.paket_gk} / RGK{w.reguler_gk}</small></div>
                    <button className="btn ghost sm" onClick={() => setManualText("")}>Ganti</button>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn ghost sm" disabled={busy} onClick={() => manualTopup(u.id, "1x")}>+1 cash</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => manualTopup(u.id, "4x")}>+4 cash</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => manualTopup(u.id, "1x", true)}>+1 GK</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => manualTopup(u.id, "4x", true)}>+4 GK</button>
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <button className="btn ghost sm" disabled={busy} onClick={() => kurangiKredit(u.id, "reguler")}>-1 R</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => kurangiKredit(u.id, "paket")}>-1 P</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => kurangiKredit(u.id, "paket_gk")}>-1 PGK</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => kurangiKredit(u.id, "reguler_gk")}>-1 RGK</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => toggleMember(u.id)}>{u.is_member ? "Cabut member" : "Jadi member"}</button>
                  </div>
                </div>
              );
            })()}
            <h4 style={{ marginTop: 12 }}>Kredit bantuan (privat)</h4>
            <div className="grid2">
              <select value={bantuanUser} onChange={(e) => setBantuanUser(e.target.value)}>
                <option value="">— Pilih pemain —</option>
                {db.users.filter((u) => u.status === "approved").map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
              </select>
              <select value={bantuanKredit} onChange={(e) => setBantuanKredit(e.target.value)}>
                <option value="1">+1 kredit</option><option value="2">+2 kredit</option><option value="4">+4 kredit</option>
              </select>
            </div>
            <input placeholder="Alasan privat (hanya admin yang lihat)" value={bantuanAlasan} onChange={(e) => setBantuanAlasan(e.target.value)} />
            <button className="btn" disabled={busy} onClick={beriBantuan}>Beri kredit bantuan</button>
          </div>
        )}

        {tab === "database" && (
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3>Database pemain ({db.users.length})</h3>
              <div className="row">
                <button className="btn ghost sm" onClick={exportPemain}>Export CSV</button>
                <button className="btn ghost sm" onClick={() => window.print()}>Cetak / PDF</button>
              </div>
            </div>
            <div className="tablewrap"><table className="table compact">
              <thead><tr><th>Nama</th><th>WA</th><th>Status</th><th>Member</th><th>Kredit</th><th>Tunggakan</th></tr></thead>
              <tbody>{db.users.map((u) => (
                <tr key={u.id}><td><b>{u.nama}</b></td><td>{u.wa}</td><td><span className="pill info">{u.status}</span></td>
                  <td>{u.is_member ? <span className="pill warn">Member</span> : <span className="pill neutral">Non</span>}</td>
                  <td>P{walletOf(db, u.id).paket}/R{walletOf(db, u.id).reguler} PGK{walletOf(db, u.id).paket_gk}/RGK{walletOf(db, u.id).reguler_gk}</td>
                  <td>{tunggakanOf(db, u.id).length > 0 ? <span className="pill bad">{tunggakanOf(db, u.id).length}x</span> : "-"}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        )}

        {tab === "arus-kas" && (
          <div className="stack">
            <div className="panel">
              <h3>Arus kas</h3>
              <p className="muted">Ringkasan kas terakhir, link ke laporan lengkap.</p>
              <Link href="/admin/keuangan"><button className="btn">Buka keuangan & PL (per bulan)</button></Link>
            </div>
            <div className="panel">
              <h3>Kas terakhir <small className="muted">(salah input? hapus, kredit ikut ditarik)</small></h3>
              <div className="tablewrap"><table className="table compact">
                <thead><tr><th>Waktu</th><th>Pemain</th><th>Keterangan</th><th className="n">Rp</th><th></th></tr></thead>
                <tbody>{db.txs.slice().reverse().slice(0, 30).map((t) => (
                  <tr key={t.id}><td>{String(t.tanggal).slice(5, 16).replace("T", " ")}</td><td>{db.users.find((u) => u.id === t.userId)?.nama}</td>
                    <td>{t.metode === "bantuan_privat" ? "Kredit admin (privat)" : t.label} <span className="pill neutral">{t.metode}</span>{t.privateNote ? <><br /><small className="muted">{t.privateNote}</small></> : ""}</td>
                    <td className="n">{(t.rupiah || 0).toLocaleString("id-ID")}</td>
                    <td><button className="btn danger sm" disabled={busy} onClick={() => hapusTx(t.id)}>Hapus</button></td></tr>
                ))}</tbody>
              </table></div>
            </div>
          </div>
        )}

        {tab === "akun" && <AkunTab db={db} me={me} reload={reload} />}

        {tab === "wallet" && (
          <div className="stack">
            <div className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}><h3>Sisa wallet per pemain</h3><button className="btn ghost sm" onClick={exportWallet}>Export CSV</button></div>
              <p className="muted">Sisa = wallet sekarang (setelah isi list). Masuk = total kredit yang pernah di-top-up (klaim approve + manual cash + koreksi minus), tanpa bantuan gratis. Tarif: P Rp22.500, R Rp25.000, PGK Rp12.500, RGK Rp15.000.</p>
              <input placeholder="Cari nama / WA..." value={walletSearch} onChange={(e) => setWalletSearch(e.target.value)} style={{ marginBottom: 8 }} />
              <div className="tablewrap"><table className="table compact">
                <thead><tr><th rowSpan={2}>Nama</th><th colSpan={5}>Sisa</th><th rowSpan={2}>Bantuan</th><th rowSpan={2}>Nominal sisa</th><th colSpan={6}>Masuk</th><th rowSpan={2}>Tunggakan</th></tr><tr><th>P</th><th>R</th><th>PGK</th><th>RGK</th><th>Total</th><th>P</th><th>R</th><th>PGK</th><th>RGK</th><th>Total</th><th>Nominal</th></tr></thead>
                <tbody>
                  {walletRows.map((r) => (
                    <tr key={r.u.id}><td><b>{r.u.nama}</b><br /><small className="muted">{r.u.wa}</small></td><td>{r.w.paket}</td><td>{r.w.reguler}</td><td>{r.w.paket_gk}</td><td>{r.w.reguler_gk}</td><td><b>{r.totalKredit}</b></td>
                      <td>{r.bantuanSisa > 0 ? <span className="pill warn">{r.bantuanSisa} R</span> : "-"}</td><td><b>Rp{r.nominal.toLocaleString("id-ID")}</b></td>
                      <td>{r.masuk.p}</td><td>{r.masuk.r}</td><td>{r.masuk.pgk}</td><td>{r.masuk.rgk}</td><td><b>{r.masuk.total}</b></td><td><b>Rp{r.masuk.nominal.toLocaleString("id-ID")}</b></td>
                      <td>{r.tung > 0 ? <span className="pill bad">{r.tung.toLocaleString("id-ID")}</span> : r.belumLunas > 0 ? <span className="pill info">{r.belumLunas}x belum</span> : "-"}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background: "var(--gold-wash)", fontWeight: 700 }}><td><b>Total</b> ({walletRows.length})</td><td colSpan={4}></td><td><b>{walletTotal.kredit}</b></td><td><b>{walletTotal.bantuan} R</b></td><td><b>Rp{walletTotal.nominal.toLocaleString("id-ID")}</b></td><td colSpan={4}></td><td><b>{walletTotal.masukKredit}</b></td><td><b>Rp{walletTotal.masukNominal.toLocaleString("id-ID")}</b></td><td></td></tr></tfoot>
              </table></div>
              <p className="muted"><small>Total nominal = total dana yang harus dikembalikan jika semua tarik full hari ini. Bantuan dikecualikan.</small></p>
            </div>
            <div className="panel" style={{ background: "var(--gold-wash)" }}>
              <h3>Tarik dana (full, kredit jadi 0)</h3>
              <p className="muted"><small>Pilih pemain, cek nominal, lalu tarik semua. Diblokir jika nominal 0 / ada tunggakan / bayar-di-tempat belum lunas.</small></p>
              <input list="refund-pemain-list" placeholder="Ketik nama atau pilih..." value={refundText} onChange={(e) => setRefundText(e.target.value)} />
              <datalist id="refund-pemain-list">{db.users.filter((u) => u.status === "approved").map((u) => <option key={u.id} value={refundLabel(u)} />)}</datalist>
              {refundPreview ? (
                <div className="panel" style={{ marginTop: 8 }}>
                  <b style={{ fontSize: 16 }}>{refundPreview.u.nama}</b> {refundPreview.u.is_member && <span className="pill warn">Member</span>}<br />
                  <small className="muted">Sisa P{refundPreview.sisa.paket} R{refundPreview.sisa.reguler} PGK{refundPreview.sisa.paket_gk} RGK{refundPreview.sisa.reguler_gk}, refundable P{refundPreview.refundable.paket} R{refundPreview.refundable.reguler} PGK{refundPreview.refundable.paket_gk} RGK{refundPreview.refundable.reguler_gk} (bantuan {refundPreview.bantuanSisa} dikecualikan)</small>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>Rp{refundPreview.nominal.toLocaleString("id-ID")}</div>
                  {refundPreview.blok && <div className="note err" style={{ marginTop: 6 }}>Tunggakan Rp{refundPreview.tung.toLocaleString("id-ID")} / {refundPreview.belum}x belum lunas, selesaikan dulu.</div>}
                  {refundPreview.nominal === 0 && <div className="note warn" style={{ marginTop: 6 }}>Nominal 0, tidak ada yang ditarik.</div>}
                  <button className="btn danger" disabled={busy || refundPreview.nominal === 0 || !!refundPreview.blok} onClick={doRefund} style={{ marginTop: 8 }}>Tarik semua dana, kredit jadi 0</button>
                </div>
              ) : <p className="muted"><small>{refundText ? "Nama tidak cocok, pilih dari daftar." : "Belum ada pemain dipilih."}</small></p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
