"use client";
import { useEffect, useState } from "react";

const KUNCI_TUTUP = "muba-install-ditutup";

// Event beforeinstallprompt cuma muncul sekali per halaman, jadi disimpan di level modul supaya
// banner atas dan tombol footer bisa sama-sama memakainya.
let deferred: any = null;
const pendengar = new Set<() => void>();
const kabari = () => pendengar.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; kabari(); });
  window.addEventListener("appinstalled", () => { deferred = null; kabari(); });
}

function usePasang() {
  const [, paksa] = useState(0);
  const [info, setInfo] = useState({ standalone: false, ios: false, siap: false });
  useEffect(() => {
    const f = () => paksa((n) => n + 1);
    pendengar.add(f);
    setInfo({
      standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true,
      ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
      siap: true,
    });
    return () => { pendengar.delete(f); };
  }, []);
  const pasang = async () => {
    if (!deferred) return false;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null; kabari();
    return true;
  };
  return { ...info, bisaPrompt: !!deferred, pasang };
}

const PETUNJUK_IOS = <>Di Safari: ketuk tombol <b>Share</b> (kotak panah ke atas), lalu <b>Add to Home Screen</b>.</>;
const PETUNJUK_UMUM = <>Buka menu browser (titik tiga), lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</>;

/** Banner atas di beranda: hilang kalau sudah terpasang atau ditutup ("Nanti"). */
export default function InstallApp() {
  const { standalone, ios, siap, bisaPrompt, pasang } = usePasang();
  const [ditutup, setDitutup] = useState(true);
  useEffect(() => { try { setDitutup(localStorage.getItem(KUNCI_TUTUP) === "1"); } catch { setDitutup(false); } }, []);

  if (!siap || standalone || ditutup || (!ios && !bisaPrompt)) return null;
  const tutup = () => { setDitutup(true); try { localStorage.setItem(KUNCI_TUTUP, "1"); } catch { /* abaikan */ } };

  return (
    <div className="panel install-app">
      <img src="/icon-192.png" alt="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>Pasang aplikasi MUBA FC</b>
        <p className="muted" style={{ margin: "2px 0 0" }}><small>{ios ? PETUNJUK_IOS : "Buka lebih cepat dari layar utama HP, tanpa ketik alamat web."}</small></p>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {!ios && bisaPrompt && <button className="btn sm" onClick={pasang}>Pasang</button>}
        <button className="btn ghost sm" onClick={tutup} aria-label="Tutup ajakan pasang aplikasi">Nanti</button>
      </div>
    </div>
  );
}

/** Tombol tetap di footer: selalu ada di web; disembunyikan hanya di dalam aplikasi yang sudah terpasang. */
export function InstallFooter() {
  const { standalone, ios, siap, bisaPrompt, pasang } = usePasang();
  const [bantuan, setBantuan] = useState(false);
  if (!siap || standalone) return null;
  const klik = async () => { if (!(await pasang())) setBantuan((v) => !v); };
  return (
    <div className="install-footer">
      <button className="btn sm" onClick={klik}><img src="/icon-192.png" alt="" /> Download aplikasi MUBA FC</button>
      {bantuan && !bisaPrompt && <p>{ios ? PETUNJUK_IOS : PETUNJUK_UMUM}</p>}
    </div>
  );
}
