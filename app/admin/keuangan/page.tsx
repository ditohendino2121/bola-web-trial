"use client";
import { useState } from "react";
import { useDB, PageHead, Loading, LoadError, Empty } from "../../../components/ui";
import { saldoAwalBulan, rupiah, isAdmin } from "../../../lib/rules";
import { updateRow, insertRow, deleteRow } from "../../../lib/data";
import { JENIS_PENGELUARAN, BASECAMP } from "../../../lib/club";
import { downloadCSV, namaBulanID } from "../../../lib/util";

const bulanKey = (iso: string) => (iso || "").slice(0, 7);

export default function Keuangan() {
  const { db, error, reload } = useDB();
  const [busy, setBusy] = useState(false);
  const [bulan, setBulan] = useState(new Date().toISOString().slice(0, 7));
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [jenis, setJenis] = useState<string>(JENIS_PENGELUARAN[0]);
  const [ket, setKet] = useState("");
  const [nominal, setNominal] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [inTanggal, setInTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [inSumber, setInSumber] = useState("");
  const [inKet, setInKet] = useState("");
  const [inNominal, setInNominal] = useState("");
  const [inEditId, setInEditId] = useState<string | null>(null);
  const [kasAwal, setKasAwal] = useState("");
  const [kasAwalTgl, setKasAwalTgl] = useState("");

  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="keuangan" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  if (!me || !isAdmin(me)) return <div className="page wrap"><Empty title="Khusus admin — login dengan akun admin." /></div>;

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await reload(); } catch (e: any) { alert(e.message); } setBusy(false); };
  const namaOf = (id: string) => db.users.find((u) => u.id === id)?.nama || id;

  const pemasukan = db.txs.filter((t) => t.status === "success" && (t.rupiah || 0) > 0 && bulanKey(t.tanggal) === bulan);
  const manualMasuk = (db.incomes || []).filter((e) => bulanKey(e.tanggal) === bulan);
  const totalOtomatis = pemasukan.reduce((a, t) => a + (t.rupiah || 0), 0);
  const totalManual = manualMasuk.reduce((a, e) => a + (e.nominal || 0), 0);
  const totalMasuk = totalOtomatis + totalManual;

  const keluar = (db.expenses || []).filter((e) => bulanKey(e.tanggal) === bulan);
  const totalKeluar = keluar.reduce((a, e) => a + (e.nominal || 0), 0);
  const keluarPerJenis: Record<string, number> = {};
  keluar.forEach((e) => { keluarPerJenis[e.jenis] = (keluarPerJenis[e.jenis] || 0) + (e.nominal || 0); });
  const surplus = totalMasuk - totalKeluar;
  const saldoAwal = saldoAwalBulan(db, bulan);
  const saldoAkhir = saldoAwal + surplus;

  const simpanKasAwal = () => run(async () => {
    const nom = parseInt(kasAwal.replace(/\D/g, "")) || 0;
    if (!kasAwalTgl) return alert("Isi tanggal kas awal dulu.");
    await updateRow("settings", 1, { kas_awal: nom, kas_awal_tanggal: kasAwalTgl }, "id");
    setKasAwal(""); setKasAwalTgl("");
  });

  const simpan = () => run(async () => {
    const nom = parseInt(nominal.replace(/\D/g, "")) || 0;
    if (!tanggal || !ket || nom <= 0) return alert("Isi tanggal, keterangan, dan nominal dulu.");
    if (editId) { await updateRow("expenses", editId, { tanggal, jenis, keterangan: ket, nominal: nom }); setEditId(null); }
    else await insertRow("expenses", { tanggal, jenis, keterangan: ket, nominal: nom });
    setKet(""); setNominal("");
  });
  const hapus = (id: string) => { if (!confirm("Hapus pengeluaran ini?")) return; run(() => deleteRow("expenses", id)); };
  const mulaiEdit = (e: any) => { setEditId(e.id); setTanggal(e.tanggal); setJenis(e.jenis); setKet(e.keterangan); setNominal(String(e.nominal)); };

  const simpanMasuk = () => run(async () => {
    const nom = parseInt(inNominal.replace(/\D/g, "")) || 0;
    if (!inTanggal || !inSumber || nom <= 0) return alert("Isi tanggal, sumber sponsor, dan nominal dulu.");
    if (inEditId) { await updateRow("incomes", inEditId, { tanggal: inTanggal, sumber: inSumber, keterangan: inKet, nominal: nom }); setInEditId(null); }
    else await insertRow("incomes", { tanggal: inTanggal, sumber: inSumber, keterangan: inKet, nominal: nom });
    setInSumber(""); setInKet(""); setInNominal("");
  });
  const hapusMasuk = (id: string) => { if (!confirm("Hapus pemasukan ini?")) return; run(() => deleteRow("incomes", id)); };
  const mulaiEditMasuk = (e: any) => { setInEditId(e.id); setInTanggal(e.tanggal); setInSumber(e.sumber); setInKet(e.keterangan || ""); setInNominal(String(e.nominal)); };

  const exportCSV = () => {
    const rows: (string | number)[][] = [];
    rows.push(["LAPORAN MUBA FC", namaBulanID(bulan)]);
    rows.push(["Kas awal", db.settings?.kasAwalTanggal || "", db.settings?.kasAwal || 0]);
    rows.push(["Saldo awal bulan", "", saldoAwal]);
    rows.push(["PEMASUKAN OTOMATIS (KAS)"]);
    pemasukan.forEach((t) => rows.push([String(t.tanggal).slice(0, 10), namaOf(t.userId), t.label, t.metode, t.rupiah]));
    rows.push(["PEMASUKAN MANUAL / SPONSOR"]);
    manualMasuk.forEach((e) => rows.push([e.tanggal, e.sumber, e.keterangan, "sponsor/manual", e.nominal]));
    rows.push(["Total Pemasukan", "", "", "", totalMasuk]);
    rows.push([]);
    rows.push(["PENGELUARAN"]);
    keluar.forEach((e) => rows.push([e.tanggal, e.jenis, e.keterangan, "", e.nominal]));
    rows.push(["Total Pengeluaran", "", "", "", totalKeluar]);
    rows.push(["SURPLUS/DEFISIT BULAN INI", "", "", "", surplus]);
    rows.push(["SALDO AKHIR (KAS DI TANGAN)", "", "", "", saldoAkhir]);
    rows.push([]);
    rows.push(["ARUS KAS"]);
    rows.push(["Saldo awal", "", saldoAwal]);
    rows.push(["Arus masuk - iuran pemain", "", totalOtomatis]);
    rows.push(["Arus masuk - sponsor/lain", "", totalManual]);
    Object.entries(keluarPerJenis).forEach(([j, v]) => rows.push([`Arus keluar - ${j}`, "", v as number]));
    rows.push(["Kenaikan/penurunan bersih", "", surplus]);
    rows.push(["Saldo akhir", "", saldoAkhir]);
    downloadCSV(`PL-MUBA-${bulan}.csv`, [`Laporan MUBA FC — ${namaBulanID(bulan)}`], rows);
  };

  return (
    <div>
      <PageHead title="Keuangan & laba rugi" crumbs={[{ href: "/admin", label: "Admin" }]} />
      <div className="page wrap">
        {busy && <div className="note info">Memproses...</div>}

        <div className="panel noprint">
          <label className="field"><span>Periode laporan</span><input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} /></label>
        </div>

        <div className="panel noprint">
          <h3>Kas awal</h3>
          <p className="muted"><small>Sekarang: <b>{rupiah(db.settings?.kasAwal || 0)}</b> per {db.settings?.kasAwalTanggal || "-"}. Saldo awal {namaBulanID(bulan)}: <b>{rupiah(saldoAwal)}</b></small></p>
          <div className="grid2">
            <input placeholder="Nominal kas awal" inputMode="numeric" value={kasAwal} onChange={(e) => setKasAwal(e.target.value)} />
            <input type="date" value={kasAwalTgl} onChange={(e) => setKasAwalTgl(e.target.value)} />
          </div>
          <button className="btn ghost" disabled={busy} onClick={simpanKasAwal}>Simpan kas awal</button>
        </div>

        <div className="printdoc">
          <div className="kop">
            <img src="/logo-muba.jpg" alt="MUBA FC" />
            <div>
              <small style={{ fontWeight: 800, color: "var(--gold-ink)" }}>MUBA FC &middot; MASJID UTSMAN BIN AFFAN</small>
              <h2>Laporan laba rugi — {namaBulanID(bulan)}</h2>
              <small>{BASECAMP}</small>
            </div>
          </div>

          <h4 style={{ marginTop: 16 }}>A. Pemasukan</h4>
          <table><tbody><tr><td>Saldo awal bulan {namaBulanID(bulan)}</td><td style={{ textAlign: "right" }}><b>{rupiah(saldoAwal)}</b></td></tr></tbody></table>
          <p><small><b>A1. Otomatis dari kas (top-up & pelunasan)</b></small></p>
          <table>
            <thead><tr><th>Tanggal</th><th>Dari</th><th>Keterangan</th><th style={{ textAlign: "right" }}>Nominal</th></tr></thead>
            <tbody>
              {pemasukan.map((t) => (<tr key={t.id}><td>{String(t.tanggal).slice(0, 10)}</td><td>{namaOf(t.userId)}</td><td>{t.label} <small>({t.metode})</small></td><td style={{ textAlign: "right" }}>{rupiah(t.rupiah)}</td></tr>))}
              {pemasukan.length === 0 && <tr><td colSpan={4}><small className="muted">Belum ada pemasukan kas bulan ini.</small></td></tr>}
            </tbody>
          </table>
          <p style={{ marginTop: 10 }}><small><b>A2. Pemasukan manual / sponsor</b></small></p>
          <table>
            <thead><tr><th>Tanggal</th><th>Sumber</th><th>Keterangan</th><th style={{ textAlign: "right" }}>Nominal</th></tr></thead>
            <tbody>
              {manualMasuk.map((e) => (<tr key={e.id}><td>{e.tanggal}</td><td>{e.sumber}</td><td>{e.keterangan || "-"}</td><td style={{ textAlign: "right" }}>{rupiah(e.nominal)}</td></tr>))}
              {manualMasuk.length === 0 && <tr><td colSpan={4}><small className="muted">Belum ada sponsor/pemasukan manual bulan ini.</small></td></tr>}
              <tr><td colSpan={3} className="total">Total pemasukan (A1 + A2)</td><td className="total" style={{ textAlign: "right" }}>{rupiah(totalMasuk)}</td></tr>
            </tbody>
          </table>

          <h4 style={{ marginTop: 16 }}>B. Pengeluaran</h4>
          <table>
            <thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th style={{ textAlign: "right" }}>Nominal</th></tr></thead>
            <tbody>
              {keluar.map((e) => (<tr key={e.id}><td>{e.tanggal}</td><td>{e.jenis}</td><td>{e.keterangan}</td><td style={{ textAlign: "right" }}>{rupiah(e.nominal)}</td></tr>))}
              {keluar.length === 0 && <tr><td colSpan={4}><small className="muted">Belum ada pengeluaran bulan ini.</small></td></tr>}
              <tr><td colSpan={3} className="total">Total pengeluaran</td><td className="total" style={{ textAlign: "right" }}>{rupiah(totalKeluar)}</td></tr>
            </tbody>
          </table>

          <table style={{ marginTop: 12 }}>
            <tbody>
              <tr><td className="total">Surplus / (defisit) bulan ini</td><td className="total" style={{ textAlign: "right", color: surplus >= 0 ? "var(--ok)" : "var(--bad)" }}>{rupiah(surplus)}</td></tr>
              <tr><td className="total">Saldo akhir (kas di tangan)</td><td className="total" style={{ textAlign: "right" }}>{rupiah(saldoAkhir)}</td></tr>
            </tbody>
          </table>

          <h4 style={{ marginTop: 20 }}>C. Laporan arus kas — {namaBulanID(bulan)}</h4>
          <table>
            <thead><tr><th>Uraian</th><th style={{ textAlign: "right" }}>Nominal</th></tr></thead>
            <tbody>
              <tr><td><b>I. Saldo awal bulan</b></td><td style={{ textAlign: "right" }}><b>{rupiah(saldoAwal)}</b></td></tr>
              <tr><td colSpan={2}><b>II. Arus kas masuk</b></td></tr>
              <tr><td style={{ paddingLeft: 24 }}>Iuran pemain (top-up & pelunasan)</td><td style={{ textAlign: "right" }}>{rupiah(totalOtomatis)}</td></tr>
              <tr><td style={{ paddingLeft: 24 }}>Sponsor & pemasukan lain</td><td style={{ textAlign: "right" }}>{rupiah(totalManual)}</td></tr>
              <tr><td><b>Total arus masuk</b></td><td style={{ textAlign: "right" }}><b>{rupiah(totalMasuk)}</b></td></tr>
              <tr><td colSpan={2}><b>III. Arus kas keluar</b></td></tr>
              {Object.entries(keluarPerJenis).map(([j, v]) => (<tr key={j}><td style={{ paddingLeft: 24 }}>{j}</td><td style={{ textAlign: "right" }}>{rupiah(v as number)}</td></tr>))}
              {keluar.length === 0 && <tr><td colSpan={2}><small className="muted">Belum ada arus keluar bulan ini.</small></td></tr>}
              <tr><td><b>Total arus keluar</b></td><td style={{ textAlign: "right" }}><b>{rupiah(totalKeluar)}</b></td></tr>
              <tr><td><b>IV. Kenaikan / (penurunan) kas bersih</b></td><td style={{ textAlign: "right", color: surplus >= 0 ? "var(--ok)" : "var(--bad)" }}><b>{rupiah(surplus)}</b></td></tr>
              <tr><td className="total">V. Saldo akhir bulan (kas di tangan)</td><td className="total" style={{ textAlign: "right" }}>{rupiah(saldoAkhir)}</td></tr>
            </tbody>
          </table>
          <p><small className="muted">Catatan: deposit paket adalah titipan main pemain (bukan laba bersih). Laporan ini adalah arus kas komunitas.</small></p>

          <div className="ttd">
            <div>
              <p>Tangerang, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br />Admin MUBA FC</p>
              <br /><br />
              <p>( ........................ )</p>
            </div>
          </div>
        </div>

        <div className="row noprint">
          <button className="btn" style={{ flex: 1 }} onClick={() => window.print()}>Download PDF (cetak, Save as PDF)</button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={exportCSV}>Export Excel (CSV)</button>
        </div>

        <div className="panel noprint">
          <h3>Catat pengeluaran</h3>
          <div className="grid2">
            <label className="field"><span>Tanggal</span><input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></label>
            <label className="field"><span>Jenis pengeluaran</span><select value={jenis} onChange={(e) => setJenis(e.target.value)}>{JENIS_PENGELUARAN.map((j) => <option key={j} value={j}>{j}</option>)}</select></label>
          </div>
          <input placeholder="Keterangan, cth: Sewa Lapangan ABC 2 jam" value={ket} onChange={(e) => setKet(e.target.value)} />
          <input placeholder="Nominal, cth: 500000" inputMode="numeric" value={nominal} onChange={(e) => setNominal(e.target.value)} />
          <div className="row">
            <button className="btn" disabled={busy} onClick={simpan}>{editId ? "Simpan perubahan" : "Simpan pengeluaran"}</button>
            {editId && <button className="btn ghost" onClick={() => { setEditId(null); setKet(""); setNominal(""); }}>Batal edit</button>}
          </div>
        </div>

        <div className="panel noprint">
          <h3>Pemasukan sponsor / manual</h3>
          <label className="field"><span>Tanggal</span><input type="date" value={inTanggal} onChange={(e) => setInTanggal(e.target.value)} /></label>
          <input placeholder="Sumber, cth: Sponsor Toko Berkah Jaya" value={inSumber} onChange={(e) => setInSumber(e.target.value)} />
          <input placeholder="Keterangan (opsional)" value={inKet} onChange={(e) => setInKet(e.target.value)} />
          <input placeholder="Nominal, cth: 1000000" inputMode="numeric" value={inNominal} onChange={(e) => setInNominal(e.target.value)} />
          <div className="row">
            <button className="btn" disabled={busy} onClick={simpanMasuk}>{inEditId ? "Simpan perubahan" : "Simpan pemasukan"}</button>
            {inEditId && <button className="btn ghost" onClick={() => { setInEditId(null); setInSumber(""); setInKet(""); setInNominal(""); }}>Batal edit</button>}
          </div>
          <div className="tablewrap" style={{ marginTop: 10 }}><table className="table compact">
            <thead><tr><th>Tanggal</th><th>Sumber</th><th>Keterangan</th><th>Nominal</th><th></th></tr></thead>
            <tbody>
              {(db.incomes || []).slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((e) => (
                <tr key={e.id}><td>{e.tanggal}</td><td><b>{e.sumber}</b></td><td>{e.keterangan || "-"}</td><td><b>{rupiah(e.nominal)}</b></td>
                  <td><button className="btn ghost sm" onClick={() => mulaiEditMasuk(e)}>Ubah</button> <button className="btn danger sm" onClick={() => hapusMasuk(e.id)}>Hapus</button></td></tr>
              ))}
            </tbody>
          </table></div>
        </div>

        <div className="panel noprint">
          <h3>Semua pengeluaran ({(db.expenses || []).length})</h3>
          <div className="tablewrap"><table className="table compact">
            <thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Nominal</th><th></th></tr></thead>
            <tbody>
              {(db.expenses || []).slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((e) => (
                <tr key={e.id}><td>{e.tanggal}</td><td><span className="pill neutral">{e.jenis}</span></td><td>{e.keterangan}</td><td><b>{rupiah(e.nominal)}</b></td>
                  <td><button className="btn ghost sm" onClick={() => mulaiEdit(e)}>Ubah</button> <button className="btn danger sm" onClick={() => hapus(e.id)}>Hapus</button></td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
