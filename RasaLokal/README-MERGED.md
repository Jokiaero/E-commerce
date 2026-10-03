# RasaLokal - Project Gabungan

Project ini adalah hasil penggabungan folder Expo SDK 57 milik pengguna dengan source React Native RasaLokal hasil konversi dari prototype HTML.

## Yang dipertahankan
- package.json dan package-lock.json dari project Expo asli
- app.json, tsconfig.json, assets, scripts, .vscode
- konfigurasi Expo Router SDK 57

## Yang diganti/ditambahkan
- `src/app` menjadi halaman RasaLokal
- `src/components` berisi komponen UI RasaLokal
- `src/constants` berisi theme dan data contoh
- ikon menggunakan `expo-symbols` yang sudah ada di dependency project, jadi tidak perlu menambah `@expo/vector-icons`
- warna splash diubah ke orange RasaLokal

## Halaman
- Splash / landing
- Beranda
- Daftar UMKM
- Detail produk
- Keranjang
- Checkout
- Pesanan
- Tracking pesanan
- Akun

## Menjalankan di VS Code
Buka terminal pada folder `RasaLokal`, lalu:

```powershell
npm install
npx expo start -c
```

Scan QR Code menggunakan Expo Go pada iPhone.

## Catatan
Gambar produk saat ini memakai URL gambar online, sehingga iPhone perlu koneksi internet. Data produk, keranjang, pembayaran, dan tracking masih data demo UI.
