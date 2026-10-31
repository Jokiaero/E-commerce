import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { ORDER_STATUS_LABELS, type DriverQueueOrder, type ShopOrder } from '@/lib/orderStorage';

export type DriverTab = 'home' | 'tasks' | 'income' | 'notifications' | 'account';

type Props = {
  tab: DriverTab;
  onTabChange: (tab: DriverTab) => void;
  orders: ShopOrder[];
  queueOrders: DriverQueueOrder[];
  queueLoading: boolean;
  queueError: string;
  selectedOrderId: string;
  driverName: string;
  onSelectOrder: (id: string) => void;
  onRefresh: () => void;
  children: ReactNode;
};

type ModuleKey =
  | 'history' | 'wallet' | 'transactions' | 'incentives' | 'performance' | 'rating'
  | 'personal' | 'vehicle' | 'documents' | 'bank' | 'notifications-settings' | 'language'
  | 'privacy' | 'security' | 'academy' | 'help' | 'faq' | 'contact' | 'report'
  | 'terms' | 'logout' | 'delete-account';

const TAB_ITEMS: { key: DriverTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Beranda', icon: 'home' },
  { key: 'tasks', label: 'Pesanan', icon: 'bicycle' },
  { key: 'income', label: 'Pendapatan', icon: 'wallet-outline' },
  { key: 'notifications', label: 'Notifikasi', icon: 'notifications-outline' },
  { key: 'account', label: 'Akun', icon: 'person' },
];

const MODULES: Record<ModuleKey, { title: string; subtitle: string; icon: string; badge?: string }> = {
  history: { title: 'Riwayat pesanan', subtitle: 'Pengantaran selesai dan dibatalkan', icon: 'receipt' },
  wallet: { title: 'Dompet driver', subtitle: 'Ringkasan saldo dan penghasilan demo', icon: 'wallet-outline', badge: 'Pratinjau' },
  transactions: { title: 'Riwayat transaksi', subtitle: 'Catatan simulasi pendapatan', icon: 'card-outline', badge: 'Demo' },
  incentives: { title: 'Insentif & bonus', subtitle: 'Target harian dan mingguan', icon: 'gift' },
  performance: { title: 'Performa', subtitle: 'Ringkasan aktivitas driver', icon: 'grid' },
  rating: { title: 'Rating & ulasan', subtitle: 'Apresiasi dari pelanggan', icon: 'star' },
  personal: { title: 'Informasi pribadi', subtitle: 'Nama, nomor telepon, dan identitas', icon: 'person' },
  vehicle: { title: 'Kendaraan', subtitle: 'Jenis dan nomor kendaraan', icon: 'bicycle' },
  documents: { title: 'Dokumen kendaraan', subtitle: 'SIM dan STNK', icon: 'receipt' },
  bank: { title: 'Informasi rekening', subtitle: 'Rekening untuk pencairan', icon: 'business-outline' },
  'notifications-settings': { title: 'Pengaturan notifikasi', subtitle: 'Atur jenis pemberitahuan', icon: 'notifications-outline' },
  language: { title: 'Bahasa', subtitle: 'Preferensi bahasa aplikasi', icon: 'information-circle-outline' },
  privacy: { title: 'Privasi', subtitle: 'Kontrol data dan izin akses', icon: 'information-circle-outline' },
  security: { title: 'Keamanan akun', subtitle: 'Kata sandi dan PIN', icon: 'card-outline' },
  academy: { title: 'Akademi mitra', subtitle: 'Panduan dan pembelajaran driver', icon: 'receipt' },
  help: { title: 'Pusat bantuan', subtitle: 'Bantuan untuk perjalanan dan aplikasi', icon: 'help-circle-outline' },
  faq: { title: 'Pertanyaan umum', subtitle: 'Jawaban cepat untuk driver', icon: 'information-circle-outline' },
  contact: { title: 'Hubungi bantuan', subtitle: 'Saluran bantuan driver', icon: 'call' },
  report: { title: 'Laporkan kendala', subtitle: 'Sampaikan kendala pesanan atau aplikasi', icon: 'chat-outline' },
  terms: { title: 'Syarat & privasi', subtitle: 'Ketentuan penggunaan prototype', icon: 'receipt' },
  logout: { title: 'Keluar akun', subtitle: 'Konfirmasi keluar dari akun driver', icon: 'arrow-forward' },
  'delete-account': { title: 'Hapus akun', subtitle: 'Informasi pengajuan penghapusan akun', icon: 'close' },
};

const PROFILE_GROUPS: { title: string; items: ModuleKey[] }[] = [
  { title: 'Akun driver', items: ['personal', 'vehicle', 'documents', 'bank'] },
  { title: 'Preferensi', items: ['notifications-settings', 'language', 'privacy', 'security'] },
  { title: 'Belajar & bantuan', items: ['academy', 'help', 'faq', 'contact', 'report'] },
  { title: 'Informasi', items: ['terms', 'logout', 'delete-account'] },
];

