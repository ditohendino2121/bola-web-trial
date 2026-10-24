// Ikon garis tebal, ujung persegi (bukan bulat) — ciri khas identitas MUBA FC.
const P = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "square" as const, strokeLinejoin: "miter" as const };

export type IconName = "home" | "cal" | "wallet" | "clip" | "chart" | "user" | "doc" | "phone" | "shield" | "menu" | "close" | "chevron" | "ball" | "boot";

export default function Icon({ name, ...rest }: { name: IconName } & React.SVGProps<SVGSVGElement>) {
  switch (name) {
    case "home": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M3 10L12 3l9 7v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4H9v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg>;
    case "cal": return <svg viewBox="0 0 24 24" {...P} {...rest}><rect x="3" y="4" width="18" height="16" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "wallet": return <svg viewBox="0 0 24 24" {...P} {...rest}><rect x="3" y="6" width="18" height="12" /><path d="M16 12h4M7 12h.01" /></svg>;
    case "clip": return <svg viewBox="0 0 24 24" {...P} {...rest}><rect x="8" y="3" width="8" height="4" /><rect x="5" y="7" width="14" height="14" /><path d="M9 13h6M9 17h6" /></svg>;
    case "chart": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M4 19V9M10 19V5M16 19v-8M20 19H2" /></svg>;
    case "user": return <svg viewBox="0 0 24 24" {...P} {...rest}><circle cx="12" cy="8" r="4" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>;
    case "doc": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M10 13h4M10 17h4M10 9h1" /></svg>;
    case "phone": return <svg viewBox="0 0 24 24" {...P} {...rest}><rect x="7" y="2" width="10" height="20" /><path d="M12 18h.01" /></svg>;
    case "shield": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7z" /><path d="M9 12l2 2 4-4" /></svg>;
    case "menu": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M3 6h18M3 12h18M3 18h18" /></svg>;
    case "close": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M5 5l14 14M19 5L5 19" /></svg>;
    case "chevron": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M9 6l6 6-6 6" /></svg>;
    case "ball": return <svg viewBox="0 0 24 24" {...P} {...rest}><circle cx="12" cy="12" r="9" /><path d="M12 7.5l3.5 2.5-1.3 4h-4.4l-1.3-4z" /><path d="M12 3v4.5M8.3 14l-3.6 2.6M15.7 14l3.6 2.6" /></svg>;
    case "boot": return <svg viewBox="0 0 24 24" {...P} {...rest}><path d="M6 3v7l-3.5 4.5V18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1c0-2.5-1.8-3.6-4.7-4.6L14 11V3z" /><path d="M6 9h5" /></svg>;
    default: return <svg viewBox="0 0 24 24" {...P} {...rest}><rect x="4" y="4" width="16" height="16" /></svg>;
  }
}

export const MENU: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Beranda", icon: "home" },
  { href: "/jadwal", label: "Jadwal main", icon: "cal" },
  { href: "/jadwal-liga", label: "Jadwal liga", icon: "cal" },
  { href: "/topup", label: "Top-up", icon: "wallet" },
  { href: "/liga", label: "Liga", icon: "clip" },
  { href: "/klasemen", label: "Klasemen", icon: "chart" },
  { href: "/dashboard", label: "Saya", icon: "user" },
  { href: "/akad", label: "Akad", icon: "doc" },
  { href: "/kontak", label: "Kontak", icon: "phone" },
  { href: "/admin", label: "Admin", icon: "shield" },
];
