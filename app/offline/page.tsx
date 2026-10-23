import Icon from "../../components/Icon";

export default function OfflinePage() {
  return (
    <div className="page wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="panel" style={{ textAlign: "center", padding: 32 }}>
        <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
          <Icon name="close" style={{ color: "var(--ink-3)" }} />
        </div>
        <h2 style={{ margin: "0 0 6px" }}>Kamu sedang offline</h2>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>Sinyal terputus. Halaman yang sudah pernah dibuka (jadwal, klasemen) tetap bisa dilihat dari cache. Untuk login, isi list, dan top-up, hubungkan internet lagi.</p>
        <a href="/"><button className="btn ghost" style={{ marginTop: 14 }}>Coba muat ulang</button></a>
        <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>Basecamp: Tarasso Coffee, Jl. Adam Malik No. 58</p>
      </div>
    </div>
  );
}
