export default function OfflinePage() {
  return (
    <div className="card" style={{ textAlign: "center", padding: 28 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#1A1A1E", border: "1px solid var(--line)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA0A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><line x1="4" y1="4" x2="20" y2="20"/></svg>
      </div>
      <h2 style={{ margin: "8px 0 6px" }}>Kamu sedang offline</h2>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>Sinyal terputus. Halaman yang sudah pernah dibuka (jadwal, klasemen) tetap bisa dilihat dari cache. Untuk login, isi list, dan top-up, hubungkan internet lagi ya.</p>
      <a href="/"><button className="btn secondary" style={{ marginTop: 12 }}>Coba muat ulang</button></a>
      <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Basecamp: Tarasso Coffee Jl. Adam Malik No.58</p>
    </div>
  );
}
