"use client";
import { CLUB_NAMA, CLUB_SUB, BASECAMP, MAPS_URL, KONTAKS } from "../../lib/club";

export default function Kontak() {
  const salin = (teks: string) => {
    const done = () => alert("Tersalin ✅");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(teks).then(done).catch(done);
    else { prompt("Copy manual:", teks); }
  };

  return (
    <div>
      <h2 style={{ margin: "4px 0" }}>📞 Contact Us</h2>
      <p className="muted">Hubungi pengurus {CLUB_NAMA} untuk daftar, izin, atau info jadwal.</p>

      <div className="card">
        <h3>📍 Basecamp</h3>
        <p><b>{BASECAMP}</b></p>
        <div className="row">
          <a href={MAPS_URL} target="_blank" rel="noreferrer" style={{ flex: 1 }}><button className="btn">🗺️ Buka di Maps</button></a>
          <button className="btn secondary" style={{ flex: 1 }} onClick={() => salin(BASECAMP)}>📋 Salin Alamat</button>
        </div>
      </div>

      {KONTAKS.map((k) => (
        <div className="card" key={k.hp}>
          <h3>👤 {k.nama}</h3>
          <p style={{ fontSize: 20 }}><b>{k.hp}</b></p>
          <div className="row">
            <a href={k.wa} target="_blank" rel="noreferrer" style={{ flex: 1 }}><button className="btn">💬 Chat WA</button></a>
            <button className="btn secondary" style={{ flex: 1 }} onClick={() => salin(k.hp)}>📋 Salin Nomor</button>
          </div>
        </div>
      ))}

      <div className="card">
        <p className="muted"><small>{CLUB_NAMA} • {CLUB_SUB} • Main rutin tiap pekan ⚽</small></p>
      </div>
    </div>
  );
}
