import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { getNextMerchantStatus, observeOrders, ORDER_STATUS_LABELS, updateSellerOrderStatus, type OrderStatus, type ShopOrder } from '@/lib/orderStorage';
import { SHIPPING_STATUSES } from '@/lib/deliveryTracking';

const orderStatuses: { value: OrderStatus; label: string }[] = [
  { value: 'pending_payment', label: 'Menunggu bayar' },
  { value: 'confirmed', label: 'Dikonfirmasi' },
  { value: 'merchant_accepted', label: 'Diterima' },
  { value: 'preparing', label: 'Diproses' },
  { value: 'ready_for_pickup', label: 'Siap ambil' },
  { value: 'driver_going_to_customer', label: 'Pengiriman' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

export default function SellerOrdersScreen() {
  const router = useRouter();
  const [active, setActive] = useState<OrderStatus>('pending_payment');
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const visibleOrders = orders.filter((order) => active === 'driver_going_to_customer'
    ? (SHIPPING_STATUSES as readonly string[]).includes(order.status) : order.status === active);

  useFocusEffect(useCallback(() => {
    return observeOrders('seller', setOrders, (error: unknown) => {
      Alert.alert('Pesanan tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi.');
    });
  }, []));

  const updateOrder = async (orderId: string, status: OrderStatus) => {
    try {
      await updateSellerOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
    } catch (error) {
      Alert.alert('Status pesanan tidak dapat diubah', error instanceof Error ? error.message : 'Silakan coba lagi.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.replace('/seller')} style={styles.backButton} accessibilityLabel="Kembali ke Pusat Penjual"><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.title}>Pesanan Masuk</Text><View style={styles.backButton} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {orderStatuses.map(({ value, label }) => (
            <Pressable key={value} onPress={() => setActive(value)} style={[styles.tab, { minWidth: 92, flexGrow: 0, flexShrink: 0 }, active === value && styles.tabActive]}><Text style={[styles.tabText, active === value && styles.tabTextActive]}>{label}</Text></Pressable>
          ))}
        </ScrollView>
        <View style={styles.list}>
          {visibleOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderTop}><Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.orderTime}>{new Date(order.createdAt).toLocaleString('id-ID')}</Text></View>
              <Text style={styles.customer}>{order.customerName}</Text>
              <Text style={styles.items}>{order.items.map((item) => `${item.quantity} ${item.name}${item.variant ? ` (${item.variant})` : ''}`).join(', ')}</Text>
              <Text style={styles.items}>{order.customerPhone} · {order.deliveryAddress}</Text>
              <View style={styles.orderBottom}>
                <Text style={styles.total}>{rupiah(order.total)}</Text>
                {order.status === 'cancelled' || order.status === 'payment_failed' ? (
                  <View style={styles.processing}><Text style={styles.processingText}>{orderStatuses.find((item) => item.value === order.status)?.label ?? 'Status'}</Text></View>
                ) : (() => {
                  const nextStatus = getNextMerchantStatus(order.status);
                  if (!nextStatus) {
                    return <View style={styles.processing}><Text style={styles.processingText}>{ORDER_STATUS_LABELS[order.status]}</Text></View>;
                  }
                  return <Pressable onPress={() => void updateOrder(order.id, nextStatus)} style={styles.confirmButton} accessibilityRole="button"><Text style={styles.confirmText}>{nextStatus === 'merchant_accepted' ? 'Terima' : nextStatus === 'preparing' ? 'Siapkan' : 'Siap diambil'}</Text></Pressable>;
                })()}
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
