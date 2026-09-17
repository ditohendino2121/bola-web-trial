// Helper export CSV + acak tim (tanpa library, gratis)

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
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

export function jamTitik(jam: string) { return (jam || "").replace(/:/g, "."); }

/** Template broadcast WA list squad MUBA FC (verbatim + slot dinamis). */
export function buildWAList(
  schedule: { tanggal: string; jam: string; lokasi: string; status?: string },
 slotCount: (posisi: string) => number,
  namesOf: (posisi: string) => string[],
) {
  const isArk = /ark/i.test(schedule.lokasi || "");
  const mapsLine = isArk ? `\n🌐 "${ARK_MAPS_URL}"\n` : "";
  const posisiUrutan = ["GK", "Belakang", "Tengah", "Depan"];
  const totalMaks = slotCount("GK") + slotCount("Belakang") + slotCount("Tengah") + slotCount("Depan");

  const blokGK = (() => {
    const names = namesOf("GK");
    const n = slotCount("GK");
    let t = "🥅_LIST GK_\n\n";
    for (let i = 0; i < n; i++) t += `${i + 1}.${names[i] ? " " + names[i] : ""}\n`;
    return t;
  })();

  const blokPemain = (() => {
    let t = "⚽️_LIST PEMAIN_ \n";
    (["Belakang", "Tengah", "Depan"] as const).forEach((p) => {
      const names = namesOf(p);
      const n = slotCount(p);
      t += `${p}\n`;
      for (let i = 0; i < n; i++) t += `  ${i + 1}.${names[i] ? " " + names[i] : ""}\n`;
    });
    return t;
  })();

  return (
`🔰🔰🔰🔰🔰🔰🔰🔰
    MUBA FC FUN
🔰🔰🔰🔰🔰🔰🔰🔰
      FUN MINI SOCCER
🔰🔰🔰🔰🔰🔰🔰🔰

Berlokasi Di :
🏟️ *${schedule.lokasi}*
${mapsLine}
🔅🔅🔅🔅🔅🔅🔅🔅
🗓️ *${tanggalID(schedule.tanggal)}*
⏰ *${jamTitik(schedule.jam)}*
🔅🔅🔅🔅🔅🔅🔅🔅

🔸️🔹️🔸️🔹️🔸️🔹️🔸️🔹️
    🏷️ HTM: *25K* / player (MEMEBER 90K utk 4x main)
                     *15K* / Kiper (memeber 50k utk 4x main)


🔹️🔸️🔹️🔸️🔹️🔸️🔹️🔸️

Bismillah, Dengan Semangat ✊
 #KitaKuatKarenaKitaPatungan
- Mohon Langsung Bayar HTM (By Cash/Transfer)
- Mohon Bayar HTM Dengan Uang Pas
- Teman Boleh Ikut Join Main

💳 Atau Transfer ke :
BCA Syariah
No rek 036.000. 7496
a.n Muhamad Ali Sodiqin  (*Abu Faqih*)
👉🏻 Konfirmasi Transfer & Informasi wa.me/6281281186360 (*Abu Faqih*)

Benefit :
⚽️ : Menambah saudara ✅
🥤 : Minum + Snack ✅
🩺 : P3K ✅
〰️〰️〰️〰️〰️〰️〰️〰️
*🛡MUBA FC LIST SQUAD🛡
〰️〰️〰️〰️〰️〰️〰️〰️
${blokGK}
${blokPemain}
(Maksimal ${totalMaks} ya)


📔 MAIN & MATCH RULES ‼️
- Bermain sportif
- Menutup Aurat (legging/celana 3/4, celana training)
- TIDAK MEROKOK / VAPE 🚭
- Datang ONTIME
- Pakai Jersey MUBA FC atau kaos warna hitam

Semoga Allah Subhanahu wa Ta'ala mudahkan, Aamiin.
Jazakumullahu Khairan. Barakallahu Fiik.

*MUBA FC*
_Ikhtiar Sehat Menjalin Ukhuwah_
#AdabDuluanSkillBelakangan
_List Aja Dulu Curhat Belakangan_
#KitaKuatKarenaKitaPatungan`
  );
}

/** Acak 28 pemain jadi 4 tim seimbang per posisi */
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
