export const CLUB_NAMA = "MUBA FC";
export const CLUB_SUB = "Masjid Utsman Bin Affan";
export const BASECAMP = "Tarasso Coffee, Jl. Adam Malik No. 58, Kreo Selatan, Larangan, Tangerang";
export const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(BASECAMP);

export interface Kontak { nama: string; hp: string; wa: string; }
export const KONTAKS: Kontak[] = [
  { nama: "Abu Faqih", hp: "081281186360", wa: "https://wa.me/6281281186360?text=" + encodeURIComponent("Assalamu'alaikum, mau tanya soal MUBA FC") },
  { nama: "Irfan", hp: "081395771559", wa: "https://wa.me/6281395771559?text=" + encodeURIComponent("Assalamu'alaikum, mau tanya soal MUBA FC") },
];

export const JENIS_PENGELUARAN = ["Sewa Lapangan", "Makanan dan Minuman", "Transportasi", "Bank Fee"] as const;
export type JenisPengeluaran = (typeof JENIS_PENGELUARAN)[number];

export interface Expense { id: string; tanggal: string; jenis: string; keterangan: string; nominal: number; }
export interface ManualIncome { id: string; tanggal: string; sumber: string; keterangan: string; nominal: number; }
