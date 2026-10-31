export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = value => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value || 0));
export const number = value => new Intl.NumberFormat('id-ID').format(Number(value || 0));
export const shortMoney = value => new Intl.NumberFormat('id-ID',{notation:'compact',maximumFractionDigits:1}).format(Number(value || 0));
export const date = value => value ? new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value)) : '—';
export function periodDates(period, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = t => parts.find(p=>p.type===t).value;
  const end = `${get('year')}-${get('month')}-${get('day')}`;
  if (period === 'year') return {start:`${get('year')}-01-01`,end};
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (Number(period) || 30) + 1);
  return {start:start.toISOString().slice(0,10),end};
}
export function csv(rows, columns) {
  const cell = value => '"' + String(value ?? '').replace(/^[\s]*[=+@-]/, m=>"'"+m).replace(/"/g,'""') + '"';
  return '\ufeff'+[columns.map(c=>cell(c[1])).join(','),...rows.map(r=>columns.map(c=>cell(r[c[0]])).join(','))].join('\r\n');
}
export const labels = {
  open:'Buka',closed:'Tutup',suspended:'Ditangguhkan',available:'Tersedia',unavailable:'Tidak tersedia',blocked:'Diblokir',
  active:'Aktif',pending:'Menunggu',busy:'Mengantar',admin:'Admin',seller:'Penjual',driver:'Driver',customer:'Pembeli',
  review:'Perlu verifikasi',success:'Lunas',processing:'Diproses',failed:'Gagal',pending_payment:'Menunggu bayar',confirmed:'Dikonfirmasi',merchant_accepted:'Diterima toko',
  accepted:'Diterima toko',preparing:'Disiapkan',ready_for_pickup:'Siap dijemput',driver_assigned:'Driver ditugaskan',driver_going_to_merchant:'Driver ke toko',
  driver_arrived_merchant:'Driver tiba di toko',picked_up:'Diambil driver',driver_going_to_customer:'Dalam pengantaran',driver_arrived:'Driver tiba',
  shipped:'Dikirim',delivered:'Diterima',completed:'Selesai',cancelled:'Dibatalkan',rejected:'Ditolak',payment_failed:'Pembayaran gagal',
  bank:'Transfer bank',wallet:'Dompet digital',cod:'Bayar di tempat',driver_active:'Status driver',store_suspended:'Moderasi UMKM',product_blocked:'Moderasi produk',payment_confirm:'Verifikasi pembayaran',assign_driver:'Penugasan driver'
};
