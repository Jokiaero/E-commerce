export const DRIVER_GUIDE_STEPS = [
  {
    number: 1, title: 'TERIMA PESANAN', subtitle: 'Siap online, siap menuju merchant', icon: 'bicycle',
    bullets: [
      'Buka aplikasi ShopeeFood Driver. Pastikan status online, internet tersambung, dan GPS aktif.',
      'Cek ID pesanan, restoran, alamat, dan metode pembayaran. Tekan “Terima” pada pesanan yang masuk.',
      'Ikuti navigasi GPS menuju merchant. Siapkan tas pengantaran dan jaga posisi makanan tetap tegak.',
    ],
  },
  {
    number: 2, title: 'PENGAMBILAN & BUKTI STRUK', subtitle: 'Cocokkan pesanan, baru ambil makanan', icon: 'camera-outline',
    bullets: [
      'Setelah tiba, konfirmasi kedatangan di aplikasi. Sebutkan ID pesanan ke kasir dan cocokkan menu serta jumlahnya.',
      'Minta struk asli restoran. Pilih “Upload Struk” → “Ambil Foto”. Periksa hasil foto sebelum dikirim.',
    ],
  },
  {
    number: 3, title: 'PERJALANAN & HUBUNGI PEMBELI', subtitle: 'Antar dengan tenang, komunikasikan kedatangan', icon: 'chat-outline',
    bullets: [
      'Ikuti GPS ke alamat tujuan. Perhatikan catatan pembeli dan jaga kemasan tetap tertutup serta aman.',
      'Saat mendekati lokasi, berhenti di tempat aman. Hubungi pembeli melalui chat atau telepon di aplikasi untuk memastikan patokan dan titik penerimaan.',
      'Jika alamat belum jelas atau pembeli belum dapat dihubungi, gunakan Bantuan di aplikasi sebelum menentukan langkah berikutnya.',
    ],
  },
  {
    number: 4, title: 'PENYERAHAN & BUKTI PENGANTARAN', subtitle: 'POD · Proof of Delivery', icon: 'bag-check',
    bullets: [
      'Sapa pembeli dengan sopan, cocokkan pesanan, lalu serahkan makanan dengan hati-hati.',
      'Ambil foto POD sesuai kondisi di bawah. Untuk penitipan, pastikan lokasi sudah disetujui pembeli.',
    ],
  },
  {
    number: 5, title: 'SELESAI & TRANSAKSI', subtitle: 'Cek pembayaran, tutup pesanan, cek pendapatan', icon: 'wallet-outline',
    bullets: [
      'Pastikan makanan sudah diterima atau dititipkan sesuai persetujuan, bukti terkirim, dan pembayaran beres.',
      'Geser “Pesanan Selesai” atau gunakan tombol penyelesaian yang tampil. Tunggu hingga status pesanan benar-benar selesai.',
      'Periksa Dompet Driver dan riwayat pendapatan. Cocokkan pendapatan tunai/non-tunai dengan rincian aplikasi. Jika pendapatan belum tercatat sesuai rincian, hubungi Bantuan.',
    ],
  },
] as const;

export const RECEIPT_PHOTO_RULES = [
  'Arahkan kamera tegak lurus ke struk. Ratakan kertas di area terang tanpa bayangan menutup tulisan.',
  'Ketuk layar untuk fokus. Foto harus tajam, tidak buram, tidak silau, dan tidak terpotong.',
  'Gunakan foto struk asli untuk pesanan ini. Ambil ulang jika belum jelas dan pastikan unggahan berhasil.',
] as const;

export const PROOF_SCENARIOS = [
  {
    kind: 'direct', title: 'Diterima langsung', caption: 'Paket + tangan penerima',
    bullets: [
      'Minta izin, lalu foto kantong makanan ShopeeFood yang sedang dipegang pembeli.',
      'Fokus ke paket dan tangan penerima. Wajah pembeli tidak perlu masuk bingkai.',
    ],
  },
  {
    kind: 'door', title: 'Dititipkan di pagar / pintu', caption: 'Paket + penanda rumah',
    bullets: [
      'Pastikan pembeli menyetujui lokasi penitipan. Letakkan makanan di tempat yang aman dan bersih.',
      'Foto makanan bersama nomor rumah atau warna pagar yang jelas. Kabari pembeli posisi tepatnya.',
    ],
  },
  {
    kind: 'lobby', title: 'Dititipkan di pos / lobi', caption: 'Paket + identitas lokasi',
    bullets: [
      'Konfirmasi penitipan kepada pembeli dan petugas penerima.',
      'Foto makanan di meja drop-off, dengan latar pos satpam atau papan nama gedung yang terbaca.',
    ],
  },
] as const;

export const DRIVER_GUIDE_SOURCES = [
  { title: 'Panduan unggah struk', url: 'https://help.shopee.co.id/portal/4/article/72279' },
  { title: 'Alur pengambilan pesanan', url: 'https://help.shopee.co.id/portal/4/article/72107' },
  { title: 'Contoh bukti pengantaran', url: 'https://help.shopee.co.id/portal/4/article/197067' },
] as const;

export const DRIVER_CHAT_SCRIPT = 'Halo Kak, saya mitra ShopeeFood untuk pesanan Kakak. Saya sudah mendekati lokasi. Boleh dibantu patokan dan titik penerimaannya, ya?';
export const DRIVER_PHOTO_SCRIPT = 'Mohon izin foto paketnya sebagai bukti pesanan sudah diterima, ya Kak. Terima kasih.';
