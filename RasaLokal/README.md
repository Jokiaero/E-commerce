# Aplikasi RasaLokal

Aplikasi Expo/React Native untuk pengguna RasaLokal: pembeli, penjual UMKM, dan driver. Navigasi menggunakan Expo Router dengan route di `src/app`.

## Persiapan

```bash
npm install
cp .env.example .env.local
```

Isi konfigurasi publik Supabase pada `.env.local`. Jangan commit kredensial atau service role key.

## Menjalankan

```bash
npm start       # Dev server Expo
npm run android
npm run ios
npm run web
```

## Struktur source

- `src/app`: layar dan layout Expo Router.
- `src/components`: komponen UI lintas layar.
- `src/hooks`: hooks aplikasi.
- `src/lib`: akses data, penyimpanan, pembayaran, akun, dan pengantaran.
- `src/constants`: tema dan data konstan.
- `assets`: ikon serta aset build yang direferensikan `app.json`.
- `supabase`: migrasi database dan Edge Functions.
- `scripts`: pengujian dan utilitas pengembangan.

## Validasi

```bash
npm run lint
npx tsc --noEmit
```

Dokumentasi driver tersedia di folder `docs`. Detail arsitektur keseluruhan dan dashboard admin tersedia pada README di root repositori.
