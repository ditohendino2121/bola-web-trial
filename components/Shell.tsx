"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supa } from "../lib/supa";
import { BASECAMP } from "../lib/club";
import Icon, { MENU } from "./Icon";

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [kredit, setKredit] = useState<number | null>(null);
  const [nama, setNama] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sb = supa();
        const { data } = await sb.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) { if (active) { setKredit(null); setNama(""); } return; }
        const [p, w] = await Promise.all([
          sb.from("profiles").select("nama,is_member").eq("id", uid).maybeSingle(),
          sb.from("wallets").select("paket,reguler,paket_gk,reguler_gk").eq("user_id", uid).maybeSingle(),
        ]);
        if (!active) return;
        if (p.data) setNama(p.data.nama);
        if (w.data) setKredit((w.data.paket || 0) + (w.data.reguler || 0) + (w.data.paket_gk || 0) + (w.data.reguler_gk || 0));
      } catch { /* env belum diisi / offline — chip tetap "Masuk" */ }
    })();
    return () => { active = false; };
  }, [path]);

  useEffect(() => {
    try {
      const sb = supa();
      const { data: sub } = sb.auth.onAuthStateChange(() => setOpen(false));
      return () => sub.subscription.unsubscribe();
    } catch { /* env belum diisi / offline — jangan sampai nge-crash seluruh halaman */ }
  }, []);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { document.body.classList.toggle("nav-open", open); }, [open]);

  const loggedIn = kredit !== null;

  // Tampilan layar besar (proyektor) tampil polos tanpa masthead/footer/nav.
  if (path.endsWith("/layar")) return <main id="isi">{children}</main>;

  return (
    <>
      <a href="#isi" className="skip-link">Lewati ke isi</a>
      <header className="mast noprint">
        <div className="wrap mast-inner">
          <Link href="/" className="mast-brand">
            <img src="/logo-muba.jpg" alt="" />
            <div><b>MUBA FC</b><small>Masjid Utsman Bin Affan</small></div>
          </Link>
          <nav className="mast-nav" aria-label="Navigasi utama">
            {MENU.filter((m) => m.href !== "/dashboard").map((m) => (
              <Link key={m.href} href={m.href} aria-current={isActive(path, m.href) ? "page" : undefined}>{m.label}</Link>
            ))}
          </nav>
          {loggedIn ? (
            <Link href="/dashboard" className="mast-chip" aria-current={isActive(path, "/dashboard") ? "page" : undefined}><Icon name="user" width={16} height={16} /> {nama.split(" ")[0] || "Saya"}</Link>
          ) : (
            <Link href="/#akun" className="mast-chip ghost">Masuk</Link>
          )}
          <button className="mast-menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </header>
      <div className="goldrule noprint" />
      <div className="scrim noprint" onClick={() => setOpen(false)} />
      <div className="drawer noprint" aria-hidden={!open}>
        <div className="drawer-head">
          <div className="row" style={{ gap: 8 }}><img src="/logo-muba.jpg" alt="" style={{ width: 32, height: 32, borderRadius: 4 }} /><b>MUBA FC</b></div>
          <button className="iconbtn on-black" aria-label="Tutup menu" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <nav aria-label="Navigasi (drawer)">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} aria-current={isActive(path, m.href) ? "page" : undefined} onClick={() => setOpen(false)}>
              <Icon name={m.icon} /> {m.label}
            </Link>
          ))}
        </nav>
        <div className="drawer-account">
          {loggedIn ? <>{nama}<br /><b style={{ color: "var(--gold)" }}>{kredit} kredit</b></> : <>Belum login. <Link href="/#akun" style={{ color: "var(--gold)" }}>Daftar di beranda</Link>.</>}
        </div>
        <div className="drawer-basecamp">Basecamp<br />{BASECAMP}</div>
      </div>

      <main id="isi">{children}</main>

      <footer className="site-footer noprint">
        <div className="wrap">
          <div>
            <div className="brand-row"><img src="/logo-muba.jpg" alt="" /><b style={{ color: "var(--on-black)" }}>MUBA FC</b></div>
            <p style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{BASECAMP}</p>
          </div>
          <div>
            <h4>Main</h4>
            <Link href="/jadwal">Jadwal main</Link>
            <Link href="/topup">Top-up</Link>
            <Link href="/liga">Liga</Link>
            <Link href="/klasemen">Klasemen</Link>
          </div>
          <div>
            <h4>Pengurus</h4>
            <Link href="/kontak">Kontak &amp; WhatsApp</Link>
            <Link href="/akad">Akad membership</Link>
            <Link href="/privasi">Kebijakan privasi</Link>
          </div>
        </div>
        <div className="legal">© {new Date().getFullYear()} MUBA FC — komunitas futsal masjid.</div>
      </footer>

      <nav className="bottomnav noprint" aria-label="Navigasi bawah">
        <Link href="/" aria-current={path === "/" ? "page" : undefined}><Icon name="home" />Beranda</Link>
        <Link href="/jadwal" aria-current={isActive(path, "/jadwal") ? "page" : undefined}><Icon name="cal" />Jadwal</Link>
        <Link href="/topup" className="center"><Icon name="wallet" />Top-up</Link>
        <Link href="/jadwal-liga" aria-current={isActive(path, "/jadwal-liga") || isActive(path, "/liga") ? "page" : undefined}><Icon name="clip" />Jadwal liga</Link>
        <Link href="/klasemen" aria-current={isActive(path, "/klasemen") ? "page" : undefined}><Icon name="chart" />Klasemen</Link>
        <Link href="/dashboard" aria-current={isActive(path, "/dashboard") ? "page" : undefined}><Icon name="user" />Saya</Link>
      </nav>
    </>
  );
}
