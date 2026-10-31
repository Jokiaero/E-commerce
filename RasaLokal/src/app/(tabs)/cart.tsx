import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { AppIcon } from '@/components/AppIcon';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { QuantityControl } from '@/components/QuantityControl';
import { loadCartItems, removeCartItem, updateCartItemQuantity, type CartItem } from '@/lib/cartStorage';

export default function CartScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadCartItems().then((storedItems) => {
      if (active) setItems(storedItems);
    }).catch((error: unknown) => {
      if (!active) return;
      setItems([]);
      Alert.alert('Keranjang tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    });
    return () => { active = false; };
  }, []));

  const updateQuantity = async (item: CartItem, quantity: number) => {
    try {
      await updateCartItemQuantity(item.productId, item.variant, quantity);
      setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, quantity } : currentItem));
    } catch (error) {
      Alert.alert('Jumlah tidak dapat diperbarui', error instanceof Error ? error.message : 'Silakan coba lagi.');
    }
  };

  const removeItem = async (item: CartItem) => {
    try {
      await removeCartItem(item.productId, item.variant);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } catch (error) {
      Alert.alert('Produk belum terhapus', error instanceof Error ? error.message : 'Silakan coba lagi.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Keranjang ({items.length})</Text>
        {items.length > 0 ? <Text style={styles.edit}>Ubah</Text> : null}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><AppIcon name="cart" size={38} color={COLORS.primary} /></View>
            <Text style={styles.emptyTitle}>Keranjang masih kosong</Text>
            <Text style={styles.emptyText}>Produk yang Anda tambahkan akan muncul di sini.</Text>
            <Pressable style={styles.browseButton} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.browseText}>Jelajahi Produk</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.selectAll}>
              <AppIcon name="checkbox" size={21} color={COLORS.primary} />
              <Text style={styles.selectText}>Pilih Semua</Text>
            </View>
            {items.map((item) => (
              <Swipeable
                key={item.id}
                overshootRight={false}
                rightThreshold={40}
                renderRightActions={() => (
                  <Pressable
                    style={styles.deleteAction}
                    onPress={() => void removeItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus ${item.name} dari keranjang`}
                  >
                    <AppIcon name="trash" size={21} color="#fff" />
                    <Text style={styles.deleteText}>Hapus</Text>
                  </Pressable>
                )}
              >
                <View style={styles.item}>
                  <AppIcon name="checkbox" size={20} color={COLORS.primary} />
                  {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]}><AppIcon name="restaurant" size={26} color={COLORS.muted} /></View>}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.merchant}>{item.merchant}</Text>
                    <Text style={styles.price}>{rupiah(item.price)}</Text>
                    <View style={styles.quantityWrap}>
                      <QuantityControl value={item.quantity} onChange={(value) => void updateQuantity(item, value)} />
                    </View>
                  </View>
                </View>
              </Swipeable>
            ))}
          </>
        )}
      </ScrollView>
      <View style={styles.bottom}>
        <View>
          <Text style={styles.totalLabel}>Total ({items.length} produk)</Text>
          <Text style={styles.total}>{rupiah(total)}</Text>
        </View>
        <Pressable style={[styles.checkout, (items.length === 0 || items.some((item) => !item.isAvailable)) && styles.checkoutDisabled]} disabled={items.length === 0 || items.some((item) => !item.isAvailable)} onPress={() => router.push('/checkout')}>
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
  emptyState: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 18, fontSize: 16, fontWeight: '900', color: COLORS.text },
  emptyText: { marginTop: 7, fontSize: 12, lineHeight: 18, color: COLORS.secondaryText, textAlign: 'center' },
  browseButton: { marginTop: 18, minHeight: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  browseText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  selectText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  deleteAction: { width: 86, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#D92D20' },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  image: { width: 82, height: 82, borderRadius: 13 },
  imagePlaceholder: { backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  merchant: { fontSize: 10, color: COLORS.secondaryText, marginTop: 2 },
  price: { fontSize: 13, fontWeight: '900', color: COLORS.primary, marginTop: 8 },
  quantityWrap: { alignSelf: 'flex-end', marginTop: 8 },
  bottom: { borderTopWidth: 1, borderTopColor: '#EEEEEE', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  totalLabel: { fontSize: 10, color: COLORS.secondaryText },
  total: { marginTop: 2, fontSize: 18, fontWeight: '900', color: COLORS.text },
  checkout: { minWidth: 132, height: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  checkoutDisabled: { backgroundColor: COLORS.muted },
  checkoutText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
