import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS, SHADOW } from '@/constants/theme';
import { IMAGES, merchants, products, ProductCategory, rupiah } from '@/constants/data';
import { SectionHeader } from '@/components/SectionHeader';
import { loadAccountData } from '@/lib/accountStorage';

type Category = 'Semua' | ProductCategory;

const categories: ReadonlyArray<{ icon: string; label: Category }> = [
  { icon: 'grid', label: 'Semua' },
  { icon: 'restaurant', label: 'Makanan' },
  { icon: 'cafe', label: 'Minuman' },
  { icon: 'fast-food', label: 'Camilan' },
  { icon: 'gift', label: 'Oleh-oleh' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('Semua');
  const [currentAddress, setCurrentAddress] = useState('Palembang, Sumatera Selatan');

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadAccountData().then((account) => {
      if (active && account.address?.details) setCurrentAddress(account.address.details);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Lokasi tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi.');
    });
    return () => { active = false; };
  }, []));
  const searchTerm = search.trim().toLocaleLowerCase('id-ID');
  const visibleProducts = products.filter((product) => {
    const matchesCategory = activeCategory === 'Semua' || product.category === activeCategory;
    const matchesSearch = !searchTerm || `${product.name} ${product.merchant} ${product.category}`
      .toLocaleLowerCase('id-ID')
      .includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.push('/location')} accessibilityRole="button" accessibilityLabel="Pilih lokasi">
            <Text style={styles.locationLabel}>Lokasi kamu</Text>
            <View style={styles.locationRow}>
              <AppIcon name="location" size={16} color={COLORS.primary} />
              <Text style={styles.location} numberOfLines={1}>{currentAddress}</Text>
              <AppIcon name="chevron-down" size={14} color={COLORS.muted} />
            </View>
          </Pressable>
          <View style={styles.bellWrap}>
            <AppIcon name="notifications-outline" size={22} color={COLORS.text} />
            <View style={styles.badge} />
          </View>
        </View>

        <View style={styles.searchBox}>
          <AppIcon name="search" size={18} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari makanan, minuman, atau UMKM..."
            placeholderTextColor="#AAAAAA"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Kuliner Lokal</Text>
            <Text style={styles.heroOrange}>Dari UMKM</Text>
            <Text style={styles.heroSubtitle}>untuk Indonesia</Text>
          </View>
          <Image source={{ uri: IMAGES.hero }} style={styles.heroImage} />
        </View>

        <View style={styles.categories}>
          {categories.map(({ icon, label }) => {
            const isActive = activeCategory === label;

            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Kategori ${label}`}
                onPress={() => setActiveCategory(label)}
                style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}
              >
                <View style={[styles.categoryIcon, isActive && styles.categoryIconActive]}>
                  <AppIcon name={icon} size={22} color={isActive ? '#FFFFFF' : COLORS.primary} />
                </View>
                <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title="UMKM Terdekat" action="Lihat Semua" onPress={() => router.push('/(tabs)/umkm')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {merchants.slice(0, 3).map((merchant) => (
              <Pressable key={merchant.id} style={styles.merchantCard} onPress={() => router.push('/product')}>
                <Image source={{ uri: merchant.image }} style={styles.merchantImage} />
                <Text style={styles.merchantName}>{merchant.name}</Text>
                <Text style={styles.merchantCity}>{merchant.city}</Text>
                <View style={styles.ratingRow}>
                  <AppIcon name="star" size={12} color="#F59E0B" />
                  <Text style={styles.rating}>{merchant.rating}</Text>
                  <Text style={styles.dot}>.</Text>
                  <Text style={styles.distance}>{merchant.distance}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title={activeCategory === 'Semua' ? 'Rekomendasi Untuk Kamu' : `Rekomendasi ${activeCategory}`} />
          <View style={styles.productGrid}>
            {visibleProducts.map((product) => (
              <Pressable key={product.id} style={styles.productCard} onPress={() => router.push('/product')}>
                <Image source={{ uri: product.image }} style={styles.productImage} />
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.productMerchant}>{product.merchant}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{rupiah(product.price)}</Text>
                    <View style={styles.addButton}><AppIcon name="add" size={17} color="#fff" /></View>
                  </View>
                </View>
              </Pressable>
            ))}
            {visibleProducts.length === 0 && (
              <View style={styles.emptyState}>
                <AppIcon name="search" size={24} color={COLORS.muted} />
                <Text style={styles.emptyTitle}>Produk tidak ditemukan</Text>
                <Text style={styles.emptySubtitle}>Coba kata kunci atau kategori lain.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  locationLabel: { fontSize: 10, color: COLORS.secondaryText, marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { maxWidth: 240, fontSize: 12, fontWeight: '700', color: COLORS.text },
  bellWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.danger, borderWidth: 1, borderColor: '#fff' },
  searchBox: { marginTop: 14, height: 44, borderRadius: 13, backgroundColor: '#F4F4F4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  hero: { marginTop: 16, minHeight: 130, borderRadius: 20, backgroundColor: '#FFE0C7', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 16 },
  heroTextWrap: { flex: 1, zIndex: 2 },
  heroTitle: { fontSize: 19, fontWeight: '900', color: COLORS.text },
  heroOrange: { fontSize: 19, fontWeight: '900', color: '#C44B00', marginTop: 1 },
  heroSubtitle: { marginTop: 4, fontSize: 13, fontWeight: '600', color: COLORS.secondaryText },
  heroImage: { width: 118, height: 92, borderRadius: 16 },
  categories: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  categoryItem: { alignItems: 'center', width: 62 },
  categoryIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  categoryIconActive: { backgroundColor: COLORS.primary },
  categoryLabel: { marginTop: 6, fontSize: 11, fontWeight: '600', color: COLORS.text },
  categoryLabelActive: { color: COLORS.primary, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  sectionBlock: { marginTop: 22 },
  horizontalList: { paddingTop: 11, paddingRight: 8, gap: 12 },
  merchantCard: { width: 145, backgroundColor: '#fff', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  merchantImage: { width: '100%', height: 88, borderRadius: 12 },
  merchantName: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  merchantCity: { fontSize: 10, color: COLORS.secondaryText, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  rating: { fontSize: 10, fontWeight: '700', color: COLORS.text },
  dot: { fontSize: 10, color: COLORS.muted },
  distance: { fontSize: 10, color: COLORS.secondaryText },
  productGrid: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  productCard: { width: '48.3%', borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', ...SHADOW },
  productImage: { width: '100%', height: 112 },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  productMerchant: { fontSize: 10, color: COLORS.secondaryText, marginTop: 2 },
  priceRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 13, fontWeight: '900', color: COLORS.primary },
  addButton: { width: 26, height: 26, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  emptyState: { width: '100%', minHeight: 150, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { marginTop: 8, fontSize: 13, fontWeight: '800', color: COLORS.text },
  emptySubtitle: { marginTop: 3, fontSize: 11, color: COLORS.secondaryText },
});
