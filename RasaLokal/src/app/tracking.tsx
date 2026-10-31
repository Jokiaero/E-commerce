import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { TopHeader } from '@/components/TopHeader';
import { observeOrders, ORDER_STATUS_LABELS, type ShopOrder } from '@/lib/orderStorage';
import { distanceMeters, getTrackingStage, isFreshDriverLocation, TRACKING_STEPS } from '@/lib/deliveryTracking';
import DriverLocationMap from '@/components/DriverLocationMap';

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    setLoading(true);
    return observeOrders('buyer', (loadedOrders) => {
      setOrders(loadedOrders);
      setLoading(false);
      setError('');
    }, () => { setLoading(false); setError('Pembaruan pesanan belum dapat dimuat. Mencoba menghubungkan kembali.'); }, orderId);
  }, [orderId]));

  const order = orderId ? orders.find((item) => item.id === orderId) : orders[0];
  const currentStage = order ? getTrackingStage(order.status) : null;
  const driver = order?.driver;
  const freshLocation = driver && isFreshDriverLocation(driver.recordedAt);
  const destinationDistance = driver?.coordinate && driver.destination ? distanceMeters(driver.coordinate, driver.destination) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopHeader title="Detail Pesanan" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator style={styles.loader} color={COLORS.primary} />}
        {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        {!loading && order && <>
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}><AppIcon name={order.status === 'cancelled' || order.status === 'payment_failed' ? 'information-circle-outline' : 'checkmark-circle-outline'} size={28} color={order.status === 'cancelled' || order.status === 'payment_failed' ? COLORS.danger : COLORS.success} /></View>
            <View style={styles.statusCopy}><Text style={styles.statusTitle}>{ORDER_STATUS_LABELS[order.status]}</Text><Text style={styles.statusText}>Pesanan #{order.id.slice(0, 8).toUpperCase()}</Text></View>
          </View>
          {order.paymentMethod !== 'cod' && order.paymentStatus !== 'success'
            && !['cancelled', 'payment_failed', 'rejected', 'completed', 'delivered'].includes(order.status) && (
              <Pressable
                style={styles.payButton}
                onPress={() => router.push({ pathname: '/payment', params: { orderIds: JSON.stringify([order.id]) } } as any)}
                accessibilityRole="button"
              >
                <Text style={styles.payButtonText}>Lanjutkan pembayaran</Text>
                <AppIcon name="arrow-forward" size={17} color="#fff" />
              </Pressable>
            )}
          {currentStage !== null && (
            <View style={styles.stepsCard}>
              <View style={styles.stepsRow}>
                {TRACKING_STEPS.map((step, index) => {
                  const active = index <= currentStage;
                  return <View key={step.label} style={styles.stepWrap} accessible accessibilityLabel={`${step.label}, ${index === currentStage ? 'tahap saat ini' : index < currentStage ? 'sudah dilalui' : 'belum dimulai'}`} accessibilityState={{ selected: index === currentStage }}>
                    <Text style={[styles.stepLabel, active && styles.stepActiveText]}>{step.label}</Text>
                    <View style={[styles.stepDot, active && styles.stepDotActive]} />
                    {index < TRACKING_STEPS.length - 1 ? <View style={[styles.stepLine, index < currentStage && styles.stepLineActive]} /> : null}
                  </View>;
                })}
              </View>
            </View>
          )}
          <View style={styles.driverCard}>
            <Text style={styles.orderTitle}>Pelacakan driver</Text>
            <Text style={styles.driverDescription}>{order.status === 'completed' ? 'Pengiriman selesai.' : order.status === 'cancelled' || order.status === 'payment_failed' ? 'Pengiriman tidak dilanjutkan.' : 'Status perjalanan diperbarui otomatis dari lokasi dan aktivitas driver.'}</Text>
            {driver ? <>
              <Text style={styles.driverName}>{driver.name}{driver.vehicle ? ` · ${driver.vehicle}` : ''}</Text>
              {driver.phone !== '' && <Text style={styles.statusText}>{driver.phone}</Text>}
              {driver.coordinate ? <>
                <Text style={[styles.locationState, !freshLocation && styles.locationStale]}>{freshLocation ? 'Lokasi driver diperbarui' : 'Lokasi terakhir · menunggu pembaruan GPS'}</Text>
                <DriverLocationMap driver={driver} />
                {driver.recordedAt && <Text style={styles.statusText}>Pembaruan terakhir {new Date(driver.recordedAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</Text>}
                {destinationDistance !== null && <Text style={styles.statusText}>Jarak lurus ke alamat pengiriman: {destinationDistance < 1000 ? `${Math.round(destinationDistance)} m` : `${(destinationDistance / 1000).toFixed(1)} km`}</Text>}
              </> : <Text style={styles.statusText}>Driver sudah ditugaskan. Menunggu lokasi GPS pertama.</Text>}
            </> : <Text style={styles.statusText}>{order.status === 'ready_for_pickup' ? 'Pesanan siap. Menunggu penugasan driver.' : 'Lokasi akan muncul setelah driver ditugaskan dan mulai berbagi GPS.'}</Text>}
          </View>
          <View style={styles.orderCard}>
            <Text style={styles.orderTitle}>Rincian pesanan</Text>
            {order.items.map((item, index) => <View key={`${item.name}-${index}`} style={styles.orderItem}>
              <View style={styles.orderInfo}><Text style={styles.orderName}>{item.name}{item.variant ? ` · ${item.variant}` : ''}</Text><Text style={styles.orderQty}>{item.quantity} x {rupiah(item.unitPrice)}</Text></View>
              <Text style={styles.orderPrice}>{rupiah(item.unitPrice * item.quantity)}</Text>
            </View>)}
            <Text style={styles.statusText}>Alamat: {order.deliveryAddress}</Text>
            <View style={styles.divider} />
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.orderPrice}>{rupiah(order.subtotal)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Ongkos kirim</Text><Text style={styles.orderPrice}>{rupiah(order.shippingFee)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Biaya layanan</Text><Text style={styles.orderPrice}>{rupiah(order.serviceFee)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Diskon</Text><Text style={styles.orderPrice}>- {rupiah(order.discountAmount)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total pembayaran</Text><Text style={styles.total}>{rupiah(order.total)}</Text></View>
          </View>
        </>}
        {!loading && !order && !error && <View style={styles.statusCard}><Text style={styles.statusText}>{orderId ? 'Pesanan tidak ditemukan atau tidak dapat diakses oleh akun ini.' : 'Belum ada pesanan untuk ditampilkan.'}</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { paddingHorizontal: 16, paddingBottom: 26, gap: 12 },
  loader: { marginTop: 40 },
  statusCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, ...SHADOW },
  statusIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EAF8EF', alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  statusText: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText },
  payButton: { minHeight: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  payButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepsCard: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 18, ...SHADOW },
  stepsRow: { flexDirection: 'row' },
  stepWrap: { flex: 1, minWidth: 0, alignItems: 'center', position: 'relative' },
  stepLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: COLORS.secondaryText, textAlign: 'center' },
  stepActiveText: { color: COLORS.primary },
  stepDot: { marginTop: 8, width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#fff', backgroundColor: '#D5D5D5', zIndex: 2 },
  stepDotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.orange100 },
  stepLine: { position: 'absolute', height: 2, backgroundColor: '#E5E5E5', left: '50%', right: '-50%', bottom: 6 },
  stepLineActive: { backgroundColor: COLORS.primary },
  driverCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, ...SHADOW },
  driverDescription: { fontSize: 12, lineHeight: 18, color: COLORS.secondaryText },
  driverName: { marginTop: 12, fontSize: 14, fontWeight: '800', color: COLORS.text },
  locationState: { marginVertical: 10, fontSize: 11, fontWeight: '700', color: COLORS.success },
  locationStale: { color: COLORS.secondaryText },
  error: { padding: 12, color: COLORS.danger, fontSize: 12 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, ...SHADOW },
  orderTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  orderItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  orderInfo: { flex: 1, marginLeft: 9 },
  orderName: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  orderQty: { marginTop: 2, fontSize: 9, color: COLORS.muted },
  orderPrice: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginVertical: 9 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  total: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
});
