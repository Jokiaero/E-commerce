import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { loadSellerOrders, type ShopOrder } from '@/lib/orderStorage';

const periods = ['Hari ini', '7 hari', '30 hari'];

export default function SellerReportsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('Hari ini');
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void loadSellerOrders().then((loadedOrders) => {
      if (active) setOrders(loadedOrders);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Laporan tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const days = period === 'Hari ini' ? 1 : period === '7 hari' ? 7 : 30;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days + 1);
  periodStart.setHours(0, 0, 0, 0);
  const completedOrders = orders.filter((order) => order.status === 'completed' && new Date(order.createdAt) >= periodStart);
  const sales = completedOrders.reduce((sum, order) => sum + order.subtotal, 0);
  const average = completedOrders.length ? Math.round(sales / completedOrders.length) : 0;
  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const value = orders.filter((order) => order.status === 'completed' && new Date(order.createdAt).toDateString() === date.toDateString())
      .reduce((sum, order) => sum + order.subtotal, 0);
    return { label: date.toLocaleDateString('id-ID', { weekday: 'short' }), value };
  });
  const maxDailySales = Math.max(1, ...dailySales.map((item) => item.value));
  const productSales = new Map<string, number>();
  for (const order of completedOrders) {
    for (const item of order.items) productSales.set(item.name, (productSales.get(item.name) ?? 0) + item.quantity);
  }
  const bestSellers = [...productSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.replace('/seller')} style={styles.backButton} accessibilityLabel="Kembali ke Pusat Penjual"><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.title}>Laporan UMKM</Text><View style={styles.backButton} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.periodRow}>{periods.map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={[styles.period, period === item && styles.periodActive]}><Text style={[styles.periodText, period === item && styles.periodTextActive]}>{item}</Text></Pressable>)}</View>
        {loading && <ActivityIndicator style={{ marginTop: 25 }} color={COLORS.primary} />}
        {!loading && <>
        <View style={styles.salesCard}><Text style={styles.salesLabel}>Total penjualan selesai</Text><Text style={styles.salesValue}>{rupiah(sales)}</Text><Text style={styles.salesNote}>Periode {period.toLowerCase()}</Text></View>
        <View style={styles.summaryRow}><View style={styles.summaryCard}><Text style={styles.summaryLabel}>Pesanan selesai</Text><Text style={styles.summaryValue}>{completedOrders.length}</Text></View><View style={styles.summaryCard}><Text style={styles.summaryLabel}>Rata-rata transaksi</Text><Text style={styles.summaryValue}>{rupiah(average)}</Text></View></View>
        <Text style={styles.sectionTitle}>Penjualan per hari</Text>
        <View style={styles.chartCard}>
          <View style={styles.bars}>{dailySales.map((item) => <View key={item.label} style={styles.barWrap}><View style={[styles.bar, { height: `${Math.max(8, item.value / maxDailySales * 100)}%` }]} /><Text style={styles.day}>{item.label}</Text></View>)}</View>
        </View>
        <Text style={styles.sectionTitle}>Produk terlaris</Text>
        {bestSellers.map(([name, quantity], index) => <View key={name} style={styles.rankRow}><Text style={styles.rank}>{index + 1}</Text><Text style={styles.productName}>{name}</Text><Text style={styles.sold}>{quantity} terjual</Text></View>)}
        {bestSellers.length === 0 && <Text style={styles.salesNote}>Belum ada pesanan selesai pada periode ini.</Text>}
        </>}
      </ScrollView>
      <SellerBottomNav active="reports" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 17, fontWeight: '900', color: COLORS.text }, backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' }, content: { padding: 18, paddingTop: 0, paddingBottom: 30 }, periodRow: { flexDirection: 'row', gap: 8 }, period: { flex: 1, height: 36, borderRadius: 11, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' }, periodActive: { backgroundColor: COLORS.primary }, periodText: { fontSize: 11, fontWeight: '800', color: COLORS.secondaryText }, periodTextActive: { color: '#fff' }, salesCard: { marginTop: 16, borderRadius: 18, backgroundColor: COLORS.orange50, padding: 18 }, salesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.secondaryText }, salesValue: { marginTop: 7, fontSize: 26, fontWeight: '900', color: COLORS.text }, salesNote: { marginTop: 4, fontSize: 10, color: COLORS.secondaryText }, summaryRow: { marginTop: 11, flexDirection: 'row', gap: 11 }, summaryCard: { flex: 1, minHeight: 82, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border }, summaryLabel: { fontSize: 10, lineHeight: 14, color: COLORS.secondaryText }, summaryValue: { marginTop: 7, fontSize: 15, fontWeight: '900', color: COLORS.text }, sectionTitle: { marginTop: 24, fontSize: 15, fontWeight: '900', color: COLORS.text }, chartCard: { marginTop: 10, height: 190, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border }, bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, barWrap: { width: 28, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }, bar: { width: 18, minHeight: 12, borderRadius: 8, backgroundColor: COLORS.primary }, day: { marginTop: 8, fontSize: 9, color: COLORS.secondaryText }, rankRow: { marginTop: 10, height: 56, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center' }, rank: { width: 27, fontSize: 13, fontWeight: '900', color: COLORS.primary }, productName: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.text }, sold: { fontSize: 10, color: COLORS.secondaryText },
});
