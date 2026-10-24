"use client";
import { useEffect, useState } from "react";

const KUNCI_TUTUP = "muba-install-ditutup";

/** Ajakan pasang PWA: tombol 1 klik di Android/Chrome, petunjuk Share -> Add to Home Screen di iPhone.
    Tidak tampil kalau sudah terpasang (mode standalone) atau sudah ditutup pengguna. */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    let ditutup = false;
    try { ditutup = localStorage.getItem(KUNCI_TUTUP) === "1"; } catch { /* storage diblokir */ }
    if (standalone || ditutup) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setTampil(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e); setTampil(true); };
    const onInstalled = () => setTampil(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!tampil) return null;
  const tutup = () => { setTampil(false); try { localStorage.setItem(KUNCI_TUTUP, "1"); } catch { /* abaikan */ } };
  const pasang = async () => {
    if (!prompt) return;
    prompt.prompt();
    const hasil = await prompt.userChoice.catch(() => null);
    if (hasil?.outcome === "accepted") setTampil(false);
    setPrompt(null);
  };

  return (
    <div className="panel install-app">
      <img src="/icon-192.png" alt="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>Pasang aplikasi MUBA FC</b>
        {ios
          ? <p className="muted" style={{ margin: "2px 0 0" }}><small>Di Safari: ketuk tombol <b>Share</b> (kotak panah ke atas), lalu <b>Add to Home Screen</b>.</small></p>
          : <p className="muted" style={{ margin: "2px 0 0" }}><small>Buka lebih cepat dari layar utama HP, tanpa ketik alamat web.</small></p>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {!ios && prompt && <button className="btn sm" onClick={pasang}>Pasang</button>}
        <button className="btn ghost sm" onClick={tutup} aria-label="Tutup ajakan pasang aplikasi">Nanti</button>
      </div>
    </div>
  );
}
