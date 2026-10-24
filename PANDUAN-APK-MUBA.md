# Panduan aplikasi MUBA FC (PWA & APK)

Web `https://muba-fc.vercel.app` sudah berupa PWA: bisa dipasang di layar utama HP dan dibuka seperti aplikasi.
Isinya selalu sama dengan web — tiap deploy ke Vercel, aplikasi ikut ter-update (tidak perlu pasang ulang).

## Yang sudah ada
- `public/manifest.webmanifest` — nama, ikon (192, 512, maskable), warna hitam, shortcut Jadwal main / Jadwal liga / Klasemen / Top-up.
- Service worker (`@ducanh2912/next-pwa`, dibuat otomatis saat build) — halaman `/offline` saat sinyal putus;
  data Supabase tidak di-cache (selalu data terbaru); versi baru langsung aktif tiap deploy (`skipWaiting` + `clientsClaim`).
- Tombol **Pasang aplikasi MUBA FC** di beranda: 1 klik di Android/Chrome, petunjuk di iPhone. Hilang otomatis kalau sudah terpasang.

## Cara pasang (pemain)
- **Android (Chrome):** buka web → ketuk **Pasang** di beranda (atau menu titik tiga → *Instal aplikasi* / *Tambahkan ke layar utama*).
- **iPhone (Safari):** buka web → tombol **Share** → **Add to Home Screen**.
- Login pakai akun yang sama dengan web.

## Kalau mau file APK (Android, gratis, tanpa Play Store)
APK ini cuma "bungkus" web yang sama, jadi tetap ikut update otomatis.

1. Buka **https://www.pwabuilder.com** → masukkan `https://muba-fc.vercel.app` → *Start*.
2. Pilih **Package for stores → Android** → *Generate Package*.
3. Isi: Package ID `id.mubafc.app`, App name `MUBA FC`, versi `1.0.0`. Pilih **Signing key: new** (simpan file key + password-nya baik-baik, dibutuhkan untuk update APK nanti).
4. Download zip → ambil file `.apk` di dalamnya.
5. Upload ke Google Drive (akses: siapa saja yang punya link) → bagikan link di grup WA.

Di HP pemain: buka link → download → izinkan *install dari sumber tidak dikenal* → Install.
APK baru hanya perlu dibuat ulang kalau ganti nama/ikon aplikasi.

## Kalau mau masuk Play Store (opsional)
Sama seperti di atas tapi pilih format **AAB**, daftar Google Play Console (biaya sekali US$25), isi Data Safety mengacu ke halaman `/privasi`.
