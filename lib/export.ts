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
