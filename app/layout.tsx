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
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0E0E10" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MUBA FC" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/icon-192.png" />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

function Ico({ n }: { n: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (n) {
    case "home": return <svg viewBox="0 0 24 24" {...p}><path d="M3 10L12 3l9 7v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4H9v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg>;
    case "cal": return <svg viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "wallet": return <svg viewBox="0 0 24 24" {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M16 12h4M7 12h.01" /></svg>;
    case "clip": return <svg viewBox="0 0 24 24" {...p}><rect x="8" y="3" width="8" height="4" rx="1" /><rect x="5" y="7" width="14" height="14" rx="2" /><path d="M9 13h6M9 17h6" /></svg>;
    case "chart": return <svg viewBox="0 0 24 24" {...p}><path d="M4 19V9M10 19V5M16 19v-8M20 19H2" /></svg>;
    case "user": return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="8" r="4" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>;
    case "doc": return <svg viewBox="0 0 24 24" {...p}><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M10 13h4M10 17h4M10 9h1" /></svg>;
    case "phone": return <svg viewBox="0 0 24 24" {...p}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M12 18h.01" /></svg>;
    case "shield": return <svg viewBox="0 0 24 24" {...p}><path d="M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7z" /><path d="M9 12l2 2 4-4" /></svg>;
    default: return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

const menu = [
  { href: "/", label: "Beranda", icon: "home" },
  { href: "/jadwal", label: "Jadwal Main", icon: "cal" },
  { href: "/topup", label: "Top-Up", icon: "wallet" },
  { href: "/liga", label: "Registrasi KIM x DnA Health League", icon: "clip" },
  { href: "/klasemen", label: "Klasemen KIM x DnA Health League", icon: "chart" },
  { href: "/dashboard", label: "Saya", icon: "user" },
  { href: "/akad", label: "Akad", icon: "doc" },
  { href: "/kontak", label: "Kontak", icon: "phone" },
  { href: "/admin", label: "Admin", icon: "shield" },
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
        if (p.data) setNama(p.data.nama + (p.data.is_member ? " · Member" : ""));
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
              <Ico n={m.icon} /> {m.label}
            </Link>
          ))}
        </nav>
        <div className="saldo-mini">
          {kredit !== null ? (<><small>{nama}</small><b>{kredit} kredit</b><small>1 kredit = 1x main</small></>) : (<small>Belum login.<br />Daftar di Beranda.</small>)}
        </div>
        <div className="basecamp-mini">Basecamp<br />{BASECAMP}</div>
      </aside>
      <div className="main">
        <div className="topstrip">
          <button className="burger" onClick={() => document.body.classList.toggle("nav-open")} aria-label="Menu">☰</button>
          <img src="/logo-muba.jpg" alt="MUBA FC" />
          <b>MUBA FC</b>
          {kredit !== null && <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{kredit} kredit</span>}
        </div>
        <div className="container">{children}</div>
        <nav className="bottomnav" aria-label="Navigasi bawah">
          <Link href="/" className={path === "/" ? "on" : ""}><Ico n="home" />Beranda</Link>
          <Link href="/jadwal" className={path === "/jadwal" ? "on" : ""}><Ico n="cal" />Jadwal</Link>
          <Link href="/topup" className="center"><Ico n="wallet" />Top-Up</Link>
          <Link href="/liga" className={path === "/liga" ? "on" : ""}><Ico n="clip" />Liga</Link>
          <Link href="/dashboard" className={path === "/dashboard" ? "on" : ""}><Ico n="user" />Saya</Link>
        </nav>
      </div>
    </div>
  );
}
