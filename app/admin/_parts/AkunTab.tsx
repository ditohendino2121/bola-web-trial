"use client";
import { useState } from "react";
import { Dialog } from "../../../components/ui";
import { updateRow, setPasswordAkun, type DB, type User } from "../../../lib/data";
import { isSuperAdmin } from "../../../lib/rules";

const LABEL_ROLE: Record<string, string> = { superadmin: "Super admin", admin: "Admin", player: "Pemain" };

/** Atur siapa yang jadi admin (semua admin), dan ganti password akun lain (khusus super admin). */
export default function AkunTab({ db, me, reload }: { db: DB; me: User; reload: () => Promise<unknown> }) {
  const [cari, setCari] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<User | null>(null);
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [pesan, setPesan] = useState<{ jenis: "ok" | "err"; teks: string } | null>(null);
  const superAdmin = isSuperAdmin(me);

  const q = cari.trim().toLowerCase();
  const daftar = db.users
    .filter((u) => !q || u.nama.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.wa || "").includes(q))
    .sort((a, b) => (a.role === b.role ? a.nama.localeCompare(b.nama) : ["superadmin", "admin", "player"].indexOf(a.role) - ["superadmin", "admin", "player"].indexOf(b.role)));

  const ubahRole = async (u: User, role: "admin" | "player") => {
    const aksi = role === "admin" ? `Jadikan ${u.nama} admin? Admin bisa mengakses semua menu admin.` : `Cabut akses admin ${u.nama}?`;
    if (!confirm(aksi)) return;
    setBusy(true);
    try { await updateRow("profiles", u.id, role === "admin" ? { role, status: "approved" } : { role }); await reload(); }
    catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const bukaPw = (u: User) => { setTarget(u); setPw(""); setPw2(""); setPesan(null); };
  const simpanPw = async () => {
    if (!target) return;
    if (pw.length < 6) return setPesan({ jenis: "err", teks: "Password minimal 6 karakter." });
    if (pw !== pw2) return setPesan({ jenis: "err", teks: "Ulangi password belum sama." });
    setBusy(true);
    try {
      await setPasswordAkun(target.id, pw);
      setPesan({ jenis: "ok", teks: `Password ${target.nama} sudah diganti. Kabari pemainnya password baru ini, dan minta dia menggantinya sendiri di menu Saya.` });
      setPw(""); setPw2("");
    } catch (e: any) { setPesan({ jenis: "err", teks: e.message }); }
    setBusy(false);
  };

  return (
    <div className="panel">
      <h3>Akun & akses</h3>
      <p className="muted"><small>
        Jadikan akun admin atau cabut aksesnya. {superAdmin ? "Sebagai super admin, kamu juga bisa mengganti password akun yang lupa password." : "Ganti password akun lain hanya bisa dilakukan super admin."}
        {" "}Akun super admin hanya bisa diatur lewat Supabase.
      </small></p>
      <input placeholder="Cari nama, email, atau WA..." value={cari} onChange={(e) => setCari(e.target.value)} style={{ margin: "8px 0" }} />
      <div className="tablewrap"><table className="table compact">
        <thead><tr><th>Akun</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
          {daftar.map((u) => {
            const diriSendiri = u.id === me.id;
            return (
              <tr key={u.id}>
                <td><b>{u.nama}</b>{diriSendiri && <small className="muted"> (kamu)</small>}<br /><small className="muted">{u.email} · {u.wa}</small></td>
                <td><span className={`pill ${u.role === "player" ? "neutral" : "warn"}`}>{LABEL_ROLE[u.role] || u.role}</span></td>
                <td><span className="pill info">{u.status}</span></td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {u.role === "admin" && !diriSendiri && <button className="btn ghost sm" disabled={busy} onClick={() => ubahRole(u, "player")}>Cabut admin</button>}
                    {u.role === "player" && <button className="btn ghost sm" disabled={busy} onClick={() => ubahRole(u, "admin")}>Jadikan admin</button>}
                    {superAdmin && !diriSendiri && <button className="btn ghost sm" disabled={busy} onClick={() => bukaPw(u)}>Ganti password</button>}
                  </div>
                </td>
              </tr>
            );
          })}
          {daftar.length === 0 && <tr><td colSpan={4}><p className="muted" style={{ margin: "8px 0" }}>Tidak ada akun yang cocok.</p></td></tr>}
        </tbody>
      </table></div>

      {target && (
        <Dialog title={`Ganti password ${target.nama}`} onClose={() => setTarget(null)}>
          <p className="muted"><small>{target.email}</small></p>
          <label className="field"><span>Password baru</span><input type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Minimal 6 karakter" /></label>
          <label className="field"><span>Ulangi password baru</span><input type="text" autoComplete="off" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          <button className="btn block" disabled={busy} onClick={simpanPw}>{busy ? "Menyimpan..." : "Simpan password baru"}</button>
          {pesan && <div className={`note ${pesan.jenis}`} role="status" style={{ marginTop: 10 }}>{pesan.teks}</div>}
        </Dialog>
      )}
    </div>
  );
}
