// Util tanpa dependensi: CSV, tanggal Indonesia, template broadcast WA, acak tim.
// Isi sama persis dengan versi lama (lib/export.ts) — dipakai juga untuk CSV/WA yang
// sengaja TIDAK ikut aturan copy baru (lihat bagian 7 redesign.md).

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function today() { return new Date().toISOString().slice(0, 10); }

const ARK_MAPS_URL = "https://maps.app.goo.gl/DZ5LbXXY4qubp1Pm7";
const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function tanggalID(iso: string) {
  const d = new Date((iso || "") + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return `${HARI_ID[d.getDay()]}, ${d.getDate()} ${BULAN_ID[d.getMonth() + 1]} ${d.getFullYear()}`;
}
export function namaBulanID(key: string) {
  const [y, m] = (key || "").split("-");
  return `${BULAN_ID[parseInt(m)] || ""} ${y || ""}`.trim();
}

export function jamTitik(jam: string) { return (jam || "").replace(/:/g, "."); }

/** Template broadcast WA — format Bismillah (slot dinamis, MAPS ARK/Google). Teks tetap sama dengan versi lama. */
export function buildWAList(
  schedule: { tanggal: string; jam: string; lokasi: string; status?: string },
  slotCount: (posisi: string) => number,
  namesOf: (posisi: string) => string[],
) {
  const isArk = /ark/i.test(schedule.lokasi || "");
  const mapsUrl = isArk ? ARK_MAPS_URL : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.lokasi || "")}`;
  const mapsLine = schedule.lokasi ? mapsUrl : "-";

  const blokGK = (() => {
    const names = namesOf("GK");
    const n = slotCount("GK");
    let t = "";
    for (let i = 0; i < n; i++) t += `${i + 1}. ${names[i] || ""}\n`;
    return t.trimEnd();
  })();

  const blokPlayer = (() => {
    let t = "";
    (["Belakang", "Tengah", "Depan"] as const).forEach((p) => {
      const names = namesOf(p);
      const n = slotCount(p);
      t += `${p}\n`;
      for (let i = 0; i < n; i++) t += `${i + 1}. ${names[i] || ""}\n`;
    });
    return t.trimEnd();
  })();

  return `_Bismillah.._\n\n📣 *MUBA FC*\n_Present:_\n⚽ *FUN MINI SOCCER*\n🗓️ *${tanggalID(schedule.tanggal)}*\n⏰ *${jamTitik(schedule.jam)}*\n🏟️ *${schedule.lokasi}*\n📍 ${mapsLine}\n\n🏷️ HTM:\n👤 *25K*/Player\n(Join Member *90K* jatah main 4x)\n🥅 *15K*/Goal Keeper\n(Join Member *50k* jatah main 4x)\n\n⚠️ *NB*\n- Demi ketertiban & kenyamanan bersama mohon dapat mendaftar/join via Web Resmi *MUBA FC* serta melakukan pembayaran via Web\n\n*[Terlampir]*\n🌐 https://muba-fc.vercel.app/\n\n📌 *Update list skuad MUBA FC yang sudah join via WEB:*\n\n🥅 *Goal Keeper*\n${blokGK}\n\n👤 *Player*\n${blokPlayer}\n\n*(Ayo daftar slot terbatas!)*\n\n📔 MAIN & MATCH RULES ‼️\n- Bermain Sportif\n- Menutup Aurat (Legging/Celana 3/4, Celana Training)\n- TIDAK MEROKOK / VAPE 🚭\n- Datang ONTIME\n- Pakai Jersey MUBA FC atau kaos warna hitam\n\nSemoga Allah Ta'ala Mudahkan\nJazakumullahu Khairan Barakallahu Fiikum\n\n🖋️ *Official MUBA FC*`;
}

/** Acak peserta jadi 4 tim seimbang per posisi (dipakai di Roster jadwal reguler, bukan Liga — Liga assign manual). */
export function acakTim(peserta: { nama: string; posisi: string }[]): Record<string, { nama: string; posisi: string }[]> {
  const groups: Record<string, { nama: string; posisi: string }[]> = { GK: [], Belakang: [], Tengah: [], Depan: [] };
  peserta.forEach((p) => (groups[p.posisi] || groups["Depan"]).push(p));
  Object.values(groups).forEach((g) => {
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
  });
  const tim: Record<string, { nama: string; posisi: string }[]> = { A: [], B: [], C: [], D: [] };
  const keys = ["A", "B", "C", "D"];
  Object.values(groups).forEach((g) => g.forEach((p, i) => tim[keys[i % 4]].push(p)));
  return tim;
}
