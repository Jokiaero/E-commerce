import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { cartItems, rupiah } from '@/constants/data';
import { QuantityControl } from '@/components/QuantityControl';

export default function CartScreen() {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({ '1': 1, '2': 1, '3': 1, '4': 1 });
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * (qty[item.id] ?? 1), 0), [qty]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Keranjang ({cartItems.length})</Text>
        <Text style={styles.edit}>Ubah</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.selectAll}>
          <AppIcon name="checkbox" size={21} color={COLORS.primary} />
          <Text style={styles.selectText}>Pilih Semua</Text>
        </View>
        {cartItems.map((item) => (
          <View key={item.id} style={styles.item}>
            <AppIcon name="checkbox" size={20} color={COLORS.primary} />
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.merchant}>{item.merchant}</Text>
              <Text style={styles.price}>{rupiah(item.price)}</Text>
              <View style={styles.quantityWrap}>
                <QuantityControl value={qty[item.id] ?? 1} onChange={(value) => setQty((old) => ({ ...old, [item.id]: value }))} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.bottom}>
        <View>
          <Text style={styles.totalLabel}>Total ({cartItems.length} produk)</Text>
          <Text style={styles.total}>{rupiah(total)}</Text>
        </View>
        <Pressable style={styles.checkout} onPress={() => router.push('/checkout')}>
          <Text style={styles.checkoutText}>Checkout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  edit: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 20 },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  selectText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  image: { width: 82, height: 82, borderRadius: 13 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  merchant: { fontSize: 10, color: COLORS.secondaryText, marginTop: 2 },
  price: { fontSize: 13, fontWeight: '900', color: COLORS.primary, marginTop: 8 },
  quantityWrap: { alignSelf: 'flex-end', marginTop: 8 },
  bottom: { borderTopWidth: 1, borderTopColor: '#EEEEEE', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  totalLabel: { fontSize: 10, color: COLORS.secondaryText },
  total: { marginTop: 2, fontSize: 18, fontWeight: '900', color: COLORS.text },
  checkout: { minWidth: 132, height: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  checkoutText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
