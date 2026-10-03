import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS, SHADOW } from '@/constants/theme';
import { products, rupiah } from '@/constants/data';

export default function SellerProductsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [available, setAvailable] = useState<Record<string, boolean>>({ 1: true, 2: true, 3: true, 4: true, 5: false });
  const filters = ['Semua', 'Tersedia', 'Habis'];
  const visibleProducts = products.filter((product) => activeFilter === 'Semua' || available[product.id] === (activeFilter === 'Tersedia'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable>
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
              <Image source={{ uri: product.image }} style={styles.image} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.category}>{product.category}</Text>
                <Text style={styles.price}>{rupiah(product.price)}</Text>
                <View style={styles.stockRow}>
                  <Text style={[styles.stockText, !available[product.id] && styles.stockTextOff]}>{available[product.id] ? 'Tersedia' : 'Habis'}</Text>
                  <Switch value={available[product.id]} onValueChange={(value) => setAvailable((current) => ({ ...current, [product.id]: value }))} trackColor={{ false: '#E5E5E5', true: '#FDBA74' }} thumbColor={available[product.id] ? COLORS.primary : '#fff'} />
                </View>
              </View>
              <Pressable accessibilityLabel={`Edit ${product.name}`} onPress={() => router.push('/seller/product-form' as any)} style={styles.editButton}><AppIcon name="create-outline" size={18} color={COLORS.primary} /></Pressable>
            </View>
          ))}
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
  info: { flex: 1, marginLeft: 11 },
  name: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  category: { marginTop: 4, fontSize: 10, color: COLORS.secondaryText },
  price: { marginTop: 6, fontSize: 13, fontWeight: '900', color: COLORS.primary },
  stockRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stockText: { fontSize: 10, fontWeight: '800', color: COLORS.success },
  stockTextOff: { color: COLORS.danger },
  editButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
});
