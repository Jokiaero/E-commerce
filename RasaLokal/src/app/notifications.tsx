import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { useSafeBack } from '@/hooks/useSafeBack';
import { COLORS } from '@/constants/theme';
import { loadBuyerOrders, ORDER_STATUS_LABELS, type OrderStatus, type ShopOrder } from '@/lib/orderStorage';

const statusCopy: Record<OrderStatus, { title: string; detail: string; icon: string }> = {
  pending_payment: { title: 'Pesanan menunggu pembayaran', detail: 'Silakan selesaikan pembayaran sebelum pesanan diproses.', icon: 'receipt' },
  confirmed: { title: 'Pesanan dikonfirmasi', detail: 'Penjual sudah menerima pesananmu dan siap diproses.', icon: 'checkbox' },
  merchant_accepted: { title: 'Merchant menerima pesanan', detail: 'Pesananmu sedang diproses di toko.', icon: 'restaurant' },
  preparing: { title: 'Pesanan sedang disiapkan', detail: 'Penjual sedang menyiapkan pesananmu.', icon: 'restaurant' },
  ready_for_pickup: { title: 'Pesanan siap diambil', detail: 'Driver akan segera mengambil pesanan dari toko.', icon: 'bag-check' },
  driver_assigned: { title: 'Driver ditugaskan', detail: 'Driver sedang menyiapkan rute pengiriman.', icon: 'bicycle' },
  driver_going_to_merchant: { title: 'Driver menuju merchant', detail: 'Driver sedang menuju lokasi toko.', icon: 'bicycle' },
  driver_arrived_merchant: { title: 'Driver tiba di merchant', detail: 'Driver sudah sampai di lokasi toko.', icon: 'location' },
  picked_up: { title: 'Pesanan diambil driver', detail: 'Driver sudah membawa pesananmu untuk dikirim.', icon: 'bicycle' },
  driver_going_to_customer: { title: 'Driver menuju lokasi Anda', detail: 'Pesanan sedang dalam perjalanan ke alamatmu.', icon: 'bicycle' },
  driver_arrived: { title: 'Driver tiba di lokasi', detail: 'Driver sudah sampai dan siap mengantarkan pesanan.', icon: 'location' },
  delivered: { title: 'Pesanan diterima', detail: 'Pesanan telah sampai di tanganmu.', icon: 'checkmark-circle-outline' },
  completed: { title: 'Pesanan selesai', detail: 'Pesanan telah selesai. Terima kasih sudah berbelanja!', icon: 'checkmark-circle-outline' },
  cancelled: { title: 'Pesanan dibatalkan', detail: 'Pesanan tidak dapat diproses lebih lanjut.', icon: 'information-circle-outline' },
  payment_failed: { title: 'Pembayaran gagal', detail: 'Silakan mencoba metode pembayaran lain.', icon: 'information-circle-outline' },
  pending: { title: 'Pesanan menunggu konfirmasi', detail: 'Penjual akan segera memeriksa pesananmu.', icon: 'receipt' },
  accepted: { title: 'Pesanan diterima', detail: 'Penjual telah menerima pesananmu.', icon: 'checkbox' },
  processing: { title: 'Pesanan sedang diproses', detail: 'Pesananmu sedang disiapkan oleh penjual.', icon: 'restaurant' },
  shipped: { title: 'Pesanan sedang dikirim', detail: 'Pesananmu sedang dalam perjalanan.', icon: 'bicycle' },
  rejected: { title: 'Pesanan tidak dapat diproses', detail: 'Penjual belum dapat memenuhi pesanan ini.', icon: 'information-circle-outline' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const safeBack = useSafeBack('/(tabs)/orders');
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void loadBuyerOrders().then((loadedOrders) => {
      if (active) setOrders(loadedOrders);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Notifikasi tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={safeBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Kembali">
          <AppIcon name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Notifikasi</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Pembaruan pesanan</Text>
        {loading && <ActivityIndicator style={styles.loader} color={COLORS.primary} />}
        {!loading && orders.map((order) => {
          const notification = statusCopy[order.status];
          return (
            <Pressable
              key={order.id}
              style={styles.notification}
              onPress={() => router.push({ pathname: '/tracking', params: { id: order.id } } as any)}
              accessibilityRole="button"
              accessibilityLabel={`${notification.title}, pesanan ${order.id.slice(0, 8)}`}
            >
              <View style={styles.icon}>
                <AppIcon name={notification.icon} size={21} color={COLORS.primary} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.meta}>{ORDER_STATUS_LABELS[order.status]}</Text>
                <Text style={styles.detail}>{notification.detail}</Text>
                <Text style={styles.meta}>Pesanan #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString('id-ID')}</Text>
              </View>
              <AppIcon name="chevron-forward" size={17} color={COLORS.muted} />
            </Pressable>
          );
        })}
        {!loading && orders.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><AppIcon name="notifications-outline" size={27} color={COLORS.muted} /></View>
            <Text style={styles.emptyTitle}>Belum ada notifikasi</Text>
            <Text style={styles.emptyText}>Pembaruan pesananmu akan muncul di sini.</Text>
            <Pressable style={styles.action} onPress={() => router.replace('/(tabs)/orders' as any)}>
              <Text style={styles.actionText}>Lihat pesanan</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 62, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '900', color: COLORS.text },
  content: { padding: 18, paddingTop: 8, paddingBottom: 30 },
  heading: { marginBottom: 12, fontSize: 14, fontWeight: '900', color: COLORS.text },
  loader: { marginTop: 30 },
  notification: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  notificationTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  detail: { marginTop: 4, fontSize: 11, lineHeight: 16, color: COLORS.secondaryText },
  meta: { marginTop: 6, fontSize: 9, fontWeight: '700', color: COLORS.muted },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 24 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 14, fontSize: 15, fontWeight: '900', color: COLORS.text },
  emptyText: { marginTop: 6, fontSize: 12, color: COLORS.secondaryText, textAlign: 'center' },
  action: { marginTop: 18, minHeight: 42, paddingHorizontal: 18, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 12, fontWeight: '800', color: '#fff' },
});