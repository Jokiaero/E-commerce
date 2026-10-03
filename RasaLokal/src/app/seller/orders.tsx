import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';

type OrderStatus = 'Perlu diproses' | 'Diproses' | 'Dikirim' | 'Selesai' | 'Ditolak';
const initialOrders = [
  { id: 'RL-1024', customer: 'Nadia Putri', total: 70000, items: '2 Kapal Selam, 1 Tekwan', status: 'Perlu diproses' as OrderStatus },
  { id: 'RL-1023', customer: 'Rian Saputra', total: 36000, items: '2 Pempek Kulit', status: 'Perlu diproses' as OrderStatus },
  { id: 'RL-1022', customer: 'Dina Amelia', total: 25000, items: '1 Kapal Selam', status: 'Diproses' as OrderStatus },
];

export default function SellerOrdersScreen() {
  const router = useRouter();
  const [active, setActive] = useState<OrderStatus>('Perlu diproses');
  const [orders, setOrders] = useState(initialOrders);
  const visibleOrders = orders.filter((order) => order.status === active);
  const updateOrder = (id: string) => setOrders((current) => current.map((order) => order.id === id ? { ...order, status: 'Diproses' } : order));
  const rejectOrder = (id: string) => setOrders((current) => current.map((order) => order.id === id ? { ...order, status: 'Ditolak' } : order));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.title}>Pesanan Masuk</Text><View style={styles.backButton} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tabs}>
          {(['Perlu diproses', 'Diproses', 'Dikirim', 'Selesai'] as OrderStatus[]).map((status) => (
            <Pressable key={status} onPress={() => setActive(status)} style={[styles.tab, active === status && styles.tabActive]}><Text style={[styles.tabText, active === status && styles.tabTextActive]}>{status}</Text></Pressable>
          ))}
        </View>
        <View style={styles.list}>
          {visibleOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderTop}><Text style={styles.orderId}>{order.id}</Text><Text style={styles.orderTime}>Baru saja</Text></View>
              <Text style={styles.customer}>{order.customer}</Text><Text style={styles.items}>{order.items}</Text>
              <View style={styles.orderBottom}>
                <Text style={styles.total}>{rupiah(order.total)}</Text>
                {order.status === 'Perlu diproses' ? (
                  <View style={styles.actions}>
                    <Pressable onPress={() => rejectOrder(order.id)} style={styles.rejectButton}><Text style={styles.rejectText}>Tolak</Text></Pressable>
                    <Pressable onPress={() => updateOrder(order.id)} style={styles.confirmButton}><Text style={styles.confirmText}>Terima</Text></Pressable>
                  </View>
                ) : <View style={styles.processing}><Text style={styles.processingText}>{order.status}</Text></View>}
              </View>
            </View>
          ))}
          {visibleOrders.length === 0 && <View style={styles.empty}><AppIcon name="receipt" size={26} color={COLORS.muted} /><Text style={styles.emptyText}>Belum ada pesanan</Text></View>}
        </View>
      </ScrollView>
      <SellerBottomNav active="orders" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 17, fontWeight: '900', color: COLORS.text }, backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' }, content: { padding: 18, paddingTop: 0, paddingBottom: 28 }, tabs: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: '#F4F4F4' }, tab: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, tabActive: { backgroundColor: '#fff' }, tabText: { fontSize: 10, fontWeight: '700', color: COLORS.secondaryText }, tabTextActive: { color: COLORS.primary }, list: { marginTop: 14, gap: 11 }, orderCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', ...SHADOW }, orderTop: { flexDirection: 'row', justifyContent: 'space-between' }, orderId: { fontSize: 11, fontWeight: '900', color: COLORS.primary }, orderTime: { fontSize: 10, color: COLORS.muted }, customer: { marginTop: 9, fontSize: 14, fontWeight: '900', color: COLORS.text }, items: { marginTop: 4, fontSize: 11, color: COLORS.secondaryText }, orderBottom: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, total: { fontSize: 14, fontWeight: '900', color: COLORS.text }, actions: { flexDirection: 'row', gap: 7 }, rejectButton: { height: 34, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' }, rejectText: { fontSize: 10, fontWeight: '900', color: COLORS.danger }, confirmButton: { height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' }, confirmText: { fontSize: 10, fontWeight: '900', color: '#fff' }, processing: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#ECFDF3' }, processingText: { fontSize: 10, fontWeight: '800', color: COLORS.success }, empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center' }, emptyText: { marginTop: 8, fontSize: 12, fontWeight: '700', color: COLORS.secondaryText },
});
