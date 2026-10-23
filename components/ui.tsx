"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadAll, type DB } from "../lib/data";
import Icon from "./Icon";

/** Satu titik muat data: loadAll() + loading/error/reload, dipakai semua halaman. */
export function useDB() {
  const [db, setDb] = useState<DB | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    setError("");
    return loadAll().then(setDb).catch((e: any) => setError(e?.message || String(e)));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { db, error, reload, setDb };
}

export function PageHead({ title, desc, crumbs, actions, tabs }: {
  title: string; desc?: string; crumbs?: { href: string; label: string }[]; actions?: React.ReactNode; tabs?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="wrap">
        {crumbs && crumbs.length > 0 && (
          <div className="crumbs">{crumbs.map((c, i) => (<span key={c.href}>{i > 0 && " / "}<a href={c.href}>{c.label}</a></span>))}</div>
        )}
        <h1>{title}</h1>
        {desc && <p className="desc">{desc}</p>}
        {actions && <div className="actions">{actions}</div>}
        {tabs}
      </div>
    </div>
  );
}

export function Tabs({ items, value, onChange, label, light }: {
  items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; label: string; light?: boolean;
}) {
  return (
    <div className={`tabs${light ? " light" : ""}`} role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} role="tab" aria-selected={value === it.key} onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </div>
  );
}

export function Loading({ what }: { what?: string }) {
  return (
    <div className="panel" role="status">
      <div className="row"><span className="spinner" aria-hidden="true" /> Memuat {what || "data"}...</div>
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const envIssue = /env.*belum diisi|SUPABASE/i.test(message);
  return (
    <div className="panel">
      <div className="note err" role="status">{message}</div>
      {envIssue ? (
        <p className="muted" style={{ marginTop: 8 }}><small>Isi env <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di Vercel (atau <code>.env.local</code> untuk lokal).</small></p>
      ) : onRetry ? (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={onRetry}>Coba lagi</button>
      ) : null}
    </div>
  );
}

export function Empty({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="empty"><b>{title}</b>{action}</div>;
}

export function StatusPill({ status, sisa }: { status: string; sisa?: number }) {
  if (status === "buka") return sisa !== undefined && sisa <= 0 ? <span className="pill bad">Penuh</span> : <span className="pill ok">Buka</span>;
  if (status === "tutup") return <span className="pill neutral">Tutup</span>;
  if (status === "full_booked") return <span className="pill bad">Full booked</span>;
  if (status === "sparing") return <span className="pill info">Sparing (14)</span>;
  return <span className="pill neutral">{status}</span>;
}

export function Meter({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  const full = filled >= total;
  return (
    <div>
      <div className={`meter${full ? " full" : ""}`} role="meter" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={total} aria-label={`${filled} dari ${total} terisi`}>
        <i style={{ width: pct + "%" }} />
      </div>
      <small className="muted">{filled}/{total} terisi, sisa {Math.max(0, total - filled)}</small>
    </div>
  );
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function DateBox({ iso }: { iso: string }) {
  const d = new Date((iso || "") + "T00:00:00");
  const ok = !isNaN(d.getTime());
  return (
    <div className="datebox">
      <div className="day">{ok ? HARI[d.getDay()] : "-"}</div>
      <div className="num">{ok ? String(d.getDate()).padStart(2, "0") : "--"}</div>
      <div className="mon">{ok ? BULAN[d.getMonth() + 1] : ""}</div>
    </div>
  );
}

/** Perisai bersudut ala crest MUBA, huruf tim di tengah. Penanda, bukan logo resmi tim. */
export function Crest({ team, size = "md" }: { team: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`crest sz-${size} team-${team}`} role="img" aria-label={`Tim ${team}`}>{team}</span>;
}

const FORM_LABEL: Record<string, string> = { W: "menang", D: "seri", L: "kalah" };
export function FormGuide({ results }: { results: ("W" | "D" | "L")[] }) {
  const label = results.length ? results.map((r) => FORM_LABEL[r]).join(", ") : "belum ada data";
  return (
    <span className="formguide" aria-label={`Form 5 laga terakhir: ${label}`}>
      {results.map((r, i) => <i key={i} className={r} aria-hidden="true">{r}</i>)}
    </span>
  );
}

export function Initial({ name }: { name: string }) {
  return <span className="initial" aria-hidden="true">{(name || "?").trim().slice(0, 1).toUpperCase()}</span>;
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus?.();
    };
  }, []);
  return (
    <div className="dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button ref={closeRef} className="iconbtn" aria-label="Tutup" onClick={() => onCloseRef.current()}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
