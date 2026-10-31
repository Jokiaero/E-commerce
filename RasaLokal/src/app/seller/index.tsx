import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { loadSellerProducts, loadSellerStore, type CatalogProduct, type Store } from '@/lib/catalogStorage';
import { loadSellerOrders, type OrderStatus, type ShopOrder } from '@/lib/orderStorage';

const shortcuts = [
  { title: 'Produk', icon: 'restaurant', route: '/seller/products' },
  { title: 'Pesanan', icon: 'receipt', route: '/seller/orders' },
  { title: 'Laporan', icon: 'wallet-outline', route: '/seller/reports' },
  { title: 'Profil Toko', icon: 'business-outline', route: '/seller/store-profile' },
];

export default function SellerDashboardScreen() {
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void Promise.all([loadSellerStore(), loadSellerOrders(), loadSellerProducts()]).then(([loadedStore, loadedOrders, loadedProducts]) => {
      if (!active) return;
      setStore(loadedStore);
      setOrders(loadedOrders);
      setProducts(loadedProducts);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Data toko tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const today = new Date().toDateString();
  const pendingOrders = orders.filter((order) => ['pending_payment', 'confirmed', 'merchant_accepted', 'preparing', 'ready_for_pickup'].includes(order.status)).length;
  const completedToday = orders.filter((order) => order.status === 'completed' && new Date(order.createdAt).toDateString() === today);
  const salesToday = completedToday.reduce((sum, order) => sum + order.subtotal, 0);
  const recentOrders = orders.slice(0, 3);
  const statusLabels: Record<OrderStatus, string> = {
    pending_payment: 'Menunggu bayar',
    confirmed: 'Dikonfirmasi',
    merchant_accepted: 'Diterima',
    preparing: 'Disiapkan',
    ready_for_pickup: 'Siap diambil',
    driver_assigned: 'Driver ditugaskan',
    driver_going_to_merchant: 'Driver menuju toko',
    driver_arrived_merchant: 'Driver tiba',
    picked_up: 'Diambil driver',
    driver_going_to_customer: 'Menuju pembeli',
    driver_arrived: 'Tiba di tujuan',
    delivered: 'Dikirim',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    payment_failed: 'Pembayaran gagal',
    pending: 'Menunggu konfirmasi',
    accepted: 'Diterima',
    processing: 'Diproses',
    shipped: 'Dikirim',
    rejected: 'Ditolak',
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.headerTitle}>Pusat Penjual</Text><Text style={styles.headerSubtitle}>Ringkasan dan aktivitas toko</Text></View>
          <Pressable accessibilityLabel="Edit profil toko" onPress={() => router.push('/seller/register?edit=true' as any)} style={styles.settingsButton}>
            <AppIcon name="create-outline" size={19} color={COLORS.text} />
          </Pressable>
        </View>

        <Pressable style={styles.storeCard} onPress={() => router.push(store ? '/seller/store-profile' : '/seller/register')}>
          {store?.imageUrl ? <Image source={{ uri: store.imageUrl }} style={styles.storePhoto} /> : <View style={styles.storeIcon}><AppIcon name="storefront" size={27} color="#fff" /></View>}
          <View style={styles.storeCopy}>
            <Text style={styles.storeName}>{loading ? 'Memuat toko...' : store?.name ?? 'Toko belum terdaftar'}</Text>
            <View style={styles.openRow}><View style={[styles.openDot, (!store?.isOpen || !store) && styles.closedDot]} /><Text style={[styles.openText, (!store?.isOpen || !store) && styles.closedText]}>{store ? store.isOpen ? 'Menerima pesanan' : 'Toko sementara tutup' : 'Ketuk untuk melengkapi profil'}</Text></View>
          </View>
          <AppIcon name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Ringkasan</Text><Text style={styles.sectionMeta}>Hari ini</Text></View>
        <View style={styles.metricRow}>
          <Pressable style={styles.metricCard} onPress={() => router.push('/seller/orders')}>
            <View style={styles.metricIcon}><AppIcon name="receipt" size={18} color={COLORS.primary} /></View>
            <Text style={styles.metricLabel}>Pesanan baru</Text><Text style={styles.metricValue}>{loading ? '—' : pendingOrders}</Text>
          </Pressable>
          <View style={styles.metricCard}>
            <View style={styles.metricIcon}><AppIcon name="wallet-outline" size={18} color={COLORS.success} /></View>
            <Text style={styles.metricLabel}>Penjualan selesai</Text><Text style={styles.metricValue}>{loading ? '—' : rupiah(salesToday)}</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Kelola toko</Text><Text style={styles.sectionMeta}>{loading ? '—' : `${products.filter((product) => product.isAvailable).length} produk aktif`}</Text></View>
        <View style={styles.shortcutList}>
          {shortcuts.map((item) => (
            <Pressable key={item.title} onPress={() => router.push(item.route as any)} style={styles.shortcut}>
              <View style={styles.shortcutIcon}><AppIcon name={item.icon} size={22} color={COLORS.primary} /></View>
              <Text style={styles.shortcutTitle}>{item.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Pesanan terbaru</Text><Pressable onPress={() => router.push('/seller/orders')}><Text style={styles.seeAll}>Lihat semua</Text></Pressable></View>
        {loading ? <ActivityIndicator style={styles.loader} color={COLORS.primary} /> : recentOrders.length > 0 ? recentOrders.map((order) => (
          <Pressable key={order.id} style={styles.recentOrder} onPress={() => router.push('/seller/orders')}>
            <View style={styles.recentIcon}><AppIcon name="receipt" size={18} color={COLORS.primary} /></View>
            <View style={styles.recentCopy}>
              <Text style={styles.recentName}>{order.customerName}</Text>
              <Text style={styles.recentDetail} numberOfLines={1}>{order.items.map((item) => `${item.quantity} ${item.name}`).join(', ')}</Text>
            </View>
            <View style={styles.recentRight}><Text style={styles.recentAmount}>{rupiah(order.total)}</Text><Text style={styles.recentStatus}>{statusLabels[order.status]}</Text></View>
          </Pressable>
        )) : <View style={styles.emptyOrders}><AppIcon name="receipt" size={22} color={COLORS.muted} /><Text style={styles.emptyText}>Pesanan toko akan muncul di sini.</Text></View>}
      </ScrollView>
      <SellerBottomNav active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 17, paddingBottom: 28 },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  headerSubtitle: { marginTop: 3, fontSize: 11, color: COLORS.secondaryText },
  settingsButton: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center' },
  storeCard: { marginTop: 17, minHeight: 82, padding: 13, borderRadius: 13, backgroundColor: COLORS.orange50, flexDirection: 'row', alignItems: 'center' },
  storeIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  storePhoto: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#F4F4F4' },
  storeCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  storeName: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  openRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  openText: { fontSize: 11, fontWeight: '700', color: COLORS.success },
  closedDot: { backgroundColor: COLORS.muted },
  closedText: { color: COLORS.muted },
  sectionHeading: { marginTop: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  sectionMeta: { fontSize: 10, color: COLORS.secondaryText },
  metricRow: { marginTop: 10, flexDirection: 'row', gap: 9 },
  metricCard: { flex: 1, minHeight: 116, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', ...SHADOW },
  metricIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { marginTop: 9, fontSize: 10, color: COLORS.secondaryText },
  metricValue: { marginTop: 4, fontSize: 15, fontWeight: '900', color: COLORS.text },
  shortcutList: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: { width: '48.5%', minHeight: 76, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 9 },
  shortcutIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  shortcutTitle: { flex: 1, fontSize: 11, fontWeight: '800', color: COLORS.text },
  seeAll: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  recentOrder: { minHeight: 66, marginTop: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  recentIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  recentCopy: { flex: 1, minWidth: 0 },
  recentName: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  recentDetail: { marginTop: 3, fontSize: 9, color: COLORS.secondaryText },
  recentRight: { alignItems: 'flex-end' },
  recentAmount: { fontSize: 10, fontWeight: '900', color: COLORS.text },
  recentStatus: { marginTop: 4, fontSize: 9, fontWeight: '700', color: COLORS.primary },
  loader: { marginTop: 20 },
  emptyOrders: { minHeight: 96, marginTop: 8, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { fontSize: 10, color: COLORS.secondaryText },
});
