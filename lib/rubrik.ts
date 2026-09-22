// Rubrik v1 MUBA FC — base 6.0, clamp 3.0-10.0, 1 desimal
// Assist +0.5 semua posisi, blunder maks total -1, aksi kunci 3 jenis, override ±0.5 wajib catatan

export type Kartu = "tidak" | "kuning" | "merah";
export type PosisiRB = "GK" | "Belakang" | "Tengah" | "Depan";

export interface InputRB {
  posisi: PosisiRB;
  gol: number;
  assist: number;
  aksi_kunci: number; // save untuk GK, tekel untuk Belakang/Tengah
  shot_on_target: number; // untuk Belakang/Tengah/Depan
  kartu: Kartu;
  blunder: number;
  kebobolan: number; // oto dari skor (GK & Belakang saja)
  cleanSheet: boolean; // oto dari skor
}

export interface HasilRB {
  nilai_oto: number;
  breakdown: string;
}

export function hitungNilaiOto(inp: InputRB): HasilRB {
  let nilai = 6.0;
  const parts: string[] = ["6.0 base"];

  // Gol
  const golBobot: Record<PosisiRB, number> = { GK: 0.5, Belakang: 1.0, Tengah: 1.0, Depan: 1.2 };
  if (inp.gol > 0) {
    const add = inp.gol * golBobot[inp.posisi];
    nilai += add;
    parts.push(`+${add.toFixed(1)} gol x${inp.gol}`);
  }
  // Assist +0.5 semua
  if (inp.assist > 0) {
    const add = inp.assist * 0.5;
    nilai += add;
    parts.push(`+${add.toFixed(1)} assist x${inp.assist}`);
  }
  // Aksi kunci by posisi
  if (inp.posisi === "GK") {
    const add = Math.min(inp.aksi_kunci * 0.4, 2.0);
    if (add > 0) { nilai += add; parts.push(`+${add.toFixed(1)} save x${inp.aksi_kunci}`); }
  } else if (inp.posisi === "Belakang") {
    const addTekel = Math.min(inp.aksi_kunci * 0.4, 2.0);
    if (addTekel > 0) { nilai += addTekel; parts.push(`+${addTekel.toFixed(1)} tekel x${inp.aksi_kunci}`); }
    const addShot = Math.min(inp.shot_on_target * 0.2, 1.0);
    if (addShot > 0) { nilai += addShot; parts.push(`+${addShot.toFixed(1)} SoT x${inp.shot_on_target}`); }
  } else if (inp.posisi === "Tengah") {
    const addTekel = Math.min(inp.aksi_kunci * 0.2, 1.0);
    if (addTekel > 0) { nilai += addTekel; parts.push(`+${addTekel.toFixed(1)} tekel x${inp.aksi_kunci}`); }
    const addShot = Math.min(inp.shot_on_target * 0.2, 1.0);
    if (addShot > 0) { nilai += addShot; parts.push(`+${addShot.toFixed(1)} SoT x${inp.shot_on_target}`); }
  } else if (inp.posisi === "Depan") {
    const addShot = Math.min(inp.shot_on_target * 0.2, 1.0);
    if (addShot > 0) { nilai += addShot; parts.push(`+${addShot.toFixed(1)} SoT x${inp.shot_on_target}`); }
  }

  // Clean sheet oto
  if (inp.cleanSheet) {
    const add = inp.posisi === "GK" ? 1.5 : inp.posisi === "Belakang" ? 1.0 : inp.posisi === "Tengah" ? 0.5 : 0;
    if (add > 0) { nilai += add; parts.push(`+${add.toFixed(1)} clean sheet`); }
  }
  // Kebobolan
  if (inp.posisi === "GK" && inp.kebobolan > 0) {
    const dec = Math.min(inp.kebobolan * 0.3, 1.5);
    nilai -= dec;
    parts.push(`-${dec.toFixed(1)} kebobolan x${inp.kebobolan}`);
  }
  if (inp.posisi === "Belakang" && inp.kebobolan > 0) {
    const dec = Math.min(inp.kebobolan * 0.2, 1.0);
    nilai -= dec;
    parts.push(`-${dec.toFixed(1)} kebobolan x${inp.kebobolan}`);
  }
  // Kartu
  if (inp.kartu === "kuning") { nilai -= 0.5; parts.push("-0.5 kuning"); }
  if (inp.kartu === "merah") { nilai -= 1.5; parts.push("-1.5 merah"); }
  // Blunder maks total -1
  if (inp.blunder > 0) {
    const dec = Math.min(inp.blunder * 1.0, 1.0);
    nilai -= dec;
    parts.push(`-${dec.toFixed(1)} blunder x${inp.blunder}`);
  }

  // Clamp
  nilai = Math.max(3.0, Math.min(10.0, nilai));
  nilai = Math.round(nilai * 10) / 10;
  return { nilai_oto: nilai, breakdown: parts.join(" | ") };
}

export function clampOverride(nilaiOto: number, override?: number | null): number | null {
  if (override === null || override === undefined) return null;
  const v = Math.max(-0.5, Math.min(0.5, override));
  const final = Math.max(3.0, Math.min(10.0, nilaiOto + v));
  return Math.round(final * 10) / 10;
}

export function finalNilai(nilaiOto: number, override?: number | null): number {
  const c = clampOverride(nilaiOto, override);
  return c ?? nilaiOto;
}
