import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS, SHADOW } from '@/constants/theme';
import type { ProductCategory } from '@/constants/data';
import { loadPublicProducts, loadPublicStores, type CatalogProduct, type Store } from '@/lib/catalogStorage';

const filters: ('Semua' | ProductCategory)[] = ['Semua', 'Makanan', 'Minuman', 'Camilan', 'Oleh-oleh'];

export default function UmkmScreen() {
  const router = useRouter();
  const [active, setActive] = useState('Semua');
  const [search, setSearch] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void Promise.all([loadPublicStores(), loadPublicProducts()]).then(([loadedStores, loadedProducts]) => {
      if (!active) return;
      setStores(loadedStores);
      setProducts(loadedProducts);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Daftar UMKM tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const visibleStores = stores.filter((store) => {
    const storeProducts = products.filter((product) => product.storeId === store.id);
    const matchesSearch = `${store.name} ${store.address}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'));
    const matchesCategory = active === 'Semua' || storeProducts.some((product) => product.category === active);
    return matchesSearch && matchesCategory && storeProducts.length > 0;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Daftar UMKM</Text>
        <View style={styles.searchBox}>
          <AppIcon name="search" size={18} color={COLORS.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Cari UMKM lokal..." placeholderTextColor="#AAA" style={styles.input} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => (
            <Pressable key={f} onPress={() => setActive(f)} style={[styles.filter, active === f && styles.filterActive]}>
              <Text style={[styles.filterText, active === f && styles.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.list}>
          {visibleStores.map((store) => {
            const storeProducts = products.filter((product) => product.storeId === store.id);
            const firstProduct = storeProducts[0];
            return (
            <Pressable key={store.id} style={styles.card} onPress={() => router.push({ pathname: '/product', params: { id: firstProduct.id } } as any)}>
              {store.imageUrl
                ? <Image source={{ uri: store.imageUrl }} style={styles.image} resizeMode="cover" />
                : <View style={styles.image}><AppIcon name="storefront" size={34} color={COLORS.primary} /></View>}
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{store.name}</Text>
                  <AppIcon name="chevron-forward" size={18} color={COLORS.muted} />
                </View>
                <Text style={styles.city} numberOfLines={1}>{store.address}</Text>
                <View style={styles.metaRow}>
                  <AppIcon name="restaurant" size={13} color={COLORS.primary} />
                  <Text style={styles.distance}>{storeProducts.length} produk</Text>
                </View>
                <View style={[styles.chip, !store.isOpen && styles.chipClosed]}><Text style={styles.chipText}>{store.isOpen ? 'Buka sekarang' : 'Tutup'}</Text></View>
              </View>
            </Pressable>
            );
          })}
          {loading && <ActivityIndicator style={styles.loader} color={COLORS.primary} />}
          {!loading && visibleStores.length === 0 && <View style={styles.empty}><AppIcon name="storefront" size={28} color={COLORS.muted} /><Text style={styles.emptyText}>Belum ada UMKM dengan produk aktif.</Text></View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  searchBox: { marginTop: 14, height: 44, borderRadius: 13, backgroundColor: '#F4F4F4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 8 },
  input: { flex: 1, fontSize: 13, color: COLORS.text },
  filterRow: { gap: 8, paddingVertical: 16 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F3F3F3' },
  filterActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.secondaryText },
  filterTextActive: { color: '#fff' },
  list: { gap: 12 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 17, padding: 10, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  image: { width: 102, height: 102, borderRadius: 13, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, paddingVertical: 2 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  city: { fontSize: 11, color: COLORS.secondaryText, marginTop: 3 },
  metaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  reviews: { fontSize: 10, color: COLORS.secondaryText },
  dot: { color: COLORS.muted, marginHorizontal: 2 },
  distance: { fontSize: 10, color: COLORS.secondaryText },
  chip: { alignSelf: 'flex-start', marginTop: 9, backgroundColor: '#ECFDF3', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { color: COLORS.success, fontSize: 9, fontWeight: '800' },
  chipClosed: { backgroundColor: '#F4F4F4' },
  loader: { marginTop: 30 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 38 },
  emptyText: { fontSize: 12, color: COLORS.secondaryText, textAlign: 'center' },
});
