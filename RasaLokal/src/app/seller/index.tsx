import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';

const shortcuts = [
  { title: 'Produk', icon: 'restaurant', route: '/seller/products' },
  { title: 'Pesanan', icon: 'receipt', route: '/seller/orders' },
  { title: 'Laporan', icon: 'wallet-outline', route: '/seller/reports' },
  { title: 'Pengaturan Toko', icon: 'business-outline', route: '/seller/register' },
];

export default function SellerDashboardScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Kembali" onPress={() => router.back()} style={styles.backButton}>
            <AppIcon name="chevron-back" size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Pusat Penjual</Text>
          <Pressable accessibilityLabel="Edit UMKM" onPress={() => router.push('/seller/register')} style={styles.backButton}>
            <AppIcon name="create-outline" size={20} color={COLORS.text} />
          </Pressable>
        </View>

        <View style={styles.storeCard}>
          <View style={styles.storeIcon}><AppIcon name="storefront" size={27} color="#fff" /></View>
          <View style={styles.storeCopy}>
            <Text style={styles.storeName}>Pempek Sari</Text>
            <View style={styles.openRow}><View style={styles.openDot} /><Text style={styles.openText}>Buka sekarang</Text></View>
          </View>
          <Pressable onPress={() => router.push('/seller/register')}><Text style={styles.editText}>Ubah</Text></Pressable>
        </View>

        <Text style={styles.sectionTitle}>Ringkasan hari ini</Text>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Penjualan</Text><Text style={styles.metricValue}>{rupiah(425000)}</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>Pesanan</Text><Text style={styles.metricValue}>12</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Kelola toko</Text>
        <View style={styles.shortcutList}>
          {shortcuts.map((item) => (
            <Pressable key={item.title} onPress={() => router.push(item.route as any)} style={styles.shortcut}>
              <View style={styles.shortcutIcon}><AppIcon name={item.icon} size={22} color={COLORS.primary} /></View>
              <Text style={styles.shortcutTitle}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <SellerBottomNav active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18, paddingBottom: 30 },
  header: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: COLORS.text },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' },
  storeCard: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: COLORS.orange50, flexDirection: 'row', alignItems: 'center' },
  storeIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  storeCopy: { flex: 1, marginLeft: 12 },
  storeName: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  openRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  openText: { fontSize: 11, fontWeight: '700', color: COLORS.success },
  editText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  sectionTitle: { marginTop: 24, fontSize: 15, fontWeight: '900', color: COLORS.text },
  metricRow: { marginTop: 11, flexDirection: 'row', gap: 11 },
  metricCard: { flex: 1, minHeight: 86, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', ...SHADOW },
  metricLabel: { fontSize: 11, color: COLORS.secondaryText },
  metricValue: { marginTop: 8, fontSize: 17, fontWeight: '900', color: COLORS.text },
  shortcutList: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: { width: '48.5%', minHeight: 92, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shortcutIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  shortcutTitle: { marginTop: 8, fontSize: 11, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
});