const notifications = [
  { type: 'Pesanan', title: 'Tugas driver siap dilihat', body: 'Buka tab Pesanan untuk memeriksa tugas pengantaran yang ditugaskan.', icon: 'bicycle', time: 'Baru' },
  { type: 'Insentif', title: 'Target harian', body: 'Selesaikan tugas untuk melihat progres performa demo hari ini.', icon: 'gift', time: 'Hari ini' },
  { type: 'Akun', title: 'Selamat datang di RasaLokal', body: 'Lengkapi profil driver dan jaga keamanan akunmu.', icon: 'person', time: 'Hari ini' },
];

function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onPress}><Text style={styles.textLink}>{action}</Text></Pressable>}</View>;
}

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <View style={styles.metric}><View style={styles.metricIcon}><AppIcon name={icon} size={17} color={COLORS.primary} /></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function MenuRow({ module, onPress, trailing }: { module: ModuleKey; onPress: () => void; trailing?: string }) {
  const item = MODULES[module];
  return <Pressable style={styles.menuRow} onPress={onPress} accessibilityRole="button">
    <View style={styles.menuIcon}><AppIcon name={item.icon} size={19} color={COLORS.primary} /></View>
    <View style={styles.menuCopy}><Text style={styles.menuTitle}>{item.title}</Text><Text style={styles.menuSubtitle}>{item.subtitle}</Text></View>
    {trailing ? <Text style={styles.menuTrailing}>{trailing}</Text> : <AppIcon name="chevron-forward" size={17} color={COLORS.muted} />}
  </Pressable>;
}

function MapPreview() {
  return <View style={styles.map}>
    <View style={[styles.road, styles.roadOne]} /><View style={[styles.road, styles.roadTwo]} />
    <View style={[styles.road, styles.roadThree]} /><View style={[styles.road, styles.roadFour]} />
    <View style={styles.park}><Text style={styles.parkText}>TAMAN KOTA</Text></View>
    <View style={styles.mapShop}><AppIcon name="storefront" size={13} color="#fff" /></View>
    <View style={styles.mapPin}><View style={styles.mapPinCore} /></View>
    <View style={styles.mapCaption}><AppIcon name="location" size={13} color={COLORS.primary} /><Text style={styles.mapCaptionText}>Lokasi driver · Palembang</Text></View>
    <View style={styles.gpsBadge}><View style={styles.liveDot} /><Text style={styles.gpsText}>GPS SIAP</Text></View>
  </View>;
}

