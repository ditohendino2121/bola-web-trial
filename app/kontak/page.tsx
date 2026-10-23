"use client";
import { PageHead } from "../../components/ui";
import { CLUB_NAMA, CLUB_SUB, BASECAMP, MAPS_URL, KONTAKS } from "../../lib/club";

export default function Kontak() {
  const salin = (teks: string) => {
    const done = () => alert("Tersalin.");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(teks).then(done).catch(done);
    else prompt("Salin manual:", teks);
  };

  return (
    <div>
      <PageHead title="Kontak" desc={`Hubungi pengurus ${CLUB_NAMA} untuk daftar, izin, atau info jadwal.`} />
      <div className="page wrap">
        <div className="panel">
          <h3>Basecamp</h3>
          <p><b>{BASECAMP}</b></p>
          <div className="row">
            <a href={MAPS_URL} target="_blank" rel="noreferrer" style={{ flex: 1 }}><button className="btn block">Buka di Maps</button></a>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => salin(BASECAMP)}>Salin alamat</button>
          </div>
        </div>

        {KONTAKS.map((k) => (
          <div className="panel" key={k.hp}>
            <h3>{k.nama}</h3>
            <p style={{ fontSize: 20, fontWeight: 800 }}>{k.hp}</p>
            <div className="row">
              <a href={k.wa} target="_blank" rel="noreferrer" style={{ flex: 1 }}><button className="btn block">Chat WhatsApp</button></a>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => salin(k.hp)}>Salin nomor</button>
            </div>
          </div>
        ))}

        <p className="muted"><small>{CLUB_NAMA} &middot; {CLUB_SUB} &middot; main rutin tiap pekan.</small></p>
      </div>
    </div>
  );
}
