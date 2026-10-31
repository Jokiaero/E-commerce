import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { TopHeader } from '@/components/TopHeader';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { completeSimulatedPayment, observeOrders, type ShopOrder } from '@/lib/orderStorage';

const DEMO_CHANNELS = {
  bank: [
    { id: 'bca', name: 'BCA Virtual Account', detail: 'Transfer bank · Simulasi' },
    { id: 'bni', name: 'BNI Virtual Account', detail: 'Transfer bank · Simulasi' },
    { id: 'bri', name: 'BRI Virtual Account', detail: 'Transfer bank · Simulasi' },
  ],
  wallet: [
    { id: 'gopay', name: 'GoPay', detail: 'E-wallet · Simulasi' },
    { id: 'dana', name: 'DANA', detail: 'E-wallet · Simulasi' },
    { id: 'ovo', name: 'OVO', detail: 'E-wallet · Simulasi' },
  ],
} as const;

function readOrderIds(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [raw];
  }
  return [];
}

export default function PaymentScreen() {
  const params = useLocalSearchParams<{ orderIds?: string | string[] }>();
  const router = useRouter();
  const orderIds = readOrderIds(params.orderIds);
  const orderIdsKey = orderIds.join(',');
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  useFocusEffect(useCallback(() => {
    setLoading(true);
    const requestedIds = orderIdsKey.split(',').filter(Boolean);
    if (requestedIds.length === 0) {
      setLoading(false);
      setError('Daftar pesanan pembayaran tidak valid. Buka kembali pembayaran dari halaman pesanan.');
      return;
    }
    return observeOrders('buyer', (loadedOrders) => {
      setOrders(loadedOrders.filter((order) => requestedIds.includes(order.id)));
      setLoading(false);
      setError('');
    }, () => {
      setLoading(false);
      setError('Rincian pembayaran belum dapat dimuat. Periksa koneksi lalu coba lagi.');
    });
  }, [orderIdsKey]));

  const selectedOrders = orders.length === orderIds.length;
  const paid = selectedOrders && orders.every((order) => order.paymentStatus === 'success');
  const canPay = selectedOrders && orders.every((order) =>
    ['pending', 'processing', 'failed'].includes(order.paymentStatus)
      && !['cancelled', 'payment_failed', 'rejected', 'completed', 'delivered'].includes(order.status),
  );
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const paymentMethod = orders[0]?.paymentMethod === 'wallet' ? 'wallet' : 'bank';
  const channels = DEMO_CHANNELS[paymentMethod];
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? channels[0];

  const pay = async () => {
    if (submitting || !canPay) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (!selectedChannel) throw new Error('Pilih kanal pembayaran demo terlebih dahulu.');
      await completeSimulatedPayment(orderIds, selectedChannel.id);
      setMessage('Pembayaran simulasi berhasil dicatat. Tidak ada uang sungguhan yang dipindahkan.');
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Simulasi pembayaran belum dapat diselesaikan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const openTracking = () => {
    if (orderIds[0]) router.replace({ pathname: '/tracking', params: { id: orderIds[0] } } as never);
  };
  const cancelPayment = () => {
    if (orderIds[0]) router.replace({ pathname: '/tracking', params: { id: orderIds[0] } } as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopHeader title="Pembayaran" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.demoBanner}>
          <AppIcon name="information-circle-outline" size={19} color="#8A4B08" />
          <View style={styles.flex}>
            <Text style={styles.demoTitle}>MODE DEMO / SIMULASI</Text>
            <Text style={styles.demoText}>Tidak terhubung ke bank atau e-wallet. Jangan transfer uang sungguhan.</Text>
          </View>
        </View>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><AppIcon name={paid ? 'checkmark-circle-outline' : 'card-outline'} size={25} color={paid ? COLORS.success : COLORS.primary} /></View>
          <Text style={styles.title}>{paid ? 'Pembayaran simulasi berhasil' : 'Gateway pembayaran demo'}</Text>
          <Text style={styles.body}>{paid
            ? 'Pesanan ditandai lunas untuk keperluan demonstrasi. Tidak ada dana yang diproses.'
            : 'Pilih kanal pembayaran demo, lalu konfirmasikan simulasi untuk melanjutkan status pesanan.'}</Text>
        </View>

        {!paid && <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pilih kanal pembayaran demo</Text>
          {channels.map((channel) => {
            const active = (selectedChannel?.id ?? '') === channel.id;
            return <Pressable key={channel.id} style={[styles.channelRow, active && styles.channelActive]} onPress={() => setSelectedChannelId(channel.id)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              <View style={styles.flex}>
                <Text style={styles.orderTitle}>{channel.name}</Text>
                <Text style={styles.orderStatus}>{channel.detail}</Text>
              </View>
              <AppIcon name={active ? 'radio-button-on' : 'radio-button-off'} size={21} color={active ? COLORS.primary : COLORS.muted} />
            </Pressable>;
          })}
        </View>}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rincian pesanan</Text>
          {loading && <ActivityIndicator color={COLORS.primary} />}
          {!loading && selectedOrders && orders.map((order) => (
            <View key={order.id} style={styles.orderRow}>
              <View style={styles.flex}>
                <Text style={styles.orderTitle}>Pesanan #{order.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.orderStatus}>{order.paymentStatus === 'success' ? `Lunas${order.paymentProvider === 'simulation' ? ` · Simulasi ${order.paymentChannel?.toUpperCase() ?? ''}` : ''}` : order.paymentStatus === 'processing' ? 'Menunggu konfirmasi' : 'Belum dibayar'}</Text>
              </View>
              <Text style={styles.amount}>{rupiah(order.total)}</Text>
            </View>
          ))}
          {!loading && !selectedOrders && error === '' && <Text style={styles.body}>Pesanan tidak ditemukan atau tidak dapat diakses.</Text>}
          <View style={styles.divider} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total pembayaran</Text><Text style={styles.total}>{rupiah(total)}</Text></View>
        </View>

        {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        {message !== '' && <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text>}

        {!paid && <Pressable style={[styles.payButton, (!canPay || submitting || loading) && styles.disabled]} onPress={() => void pay()} disabled={!canPay || submitting || loading} accessibilityRole="button">
          <Text style={styles.payButtonText}>{submitting ? 'Menyelesaikan simulasi...' : `Simulasikan pembayaran${selectedChannel ? ` · ${selectedChannel.name}` : ''}`}</Text>
          {!submitting && <AppIcon name="arrow-forward" size={18} color="#fff" />}
        </Pressable>}
        {paid && <Pressable style={styles.payButton} onPress={openTracking} accessibilityRole="button">
          <Text style={styles.payButtonText}>Lihat status pesanan</Text><AppIcon name="arrow-forward" size={18} color="#fff" />
        </Pressable>}
        {!paid && <Pressable style={styles.cancelButton} onPress={cancelPayment} accessibilityRole="button">
          <Text style={styles.cancelText}>Batalkan dan kembali ke pesanan</Text>
        </Pressable>}
        <Text style={styles.disclaimer}>SIMULASI AKADEMIK — konfirmasi hanya mengubah status demo di database, bukan bukti transfer atau pembayaran sungguhan.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 18, paddingBottom: 30, gap: 14, width: '100%', maxWidth: 620, alignSelf: 'center' },
  hero: { alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: '#FFF0E5', gap: 9 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  demoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 12, backgroundColor: '#FFF4D8', borderWidth: 1, borderColor: '#F3D28B' },
  demoTitle: { fontSize: 11, fontWeight: '900', color: '#754000' },
  demoText: { marginTop: 3, fontSize: 10, lineHeight: 15, color: '#754000' },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  body: { fontSize: 12, lineHeight: 19, textAlign: 'center', color: COLORS.secondaryText },
  card: { padding: 15, borderRadius: 16, backgroundColor: '#fff', gap: 12, ...SHADOW },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  orderTitle: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  orderStatus: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText },
  channelRow: { minHeight: 58, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelActive: { borderColor: COLORS.primary, backgroundColor: COLORS.orange50 },
  amount: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  total: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  error: { padding: 12, borderRadius: 10, backgroundColor: '#FFF0E5', color: COLORS.danger, fontSize: 12 },
  message: { padding: 12, borderRadius: 10, backgroundColor: '#EAF8EF', color: COLORS.success, fontSize: 12, lineHeight: 18 },
  payButton: { minHeight: 50, paddingHorizontal: 16, borderRadius: 13, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: COLORS.secondaryText, fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  disclaimer: { fontSize: 10, lineHeight: 16, color: COLORS.secondaryText, textAlign: 'center' },
});
