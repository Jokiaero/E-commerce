import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { deleteProduct, loadSellerProducts, setProductAvailability, type CatalogProduct } from '@/lib/catalogStorage';

export default function SellerProductsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const filters = ['Semua', 'Tersedia', 'Habis'];
  const visibleProducts = products.filter((product) => activeFilter === 'Semua' || product.isAvailable === (activeFilter === 'Tersedia'));

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadSellerProducts().then((loadedProducts) => {
      if (active) setProducts(loadedProducts);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Produk toko tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    });
    return () => { active = false; };
  }, []));

  const toggleAvailability = async (product: CatalogProduct, isAvailable: boolean) => {
    try {
      await setProductAvailability(product.id, isAvailable);
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, isAvailable } : item));
    } catch (error) {
      Alert.alert('Stok tidak dapat diperbarui', error instanceof Error ? error.message : 'Silakan coba lagi.');
    }
  };

  const confirmDelete = (product: CatalogProduct) => {
    Alert.alert('Hapus produk?', `Produk ${product.name} akan dihapus dari toko.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => {
        void deleteProduct(product.id).then(() => {
          setProducts((current) => current.filter((item) => item.id !== product.id));
        }).catch((error: unknown) => {
          Alert.alert('Produk tidak dapat dihapus', error instanceof Error ? error.message : 'Silakan coba lagi.');
        });
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/seller')} style={styles.backButton} accessibilityLabel="Kembali ke Pusat Penjual"><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable>
        <Text style={styles.title}>Kelola Produk</Text>
        <Pressable accessibilityLabel="Tambah produk" onPress={() => router.push('/seller/product-form' as any)} style={styles.addButton}><Text style={styles.addButtonText}>+ Tambah Produk</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((filter) => (
            <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filter, activeFilter === filter && styles.filterActive]}>
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.count}>{visibleProducts.length} produk</Text>
        <View style={styles.list}>
          {visibleProducts.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {product.image ? <Image source={{ uri: product.image }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]}><AppIcon name="restaurant" size={26} color={COLORS.muted} /></View>}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.category}>{product.category}</Text>
                <Text style={styles.price}>{rupiah(product.price)}</Text>
                <View style={styles.stockRow}>
                  <Text style={[styles.stockText, !product.isAvailable && styles.stockTextOff]}>{product.isAvailable ? 'Tersedia' : 'Habis'}</Text>
                  <Switch value={product.isAvailable} onValueChange={(value) => void toggleAvailability(product, value)} trackColor={{ false: '#E5E5E5', true: '#FDBA74' }} thumbColor={product.isAvailable ? COLORS.primary : '#fff'} />
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable accessibilityLabel={`Edit ${product.name}`} onPress={() => router.push({ pathname: '/seller/product-form', params: { id: product.id } } as any)} style={styles.editButton}><AppIcon name="create-outline" size={18} color={COLORS.primary} /></Pressable>
                <Pressable accessibilityLabel={`Hapus ${product.name}`} onPress={() => confirmDelete(product)} style={styles.deleteButton}><AppIcon name="trash" size={18} color={COLORS.danger} /></Pressable>
              </View>
            </View>
          ))}
          {visibleProducts.length === 0 && <View style={styles.empty}><AppIcon name="restaurant" size={28} color={COLORS.muted} /><Text style={styles.emptyText}>Belum ada produk di toko</Text></View>}
        </View>
      </ScrollView>
      <SellerBottomNav active="products" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '900', color: COLORS.text },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' },
  addButton: { height: 40, paddingHorizontal: 11, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  filterRow: { gap: 8, paddingVertical: 8 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: '#F5F5F5' },
  filterActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: '800', color: COLORS.secondaryText },
  filterTextActive: { color: '#fff' },
  count: { marginTop: 12, fontSize: 11, color: COLORS.secondaryText },
  list: { marginTop: 10, gap: 11 },
  productCard: { minHeight: 116, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', flexDirection: 'row', ...SHADOW },
  image: { width: 94, height: 94, borderRadius: 12 },
  imagePlaceholder: { backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 11 },
  name: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  category: { marginTop: 4, fontSize: 10, color: COLORS.secondaryText },
  price: { marginTop: 6, fontSize: 13, fontWeight: '900', color: COLORS.primary },
  stockRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stockText: { fontSize: 10, fontWeight: '800', color: COLORS.success },
  stockTextOff: { color: COLORS.danger },
  actions: { gap: 7 },
  editButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 30, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 12, color: COLORS.secondaryText },
});
