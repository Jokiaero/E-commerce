# RasaLokal Admin

Situs admin terpisah, statis, tanpa proses build atau dependency instalasi. Halaman awal menyediakan login akun Supabase dan **Lihat contoh dashboard** dengan data simulasi yang terpisah dari data nyata. Situs dipublikasikan privat melalui Sites.

## Buka admin lokal

Folder admin berdiri sendiri di samping aplikasi utama:

```text
Aplikasi E-commerce1/
  RasaLokal/        aplikasi pembeli, penjual, dan driver
  RasaLokal-Admin/  dashboard web admin
```

**Cara paling mudah:** klik dua kali `Mulai-Admin.cmd` di folder ini. Browser akan membuka **http://localhost:3001**. Biarkan terminal peluncur tetap terbuka selama memakai admin; tekan Ctrl+C untuk menghentikannya. Node.js harus sudah tersedia, sama seperti untuk menjalankan RasaLokal.

Atau jalankan dari terminal:

```powershell
cd "D:\TUGAS\Aplikasi E-commerce1\RasaLokal-Admin"
npm.cmd start
```

`npm.cmd run dev` menjalankan server tanpa membuka browser. Tidak perlu `npm install`. Jika port 3001 dipakai aplikasi lain, jalankan `npm.cmd run dev -- --port 3002` lalu buka http://localhost:3002.

Saat server dimulai, konfigurasi publik otomatis disamakan dengan `../RasaLokal/.env.local`. Admin dan aplikasi utama menggunakan proyek Supabase, akun, pesanan, dan driver yang sama. Kedua aplikasi dapat berjalan bersamaan; web admin tidak membutuhkan server Expo untuk mengakses Supabase. Setelah mengganti proyek atau key publik pada aplikasi utama, mulai ulang server admin.

Login admin tetap memerlukan migrasi dan aktivasi akun di bawah. Memisahkan folder tidak memberikan hak admin pada akun pembeli/penjual. Jika folder admin disalin ke lokasi lain tanpa folder RasaLokal, server menggunakan konfigurasi publik terakhir di `dist/config.js`.

## Mengaktifkan data nyata

1. Skema dasar aplikasi RasaLokal harus sudah terpasang. Jalankan migrasi Supabase pada `../RasaLokal/supabase/migrations/` sesuai urutan nama. Tiga migrasi driver/admin terbaru juga tersedia sebagai unduhan di **Panduan akses** situs (`dist/setup/admin.sql`). Jalankan migrasi admin satu kali; jangan menyalin ulang semua migrasi pada database yang sudah dimigrasikan.
2. Pilih akun email yang sudah terdaftar dan terkonfirmasi di aplikasi RasaLokal. Pemilik proyek menjalankan SQL berikut di Supabase SQL Editor, mengganti emailnya:

```sql
insert into public.marketplace_admins(user_id, active)
select id, true from auth.users
where lower(email) = lower('EMAIL_ADMIN_ANDA')
on conflict (user_id) do update set active = true;
```

Pastikan hasilnya satu baris. Tidak ada akun admin atau kata sandi bawaan. Login di situs memakai email dan kata sandi akun itu. Tidak perlu menambahkan URL situs sebagai redirect untuk login email/kata sandi ini.

3. Driver mendaftar di aplikasi → admin membuka **Driver → Tinjau → Aktifkan driver**. Untuk pesanan berstatus siap dijemput, buka detail pesanan lalu **Tugaskan driver**. Lokasi dan serah terima tetap berasal dari driver.

## Fitur

- Dashboard: total UMKM, pengguna, pesanan, nilai transaksi lunas, grafik dan antrean operasional.
- UMKM dan produk: pencarian, paginasi, detail, penangguhan/pemulihan melalui RPC admin.
- Pengguna: email, kontak, peran, tanggal daftar/login. Tidak menampilkan kata sandi.
- Pesanan: rincian barang/biaya, status, tujuan, dan penugasan driver aktif yang tersedia.
- Transaksi: verifikasi manual pembayaran bank/dompet **setelah dana benar-benar diterima**, pencarian, filter, ekspor CSV.
- Driver: aktivasi oleh admin dan penonaktifan jika tidak memiliki tugas aktif.
- Laporan: periode 7/30/90 hari atau tahun berjalan, transaksi/biaya layanan, CSV maksimal 10.000 baris per ekspor.
- Pengaturan: sesi akun, panduan awal, dan 20 aktivitas admin terakhir pada tahun berjalan.

Nilai transaksi adalah total pembayaran pesanan lunas, termasuk ongkir dan biaya layanan; bukan pendapatan bersih platform. Biaya layanan ditampilkan terpisah pada laporan. Periode laporan berdasarkan tanggal pembuatan pesanan dalam WIB, bukan tanggal penyelesaian pembayaran. Dashboard data nyata diperbarui setiap 60 detik saat terlihat dan dapat diperbarui manual.

## Akses dan konfigurasi

`dist/config.js` hanya berisi URL dan **anon/publishable key** browser. Semua pembacaan lintas pengguna dan perubahan admin melewati RPC yang memeriksa tabel keanggotaan `marketplace_admins`. Data auth sensitif dan service role key tidak dikirim ke browser. User metadata tidak digunakan untuk menentukan admin. Keanggotaan admin hanya dapat diberikan oleh pemilik proyek/service role. Pencabutan `active` langsung memblokir RPC berikutnya.

```sql
update public.marketplace_admins set active = false where user_id = 'UUID_ADMIN';
```

`scripts/sync-public-config.mjs` menyalin konfigurasi publik dari proyek lokal dan menolak key berhak istimewa. Ia juga menyegarkan unduhan SQL setelah perubahan migrasi. Jangan memasukkan `.env`, service role key, data pengguna nyata, atau kredensial hosting ke source situs.

## Pemeriksaan lokal

```powershell
node scripts/sync-public-config.mjs
npm.cmd run check
npm.cmd test
node scripts/browser-qa.mjs
```

Uji database admin di proyek RasaLokal: `node --test scripts/admin-sql.test.cjs`. Menggunakan PGlite lokal yang sudah tersedia di `.expo/driver-sql-tools` untuk memeriksa izin, penugasan, pembayaran, moderasi, paginasi, dan batas tanggal WIB. Uji browser menggunakan Chrome headless dengan profil sementara dan API tiruan; tidak mengubah akun/pesanan Supabase nyata. Screenshot lokal disimpan di `.cache/` (diabaikan Git).

SDK Supabase disimpan lokal dalam `dist/vendor`; lisensinya disertakan. Situs ini tidak mengubah konfigurasi Authentication Supabase, tidak menerapkan SQL ke database hosted secara otomatis, dan tidak membuat akun admin sungguhan.
