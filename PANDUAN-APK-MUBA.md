# PANDUAN APK MUBA FC — Tampilan Baru GoPay x Hitam-Gold

## Apa yang sudah jadi
- **Redesign**: Emoji dihapus total, diganti ikon line tipis (GoPay style). Hero, card, sidebar, harga, jadwal dibikin bersih + banyak ruang putih. Warna tetap hitam (#0E0E10) + gold (#D4AF37).
- **Menu baru tanpa emoji**: Beranda, Jadwal Main, Top-Up, Registrasi/Klasemen Liga, Saya, Akad, Kontak, Admin — pakai ikon SVG 18px.
- **PWA siap**: `manifest.webmanifest`, `icon-192/512 + maskable + apple-touch-icon`, `sw.js` (Workbox), halaman `/offline`, halaman `/privasi` buat syarat APK.
- **Build OK**: Next 14.2.5 + @ducanh2912/next-pwa, fallback document /offline, Supabase di NetworkOnly (tidak di-cache).

## Cara jadi APK via WA (Rp 0, tanpa Play Store)
Tetap terhubung ke web yang sama (muba-fc.vercel.app). APK = browser tanpa address bar.

1. Pastikan web sudah deploy di Vercel (commit terbaru sudah include manifest + sw).
2. Buka **PWABuilder.com** > masukkan `https://muba-fc.vercel.app` > Analyze.
3. Pilih **Android Package** > Package ID `id.or.mubafc.app`, App name `MUBA FC`, Version 1.0.0.
4. Pilih format **APK** (bukan AAB) > Generate > Download.
5. Simpan `MUBA-FC-v1.apk` (~6-10 MB) > upload ke **Google Drive** > set Anyone with link.
6. Share di Grup WA MUBA + QR di basecamp Tarasso Coffee. Teks WA:
   > MUBA FC sekarang ada aplikasi! Install APK ini (Android): [link Drive] — login pakai akun yang sama. iPhone tetap pakai web. Jika muncul “File mungkin berbahaya”, klik Tetap install. Ada masalah chat Abu Faqih.

### Install di HP pemain
Klik link > Download > Buka file > Izinkan “Install dari sumber tak dikenal” > Install > ikon MUBA FC muncul. Login sama seperti web.

### Update
Kalau ubah web di Vercel, APK ikut update otomatis (tidak perlu APK baru). Buat APK baru hanya kalau ganti ikon/nama/version atau update push.

## Next step opsional
- Pasang OneSignal (saran) untuk push jadwal/approve/kocok — gratis <10k user.
- Kalau mau naik Play Store, file sama tapi pilih format AAB + daftar Play Console ($25) + isi Data Safety pakai halaman /privasi ini.
- Lombakan screenshot hitam-gold untuk feature graphic Play Store (1024x500).

## File yang diubah
- `app/globals.css` (baru full GoPay clean)
- `app/layout.tsx` (ikon SVG + head manifest/theme)
- `app/page.tsx` (hero + pricing tanpa emoji)
- `app/jadwal/page.tsx`, `app/topup/page.tsx`, `app/kontak/page.tsx`, `app/dashboard/page.tsx`, dll (strip emoji)
- `public/manifest.webmanifest`, `public/icon-*`, `next.config.js`, `app/offline/page.tsx`, `app/privasi/page.tsx`

Test instal: Chrome Android > buka web > menu titik 3 > Install app / Tambah ke layar utama.