function DriverHome({ driverName, orders, queueOrders, queueLoading, queueError, onTabChange, openModule }: {
  driverName: string; orders: ShopOrder[]; queueOrders: DriverQueueOrder[]; queueLoading: boolean; queueError: string; onTabChange: (tab: DriverTab) => void; openModule: (key: ModuleKey) => void;
}) {
  const [online, setOnline] = useState(false);
  const completed = orders.filter((order) => order.status === 'completed');
  const active = orders.filter((order) => !['completed', 'cancelled', 'payment_failed', 'rejected'].includes(order.status));
  return <>
    <View style={styles.welcomeRow}>
      <View style={styles.avatar}><AppIcon name="bicycle" size={23} color={COLORS.primary} /></View>
      <View style={styles.welcomeCopy}><Text style={styles.greeting}>Halo, mitra driver</Text><Text style={styles.driverName}>{driverName || 'Driver RasaLokal'}</Text><Text style={styles.driverId}>MITRA RASALOKAL · AKUN AKTIF</Text></View>
      <Pressable style={styles.bellButton} onPress={() => onTabChange('notifications')} accessibilityLabel="Buka notifikasi"><AppIcon name="notifications-outline" size={21} color={COLORS.text} /><View style={styles.bellDot} /></Pressable>
    </View>

    <Card style={styles.onlineCard}>
      <View style={[styles.statusOrb, online && styles.statusOrbOnline]}><View style={[styles.statusOrbCore, online && styles.statusOrbCoreOnline]} /></View>
      <View style={styles.onlineCopy}><Text style={styles.onlineTitle}>{online ? 'Siap menerima tugas' : 'Kamu sedang offline'}</Text><Text style={styles.onlineSub}>{online ? 'Status pratinjau · tugas tetap dari server' : 'Aktifkan status untuk pratinjau online'}</Text></View>
      <Switch value={online} onValueChange={setOnline} trackColor={{ false: '#D5D5D5', true: COLORS.success }} thumbColor="#fff" accessibilityLabel="Status online pratinjau" />
    </Card>

    <MapPreview />

    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Ringkasan hari ini</Text><View style={styles.previewBadge}><Text style={styles.previewBadgeText}>DEMO</Text></View></View>
    <Card style={styles.metricsCard}>
      <Metric label="Pendapatan" value={rupiah(completed.length * 18500)} icon="wallet-outline" />
      <View style={styles.metricDivider} /><Metric label="Pesanan selesai" value={String(completed.length)} icon="bag-check" />
      <View style={styles.metricDivider} /><Metric label="Tugas aktif" value={String(active.length)} icon="bicycle" />
    </Card>

    <SectionTitle title="Akses cepat" />
    <View style={styles.shortcutGrid}>
      <Shortcut icon="receipt" label="Riwayat" onPress={() => openModule('history')} />
      <Shortcut icon="wallet-outline" label="Dompet" onPress={() => onTabChange('income')} />
      <Shortcut icon="gift" label="Insentif" onPress={() => openModule('incentives')} />
      <Shortcut icon="help-circle-outline" label="Bantuan" onPress={() => openModule('help')} />
    </View>

    <Card style={styles.performanceCard}>
      <View style={styles.performanceTop}><View><Text style={styles.performanceEyebrow}>PERFORMA MITRA</Text><Text style={styles.performanceTitle}>Konsisten, layanan makin baik</Text></View><AppIcon name="star" size={22} color="#F5A623" /></View>
      <View style={styles.ratingRow}><Text style={styles.ratingValue}>4,9</Text><Text style={styles.ratingOutOf}>/ 5,0</Text><View style={styles.ratingPill}><Text style={styles.ratingPillText}>Sangat baik</Text></View></View>
      <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
      <Text style={styles.progressCaption}>Target layanan harian · pratinjau desain</Text>
      <Pressable style={styles.inlineLink} onPress={() => openModule('performance')}><Text style={styles.textLink}>Lihat statistik performa</Text><AppIcon name="chevron-forward" size={15} color={COLORS.primary} /></Pressable>
    </Card>

    <SectionTitle title="Tugas pengantaran" action="Lihat semua" onPress={() => onTabChange('tasks')} />
    {queueOrders.slice(0, 2).map((queued) => <Pressable key={queued.id} style={styles.orderPreview} onPress={() => onTabChange('tasks')}>
      <View style={styles.orderPreviewIcon}><AppIcon name="restaurant" size={18} color={COLORS.primary} /></View>
      <View style={styles.menuCopy}><Text style={styles.menuTitle}>Tugas tersedia · {queued.storeName}</Text><Text style={styles.menuSubtitle}>#{queued.id.slice(0, 8).toUpperCase()} · {ORDER_STATUS_LABELS[queued.status]}</Text></View>
      <AppIcon name="chevron-forward" size={17} color={COLORS.muted} />
    </Pressable>)}
    {active.slice(0, 2).map((order) => <Pressable key={order.id} style={styles.orderPreview} onPress={() => onTabChange('tasks')}>
      <View style={styles.orderPreviewIcon}><AppIcon name="restaurant" size={18} color={COLORS.primary} /></View>
      <View style={styles.menuCopy}><Text style={styles.menuTitle}>Pesanan #{order.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.menuSubtitle}>{ORDER_STATUS_LABELS[order.status]} · {order.deliveryAddress}</Text></View>
      <AppIcon name="chevron-forward" size={17} color={COLORS.muted} />
    </Pressable>)}
    {active.length === 0 && queueOrders.length === 0 && <Card style={styles.emptyCard}><AppIcon name={queueError ? 'information-circle-outline' : 'bicycle'} size={25} color={queueError ? COLORS.danger : COLORS.muted} /><Text style={styles.emptyTitle}>{queueLoading ? 'Memeriksa antrean tugas...' : queueError ? 'Antrean belum dapat dimuat' : 'Belum ada tugas aktif'}</Text><Text style={styles.emptyText}>{queueError || 'Pesanan yang sudah dibayar atau COD akan muncul di antrean setelah checkout.'}</Text></Card>}
  </>;
}

