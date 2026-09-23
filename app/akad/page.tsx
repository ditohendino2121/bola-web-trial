"use client";
import { useEffect, useState } from "react";
import { fetchAll } from "../../lib/db";
import { AKAD_JUDUL, AKAD_TEKS, AKAD_VERSION } from "../../lib/akad";

export default function AkadPage() {
  const [db, setDb] = useState<any>(null);
  useEffect(() => { fetchAll().then(setDb).catch(()=>{}); }, []);
  const me = db?.users?.find((u: any) =>u.id === db.sessionId);
  return (
    <div>
      <h2 style={{ margin: "4px 0" }}>Akad Membership</h2>
      <p className="muted">Syarat dan ketentuan resmi MUBA FC. Versi: <b>{AKAD_VERSION}</b></p>
      {me && (
        <div className={`banner ${me.setuju_akad && me.akad_version === AKAD_VERSION ? "ok" : "warn"}`}>
          {me.setuju_akad && me.akad_version === AKAD_VERSION
            ? ` Kamu menyetujui ${me.akad_version} pada ${me.setuju_at ? new Date(me.setuju_at).toLocaleString("id-ID") : "-"}`
            : ` Kamu belum menyetujui versi ${AKAD_VERSION}. Buka Beranda untuk menyetujui.`}
        </div>
      )}
      <div className="card" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>
        <h3 style={{ textAlign: "center" }}>{AKAD_JUDUL}</h3>
        {AKAD_TEKS}
      </div>
      <p className="muted"><small>Akad ini juga ditampilkan saat pendaftaran. Mencetak halaman ini: Ctrl+P → Save as PDF.</small></p>
    </div>
  );
}
