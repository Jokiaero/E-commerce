import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { observeOrders, ORDER_STATUS_LABELS, type ShopOrder } from '@/lib/orderStorage';

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    return observeOrders('buyer', (loadedOrders) => { setOrders(loadedOrders); setLoading(false); }, (error: unknown) => {
      setLoading(false);
      Alert.alert('Pesanan tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi.');
    });
  }, []));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Pesanan Saya</Text>
        {loading && <ActivityIndicator style={styles.loader} color={COLORS.primary} />}
        {!loading && orders.map((order) => (
          <Pressable key={order.id} style={styles.card} onPress={() => router.push({ pathname: '/tracking', params: { id: order.id } } as any)}>
            <View style={styles.icon}><AppIcon name="bag-check" size={24} color={COLORS.primary} /></View>
            <View style={styles.info}>
              <Text style={styles.orderNo}>Pesanan #{order.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.status}>{ORDER_STATUS_LABELS[order.status]}</Text>
              <Text style={styles.detail}>{order.items.map((item) => `${item.quantity} ${item.name}`).join(', ')}</Text>
              <Text style={styles.detail}>{new Date(order.createdAt).toLocaleDateString('id-ID')} · {rupiah(order.total)}</Text>
            </View>
          </Pressable>
        ))}
        {!loading && orders.length === 0 && <View style={styles.empty}><AppIcon name="receipt" size={28} color={COLORS.muted} /><Text style={styles.emptyText}>Belum ada pesanan</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18, gap: 12 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text, marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 17, padding: 14, ...SHADOW },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12 },
  orderNo: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  status: { marginTop: 3, fontSize: 11, fontWeight: '800', color: COLORS.primary },
  detail: { marginTop: 5, fontSize: 10, color: COLORS.secondaryText },
  loader: { marginTop: 30 },
  empty: { alignItems: 'center', gap: 9, paddingVertical: 45 },
  emptyText: { fontSize: 12, color: COLORS.secondaryText },
});
