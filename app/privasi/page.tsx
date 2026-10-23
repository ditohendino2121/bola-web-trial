import { PageHead } from "../../components/ui";

export default function Privasi() {
  return (
    <div>
      <PageHead title="Kebijakan privasi" desc="Berlaku sejak September 2026 — versi 1.0." />
      <div className="page wrap">
        <div className="panel">
          <h3>Tentang MUBA FC</h3>
          <p className="muted">MUBA FC (Masjid Utsman Bin Affan) adalah komunitas futsal. Situs ini dipakai untuk pendaftaran, isi list jadwal, top-up kredit, dan liga internal KIM x DnA Health League.</p>

          <h3 style={{ marginTop: 16 }}>Data yang kami simpan</h3>
          <ul className="muted" style={{ paddingLeft: 18, margin: "6px 0" }}>
            <li>Nama lengkap, email, nomor WA (saat daftar)</li>
            <li>Status approve, membership, dan preferensi posisi (GK / Belakang / Tengah / Depan)</li>
            <li>Riwayat list main (RSVP), status lunas / wajib bayar, dan transaksi top-up</li>
            <li>Data liga (tim, hasil, nilai pemain)</li>
          </ul>
          <p className="muted">Password disimpan terenkripsi oleh Supabase Auth, admin tidak bisa melihat password.</p>

          <h3 style={{ marginTop: 16 }}>Untuk apa datanya</h3>
          <ul className="muted" style={{ paddingLeft: 18, margin: "6px 0" }}>
            <li>Approve akun, kelola kuota jadwal, dan catat kehadiran</li>
            <li>Catat saldo kredit (paket / reguler / GK) dan verifikasi top-up</li>
            <li>Tampilkan daftar pemain di jadwal dan hasil liga</li>
          </ul>

          <h3 style={{ marginTop: 16 }}>Tidak dibagikan ke pihak ketiga</h3>
          <p className="muted">Data tidak dijual, tidak untuk iklan, dan tidak dibagikan ke pihak luar kecuali untuk keperluan teknis (hosting Vercel, database Supabase). Daftar nama di jadwal/liga memang tampil ke anggota untuk keperluan list main.</p>

          <h3 style={{ marginTop: 16 }}>Penyimpanan dan penghapusan</h3>
          <p className="muted">Data disimpan di Supabase (region Singapore). Untuk keluar atau hapus data, hubungi admin, data akan dihapus atau dianonimkan. Wallet dan riwayat transaksi yang sudah lunas tetap disimpan untuk laporan keuangan.</p>

          <h3 style={{ marginTop: 16 }}>Kontak</h3>
          <p className="muted">Abu Faqih 081281186360, Irfan 081395771559.<br />Basecamp Tarasso Coffee, Jl. Adam Malik No. 58.</p>

          <div className="note info" style={{ marginTop: 16 }}>Dengan mendaftar dan mencentang akad, kamu menyetujui kebijakan ini. Update kebijakan akan diumumkan di situs.</div>
        </div>

        <div className="panel">
          <h3>Tanya soal data?</h3>
          <p className="muted">Chat admin di menu Kontak. Kami bantu hapus akun, koreksi nama/WA, atau ekspor datamu.</p>
        </div>
      </div>
    </div>
  );
}