function Shortcut({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return <Pressable style={styles.shortcut} onPress={onPress} accessibilityRole="button"><View style={styles.shortcutIcon}><AppIcon name={icon} size={20} color={COLORS.primary} /></View><Text style={styles.shortcutLabel}>{label}</Text></Pressable>;
}

function IncomePage({ orders, openModule }: { orders: ShopOrder[]; openModule: (key: ModuleKey) => void }) {
  const completed = orders.filter((order) => order.status === 'completed');
  const estimated = completed.length * 18500;
  return <>
    <View style={styles.pageHeading}><Text style={styles.pageEyebrow}>RINGKASAN DRIVER</Text><Text style={styles.pageTitle}>Pendapatan</Text><Text style={styles.pageDescription}>Contoh tampilan keuangan untuk prototype kampus.</Text></View>
    <Card style={styles.walletHero}>
      <View style={styles.walletHeroTop}><View><Text style={styles.walletLabel}>ESTIMASI PENGHASILAN HARI INI</Text><Text style={styles.walletValue}>{rupiah(estimated)}</Text></View><View style={styles.walletIcon}><AppIcon name="wallet-outline" size={22} color="#fff" /></View></View>
      <Text style={styles.walletNote}>Nilai demo · bukan saldo atau pencairan uang</Text>
      <View style={styles.walletDivider} />
      <View style={styles.walletMetrics}><View><Text style={styles.walletSmallLabel}>Pesanan selesai</Text><Text style={styles.walletSmallValue}>{completed.length}</Text></View><View><Text style={styles.walletSmallLabel}>Bonus pratinjau</Text><Text style={styles.walletSmallValue}>{rupiah(25000)}</Text></View></View>
    </Card>
    <SectionTitle title="Ringkasan pendapatan" />
    <Card style={styles.chartCard}>
      <View style={styles.chartHeader}><View><Text style={styles.chartTitle}>Aktivitas minggu ini</Text><Text style={styles.menuSubtitle}>Grafik pratinjau</Text></View><Text style={styles.chartTrend}>+12%</Text></View>
      <View style={styles.chart}>{[32, 54, 41, 77, 58, 88, 63].map((height, index) => <View key={index} style={styles.chartColumn}><View style={[styles.chartBar, index === 5 && styles.chartBarActive, { height }]} /><Text style={styles.chartDay}>{['S', 'S', 'R', 'K', 'J', 'S', 'M'][index]}</Text></View>)}</View>
      <View style={styles.chartLegend}><View style={styles.chartLegendDot} /><Text style={styles.menuSubtitle}>Penghasilan simulasi</Text></View>
    </Card>
    <SectionTitle title="Kelola pendapatan" />
    <Card style={styles.listCard}>
      <MenuRow module="wallet" onPress={() => openModule('wallet')} trailing={rupiah(estimated)} />
      <MenuRow module="transactions" onPress={() => openModule('transactions')} />
      <MenuRow module="history" onPress={() => openModule('history')} />
      <MenuRow module="incentives" onPress={() => openModule('incentives')} />
    </Card>
    <View style={styles.disclaimer}><AppIcon name="information-circle-outline" size={16} color="#98622A" /><Text style={styles.disclaimerText}>Semua angka pendapatan dan bonus pada prototype bersifat contoh, bukan data keuangan.</Text></View>
  </>;
}

function NotificationsPage({ openDetail }: { openDetail: (title: string, body: string) => void }) {
  const [filter, setFilter] = useState('Semua');
  const categories = ['Semua', 'Pesanan', 'Insentif', 'Akun'];
  const shown = filter === 'Semua' ? notifications : notifications.filter((item) => item.type === filter);
  return <>
    <View style={styles.pageHeading}><Text style={styles.pageEyebrow}>INFO TERBARU</Text><Text style={styles.pageTitle}>Notifikasi</Text><Text style={styles.pageDescription}>Pembaruan aktivitas driver dan akun.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{categories.map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    {shown.map((item) => <Pressable key={item.title} style={styles.notificationCard} onPress={() => openDetail(item.title, item.body)}>
      <View style={styles.notificationIcon}><AppIcon name={item.icon} size={19} color={COLORS.primary} /></View><View style={styles.menuCopy}><View style={styles.notificationMeta}><Text style={styles.notificationType}>{item.type}</Text><Text style={styles.notificationTime}>{item.time}</Text></View><Text style={styles.menuTitle}>{item.title}</Text><Text style={styles.menuSubtitle}>{item.body}</Text></View>
    </Pressable>)}
    {shown.length === 0 && <EmptyState title="Belum ada notifikasi" body="Pembaruan baru akan muncul di sini." />}
  </>;
}

function AccountPage({ driverName, openModule }: { driverName: string; openModule: (key: ModuleKey) => void }) {
  return <>
    <View style={styles.pageHeading}><Text style={styles.pageEyebrow}>MITRA DRIVER</Text><Text style={styles.pageTitle}>Akun</Text></View>
    <Card style={styles.profileHero}>
      <View style={styles.profileAvatar}><AppIcon name="person" size={26} color={COLORS.primary} /></View>
      <View style={styles.menuCopy}><Text style={styles.profileName}>{driverName || 'Driver RasaLokal'}</Text><Text style={styles.menuSubtitle}>Mitra pengantaran · RasaLokal</Text><View style={styles.activePill}><View style={styles.liveDot} /><Text style={styles.activePillText}>AKUN AKTIF</Text></View></View>
      <Pressable onPress={() => openModule('personal')}><AppIcon name="create-outline" size={19} color={COLORS.primary} /></Pressable>
    </Card>
    {PROFILE_GROUPS.map((group) => <View key={group.title}><SectionTitle title={group.title} /><Card style={styles.listCard}>{group.items.map((key) => <MenuRow key={key} module={key} onPress={() => openModule(key)} />)}</Card></View>)}
    <Text style={styles.version}>RasaLokal Driver · Prototype UI 1.0</Text>
  </>;
}

function HistoryPage({ orders, onSelectOrder }: { orders: ShopOrder[]; onSelectOrder: (id: string) => void }) {
  const [filter, setFilter] = useState<'Semua' | 'Selesai' | 'Dibatalkan'>('Semua');
  const history = orders.filter((order) => ['completed', 'cancelled', 'payment_failed', 'rejected'].includes(order.status));
  const shown = history.filter((order) => filter === 'Semua' || (filter === 'Selesai' ? order.status === 'completed' : order.status !== 'completed'));
  return <>
    <View style={styles.pageHeading}><Text style={styles.pageEyebrow}>AKTIVITAS DRIVER</Text><Text style={styles.pageTitle}>Riwayat pesanan</Text></View>
    <View style={styles.filterRow}>{(['Semua', 'Selesai', 'Dibatalkan'] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</View>
    {shown.map((order) => <Pressable key={order.id} style={styles.historyRow} onPress={() => onSelectOrder(order.id)}>
      <View style={[styles.historyIcon, order.status === 'completed' && styles.historyIconSuccess]}><AppIcon name={order.status === 'completed' ? 'checkmark-circle-outline' : 'close'} size={18} color={order.status === 'completed' ? COLORS.success : COLORS.danger} /></View>
      <View style={styles.menuCopy}><Text style={styles.menuTitle}>Pesanan #{order.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.menuSubtitle}>{ORDER_STATUS_LABELS[order.status]} · {new Date(order.createdAt).toLocaleDateString('id-ID')}</Text><Text style={styles.menuSubtitle}>{order.deliveryAddress}</Text></View>
      <View><Text style={styles.orderEarning}>{order.status === 'completed' ? rupiah(18500) : '—'}</Text><AppIcon name="chevron-forward" size={15} color={COLORS.muted} /></View>
    </Pressable>)}
    {shown.length === 0 && <EmptyState title="Riwayat masih kosong" body="Pesanan yang sudah selesai atau dibatalkan akan tampil di sini." />}
  </>;
}

function ModuleDetail({ module, orders, onBack, onOpenOrder }: {
  module: ModuleKey; orders: ShopOrder[]; onBack: () => void; onOpenOrder: (id: string) => void;
}) {
  const item = MODULES[module];
  const completed = orders.filter((order) => order.status === 'completed').length;
  const [enabled, setEnabled] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('Hari ini');
  const savedOrders = orders.filter((order) => ['completed', 'cancelled', 'payment_failed', 'rejected'].includes(order.status));
  const details: Partial<Record<ModuleKey, string[]>> = {
    wallet: ['Saldo driver', rupiah(completed * 18500), 'Estimasi penghasilan hari ini', 'Nilai pratinjau untuk tugas kampus. Belum terhubung ke rekening atau pencairan.'],
    transactions: ['Belum ada transaksi keuangan nyata', 'Catatan ini menampilkan data demo saja.'],
    incentives: ['Target harian', '1 dari 5 tugas · pratinjau', 'Bonus mingguan', 'Rp25.000 · contoh tampilan'],
    performance: ['Penerimaan tugas', '92% · pratinjau', 'Penyelesaian', '98% · pratinjau', 'Rating', '4,9 dari 5 · pratinjau'],
    rating: ['Rating rata-rata', '4,9 / 5', 'Ulasan pelanggan', 'Belum ada ulasan yang tersimpan di prototype.'],
    personal: ['Nama', 'Profil driver RasaLokal', 'Nomor telepon', 'Data pendaftaran driver'],
    vehicle: ['Kendaraan terdaftar', 'Lihat jenis kendaraan dan nomor polisi dari pendaftaran.'],
    documents: ['SIM', 'Dokumen belum dikelola di prototype.', 'STNK', 'Dokumen belum dikelola di prototype.'],
    bank: ['Rekening pencairan', 'Belum terhubung. Pengaturan rekening memerlukan alur verifikasi aman.'],
    'notifications-settings': ['Pembaruan tugas', 'Atur notifikasi order dan status akun.'],
    language: ['Bahasa aplikasi', 'Bahasa Indonesia'],
    privacy: ['Izin lokasi', 'Lokasi digunakan saat tugas aktif dan halaman driver berjalan.'],
    security: ['Kata sandi', 'Pengaturan keamanan akun dikelola melalui Akun RasaLokal.'],
    academy: ['Panduan pengantaran', 'Buka panduan tugas, pengambilan, komunikasi, dan bukti pengiriman.'],
    help: ['Bantuan tugas driver', 'Periksa jaringan, GPS, status penugasan, dan izin lokasi.'],
    faq: ['Bagaimana memulai tugas?', 'Buka tab Pesanan dan aktifkan lokasi setelah tugas ditugaskan.'],
    contact: ['Hubungi bantuan', 'Saluran layanan pelanggan belum tersambung di prototype.'],
    report: ['Laporkan kendala', 'Sertakan ID pesanan dan deskripsi kendala saat fitur tiket tersedia.'],
    terms: ['Prototype akademik', 'Fitur pendapatan dan status online di halaman ini adalah pratinjau visual.'],
    logout: ['Keluar dari akun driver?', 'Aksi logout tersedia dari halaman Akun RasaLokal.'],
    'delete-account': ['Penghapusan akun', 'Ajukan penghapusan dari menu keamanan akun RasaLokal.'],
  };
  return <>
    <View style={styles.detailTop}><Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Kembali"><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.detailTopTitle}>{item.title}</Text><View style={styles.backButton} /></View>
    <View style={styles.detailHero}><View style={styles.detailHeroIcon}><AppIcon name={item.icon} size={22} color={COLORS.primary} /></View><Text style={styles.pageTitle}>{item.title}</Text><Text style={styles.pageDescription}>{item.subtitle}</Text>{item.badge && <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>{item.badge.toUpperCase()}</Text></View>}</View>
    {module === 'history' && <HistoryPage orders={orders} onSelectOrder={onOpenOrder} />}
    {module === 'transactions' && <View style={styles.periodRow}>{['Hari ini', 'Minggu', 'Bulan'].map((period) => <Pressable key={period} onPress={() => setSelectedPeriod(period)} style={[styles.filterChip, selectedPeriod === period && styles.filterChipActive]}><Text style={[styles.filterText, selectedPeriod === period && styles.filterTextActive]}>{period}</Text></Pressable>)}</View>}
    {module === 'incentives' && <View style={styles.progressTrack}><View style={[styles.progressFill, { width: '20%' }]} /></View>}
    {module === 'notifications-settings' && <Card style={styles.settingsCard}><Text style={styles.menuTitle}>Pembaruan tugas dan akun</Text><Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: '#D5D5D5', true: COLORS.success }} /></Card>}
    {(details[module] ?? []).map((line, index) => index % 2 === 0
      ? <Card key={`${module}-${index}`} style={styles.detailRow}><Text style={styles.detailTitle}>{line}</Text></Card>
      : <Text key={`${module}-${index}`} style={styles.detailBody}>{line}</Text>)}
    {module === 'history' && savedOrders.length === 0 && <EmptyState title="Belum ada riwayat" body="Riwayat akan terisi setelah ada tugas pengantaran." />}
    {['wallet', 'transactions', 'incentives', 'performance', 'rating'].includes(module) && <Text style={styles.disclaimerText}>Angka dan target adalah pratinjau UI, bukan data pendapatan atau performa resmi.</Text>}
    {module === 'academy' && <MenuRow module="help" onPress={onBack} />}
    {module === 'logout' && <Pressable style={styles.secondaryAction} onPress={onBack}><Text style={styles.secondaryActionText}>Batal</Text></Pressable>}
  </>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.emptyState}><View style={styles.emptyIcon}><AppIcon name="receipt" size={22} color={COLORS.primary} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{body}</Text></View>;
}

export function DriverHub({ tab, onTabChange, orders, queueOrders, queueLoading, queueError, selectedOrderId, driverName, onSelectOrder, onRefresh, children }: Props) {
  const [module, setModule] = useState<ModuleKey | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId), [orders, selectedOrderId]);

  const content = module
    ? <ModuleDetail module={module} orders={orders} onBack={() => setModule(null)} onOpenOrder={(id) => { onSelectOrder(id); setModule(null); onTabChange('tasks'); }} />
    : notice
      ? <>
        <View style={styles.detailTop}><Pressable onPress={() => setNotice(null)} style={styles.backButton} accessibilityLabel="Kembali ke notifikasi"><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.detailTopTitle}>Detail notifikasi</Text><View style={styles.backButton} /></View>
        <Card style={styles.noticeDetail}><Text style={styles.pageEyebrow}>PEMBARUAN DRIVER</Text><Text style={styles.pageTitle}>{notice.title}</Text><Text style={styles.pageDescription}>{notice.body}</Text></Card>
      </>
      : tab === 'home'
        ? <DriverHome driverName={driverName} orders={orders} queueOrders={queueOrders} queueLoading={queueLoading} queueError={queueError} onTabChange={onTabChange} openModule={setModule} />
        : tab === 'tasks'
          ? <>{children}</>
          : tab === 'income'
            ? <IncomePage orders={orders} openModule={setModule} />
            : tab === 'notifications'
              ? <NotificationsPage openDetail={(title, body) => setNotice({ title, body })} />
              : <AccountPage driverName={driverName} openModule={setModule} />;

  const heading = module ? MODULES[module].title
    : notice ? 'Detail notifikasi'
      : tab === 'home' ? 'Pusat Driver'
        : tab === 'tasks' ? 'Pesanan'
          : tab === 'income' ? 'Pendapatan'
            : tab === 'notifications' ? 'Notifikasi' : 'Akun Driver';

  return <View style={styles.root}>
    <View style={styles.topBar}>
      <View style={styles.brandMark}><AppIcon name="restaurant" size={18} color="#fff" /></View>
      <View style={styles.brandCopy}><Text style={styles.brandName}>Rasa<Text style={styles.brandOrange}>Lokal</Text></Text><Text style={styles.brandSub}>MITRA PENGANTARAN</Text></View>
      <Text style={styles.topBarTitle}>{heading}</Text>
      {tab === 'tasks' && !module && <Pressable onPress={onRefresh} style={styles.refreshButton} accessibilityLabel="Muat ulang tugas"><AppIcon name="notifications-outline" size={19} color={COLORS.primary} /></Pressable>}
    </View>
    {tab === 'tasks' && !module && selectedOrder && <View style={styles.activeOrderStrip}><View style={styles.liveDot} /><Text style={styles.activeOrderText}>TUGAS AKTIF · #{selectedOrder.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.activeOrderStatus}>{ORDER_STATUS_LABELS[selectedOrder.status]}</Text></View>}
    <ScrollView key={`${tab}-${module ?? ''}-${notice?.title ?? ''}`} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {content}
      <View style={styles.footerSpacer} />
    </ScrollView>
    {!module && !notice && <View style={styles.bottomNav}>{TAB_ITEMS.map((item) => {
      const active = item.key === tab;
      return <Pressable key={item.key} style={styles.navItem} onPress={() => onTabChange(item.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item.label}>
        <View style={[styles.navIconWrap, active && styles.navIconActive]}><AppIcon name={item.icon} size={19} color={active ? COLORS.primary : COLORS.muted} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
      </Pressable>;
    })}</View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F7' },
  topBar: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 9 },
  brandMark: { width: 35, height: 35, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  brandCopy: { gap: 1 },
  brandName: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  brandOrange: { color: COLORS.primary },
  brandSub: { fontSize: 7, fontWeight: '800', letterSpacing: 0.8, color: COLORS.secondaryText },
  topBarTitle: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '800', color: COLORS.secondaryText },
  refreshButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  activeOrderStrip: { minHeight: 34, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFF4EC' },
  activeOrderText: { fontSize: 8, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.4 },
  activeOrderStatus: { flex: 1, fontSize: 9, color: COLORS.secondaryText, textAlign: 'right' },
  content: { padding: 16, paddingBottom: 8, gap: 13, width: '100%', maxWidth: 620, alignSelf: 'center' },
  card: { padding: 14, borderRadius: 15, backgroundColor: '#fff', ...SHADOW },
  welcomeRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  welcomeCopy: { flex: 1, gap: 2 },
  greeting: { fontSize: 10, color: COLORS.secondaryText },
  driverName: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  driverId: { fontSize: 7, letterSpacing: 0.8, fontWeight: '800', color: COLORS.primary },
  bellButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellDot: { position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  onlineCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  statusOrb: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  statusOrbOnline: { backgroundColor: '#E8F7EF' },
  statusOrbCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.muted },
  statusOrbCoreOnline: { backgroundColor: COLORS.success },
  onlineCopy: { flex: 1, gap: 3 },
  onlineTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  onlineSub: { fontSize: 9, color: COLORS.secondaryText },
  map: { height: 180, borderRadius: 17, overflow: 'hidden', backgroundColor: '#E7EEE5', position: 'relative', borderWidth: 1, borderColor: '#D8E0D5' },
  road: { position: 'absolute', height: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DCE3D9' },
  roadOne: { width: '120%', top: 54, left: -20, transform: [{ rotate: '-13deg' }] },
  roadTwo: { width: '120%', top: 122, left: -25, transform: [{ rotate: '10deg' }] },
  roadThree: { width: '90%', top: 72, left: 86, transform: [{ rotate: '73deg' }] },
  roadFour: { width: '80%', top: 61, left: -55, transform: [{ rotate: '78deg' }] },
  park: { position: 'absolute', width: 75, height: 41, top: 14, right: 18, borderRadius: 12, backgroundColor: '#D4E8D0', alignItems: 'center', justifyContent: 'center' },
  parkText: { fontSize: 7, fontWeight: '900', color: '#54804C', letterSpacing: 0.5 },
  mapShop: { position: 'absolute', top: 91, left: 104, width: 25, height: 25, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  mapPin: { position: 'absolute', top: 70, left: '59%', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,90,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  mapPinCore: { width: 17, height: 17, borderRadius: 9, backgroundColor: COLORS.primary, borderWidth: 3, borderColor: '#fff' },
  mapCaption: { position: 'absolute', left: 10, bottom: 10, height: 29, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 5 },
  mapCaptionText: { fontSize: 8, fontWeight: '800', color: COLORS.text },
  gpsBadge: { position: 'absolute', right: 10, bottom: 10, height: 29, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 5 },
  gpsText: { fontSize: 7, fontWeight: '900', color: COLORS.success, letterSpacing: 0.5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  sectionHeading: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  textLink: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  previewBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: COLORS.orange50 },
  previewBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5, color: COLORS.primary },
  metricsCard: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricIcon: { width: 29, height: 29, borderRadius: 9, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  metricLabel: { fontSize: 8, color: COLORS.secondaryText, textAlign: 'center' },
  metricDivider: { width: 1, height: 39, backgroundColor: COLORS.border },
  shortcutGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 9 },
  shortcut: { flex: 1, minHeight: 72, paddingVertical: 9, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 6, ...SHADOW },
  shortcutIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 8, fontWeight: '800', color: COLORS.text },
  performanceCard: { gap: 8 },
  performanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  performanceEyebrow: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8, color: COLORS.secondaryText },
  performanceTitle: { marginTop: 4, fontSize: 11, fontWeight: '900', color: COLORS.text },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  ratingValue: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  ratingOutOf: { fontSize: 10, color: COLORS.secondaryText },
  ratingPill: { marginLeft: 6, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#EAF8EF' },
  ratingPillText: { fontSize: 8, fontWeight: '800', color: COLORS.success },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  progressFill: { height: '100%', width: '78%', borderRadius: 4, backgroundColor: COLORS.primary },
  progressCaption: { fontSize: 8, color: COLORS.secondaryText },
  inlineLink: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderPreview: { minHeight: 61, padding: 10, borderRadius: 13, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 9 },
  orderPreviewIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: 3 },
  menuTitle: { fontSize: 10, fontWeight: '800', color: COLORS.text },
  menuSubtitle: { fontSize: 8, lineHeight: 13, color: COLORS.secondaryText },
  emptyCard: { alignItems: 'center', gap: 6, paddingVertical: 18 },
  emptyTitle: { fontSize: 11, fontWeight: '900', color: COLORS.text },
  emptyText: { fontSize: 9, lineHeight: 15, textAlign: 'center', color: COLORS.secondaryText },
  pageHeading: { gap: 4, paddingTop: 3, paddingBottom: 3 },
  pageEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, color: COLORS.primary },
  pageTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  pageDescription: { fontSize: 10, lineHeight: 16, color: COLORS.secondaryText },
  walletHero: { backgroundColor: COLORS.primary, gap: 12 },
  walletHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7, color: 'rgba(255,255,255,0.85)' },
  walletValue: { marginTop: 5, fontSize: 24, fontWeight: '900', color: '#fff' },
  walletIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  walletNote: { fontSize: 8, color: 'rgba(255,255,255,0.85)' },
  walletDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  walletMetrics: { flexDirection: 'row', gap: 42 },
  walletSmallLabel: { fontSize: 8, color: 'rgba(255,255,255,0.8)' },
  walletSmallValue: { marginTop: 3, fontSize: 11, fontWeight: '900', color: '#fff' },
  chartCard: { gap: 12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 10, fontWeight: '900', color: COLORS.text },
  chartTrend: { padding: 6, borderRadius: 7, backgroundColor: '#EAF8EF', color: COLORS.success, fontSize: 8, fontWeight: '900' },
  chart: { height: 118, paddingTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', borderBottomWidth: 1, borderColor: COLORS.border },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  chartBar: { width: 16, borderRadius: 6, backgroundColor: '#FFD6C2' },
  chartBarActive: { backgroundColor: COLORS.primary },
  chartDay: { fontSize: 7, color: COLORS.secondaryText },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chartLegendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  listCard: { paddingVertical: 3 },
  menuRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#F3F3F3' },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  menuTrailing: { fontSize: 8, fontWeight: '800', color: COLORS.secondaryText },
  disclaimer: { padding: 11, borderRadius: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FFF4D8' },
  disclaimerText: { flex: 1, fontSize: 8, lineHeight: 14, color: '#754000' },
  filterRow: { flexDirection: 'row', gap: 7, paddingVertical: 2 },
  periodRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  filterChip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 9, fontWeight: '800', color: COLORS.secondaryText },
  filterTextActive: { color: '#fff' },
  notificationCard: { minHeight: 82, padding: 12, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'flex-start', gap: 10, ...SHADOW },
  notificationIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  notificationMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  notificationType: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6, color: COLORS.primary },
  notificationTime: { fontSize: 7, color: COLORS.muted },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileAvatar: { width: 49, height: 49, borderRadius: 16, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  activePill: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EAF8EF' },
  activePillText: { fontSize: 7, fontWeight: '900', color: COLORS.success },
  version: { marginTop: 4, textAlign: 'center', fontSize: 8, color: COLORS.muted },
  detailTop: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  detailTopTitle: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '900', color: COLORS.text },
  detailHero: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  detailHeroIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  detailRow: { minHeight: 44, justifyContent: 'center' },
  detailTitle: { fontSize: 10, fontWeight: '800', color: COLORS.text },
  detailBody: { marginHorizontal: 4, fontSize: 9, lineHeight: 15, color: COLORS.secondaryText },
  settingsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secondaryAction: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  secondaryActionText: { fontSize: 10, fontWeight: '800', color: COLORS.secondaryText },
  noticeDetail: { marginTop: 12, gap: 10 },
  historyRow: { minHeight: 70, padding: 11, borderRadius: 13, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 9 },
  historyIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  historyIconSuccess: { backgroundColor: '#EAF8EF' },
  orderEarning: { fontSize: 9, fontWeight: '900', color: COLORS.success },
  emptyState: { minHeight: 170, padding: 20, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  footerSpacer: { height: 8 },
  bottomNav: { minHeight: 67, paddingHorizontal: 5, paddingTop: 7, paddingBottom: 5, borderTopWidth: 1, borderTopColor: '#EEEEEE', backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navIconWrap: { minWidth: 43, height: 29, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: COLORS.orange50 },
  navLabel: { fontSize: 7, fontWeight: '700', color: COLORS.muted },
  navLabelActive: { color: COLORS.primary, fontWeight: '900' },
});
