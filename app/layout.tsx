"use client";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supa } from "../lib/supabase";
import { BASECAMP } from "../lib/club";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

const menu = [
  { href: "/", label: "Beranda", ico: "🏠" },
  { href: "/jadwal", label: "Jadwal Main", ico: "📅" },
  { href: "/topup", label: "Top-Up", ico: "💳" },
  { href: "/liga", label: "Registrasi MUBA League KIM x DnA", ico: "📝" },
  { href: "/klasemen", label: "Klasemen Liga", ico: "🏆" },
  { href: "/dashboard", label: "Saya", ico: "👤" },
  { href: "/akad", label: "Akad", ico: "📜" },
  { href: "/kontak", label: "Kontak", ico: "📞" },
  { href: "/admin", label: "Admin", ico: "🛠️" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [kredit, setKredit] = useState<number | null>(null);
  const [nama, setNama] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = supa();
        const { data } = await sb.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) { setKredit(null); setNama(""); return; }
        const [p, w] = await Promise.all([
          sb.from("profiles").select("nama,is_member").eq("id", uid).maybeSingle(),
          sb.from("wallets").select("paket,reguler").eq("user_id", uid).maybeSingle(),
        ]);
        if (p.data) setNama(p.data.nama + (p.data.is_member ? " ⭐" : ""));
        if (w.data) setKredit((w.data.paket || 0) + (w.data.reguler || 0));
      } catch { /* env belum diisi / offline */ }
    })();
  }, [path]);

  const close = () => { if (typeof document !== "undefined") document.body.classList.remove("nav-open"); };

  return (
    <div className="shell">
      <div className="scrim" onClick={close} />
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo-muba.jpg" alt="Logo MUBA FC" className="logo" />
          <div><b>MUBA FC</b><small>Masjid Utsman Bin Affan</small></div>
        </div>
        <nav className="snav">
          {menu.map((m) => (
            <Link key={m.href} href={m.href} onClick={close} className={path === m.href ? "on" : ""}>
              <span>{m.ico}</span> {m.label}
            </Link>
          ))}
        </nav>
        <div className="saldo-mini">
          {kredit !== null ? (<><small>{nama}</small><b>{kredit} kredit</b><small>1 kredit = 1x main</small></>) : (<small>Belum login.<br />Daftar di Beranda.</small>)}
        </div>
        <div className="basecamp-mini">📍 Basecamp:<br />{BASECAMP}</div>
      </aside>
      <div className="main">
        <div className="topstrip">
          <button className="burger" onClick={() => document.body.classList.toggle("nav-open")}>☰</button>
          <img src="/logo-muba.jpg" alt="MUBA FC" />
          <b>MUBA FC</b>
          {kredit !== null && <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>{kredit} kredit</span>}
        </div>
        <div className="container">{children}</div>
      </div>
    </div>
  );
}
