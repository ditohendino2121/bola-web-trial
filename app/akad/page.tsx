"use client";
import { useDB, PageHead, Loading, LoadError } from "../../components/ui";
import { AKAD_JUDUL, AKAD_TEKS, AKAD_VERSION } from "../../lib/akad";

export default function AkadPage() {
  const { db, error, reload } = useDB();
  if (error) return <div className="page wrap"><LoadError message={error} onRetry={reload} /></div>;
  if (!db) return <div className="page wrap"><Loading what="akad" /></div>;
  const me = db.users.find((u) => u.id === db.sessionId);
  const setuju = !!me && me.setuju_akad && me.akad_version === AKAD_VERSION;

  return (
    <div>
      <PageHead title="Akad membership" desc={`Syarat dan ketentuan resmi MUBA FC — versi ${AKAD_VERSION}.`} />
      <div className="page wrap">
        {me && (
          <div className={`note ${setuju ? "ok" : "warn"}`}>
            {setuju ? `Kamu menyetujui ${me.akad_version} pada ${me.setuju_at ? new Date(me.setuju_at).toLocaleString("id-ID") : "-"}.` : `Kamu belum menyetujui versi ${AKAD_VERSION}. Buka Beranda untuk menyetujui.`}
          </div>
        )}
        <div className="panel">
          <h3 style={{ textAlign: "center" }}>{AKAD_JUDUL}</h3>
          <div className="doc">{AKAD_TEKS}</div>
        </div>
        <p className="muted"><small>Akad ini juga ditampilkan saat pendaftaran. Mencetak halaman ini: Ctrl+P, Save as PDF.</small></p>
      </div>
    </div>
  );
}
