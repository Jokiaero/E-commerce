import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { IMAGES, rupiah } from '@/constants/data';
import { QuantityControl } from '@/components/QuantityControl';
import { loadAccountData, toggleFavorite } from '@/lib/accountStorage';
import { addCartItem } from '@/lib/cartStorage';
import { loadProduct, type CatalogProduct } from '@/lib/catalogStorage';

const variants = ['Original', 'Pedas', 'Tanpa Telur'];

export default function ProductScreen() {
  const router = useRouter();
  const safeBack = useSafeBack('/(tabs)/umkm');
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [variant, setVariant] = useState('Original');
  const [qty, setQty] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!productId) {
      setProduct(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void Promise.all([loadProduct(productId), loadAccountData()]).then(([loadedProduct, account]) => {
      if (!active) return;
      setProduct(loadedProduct);
      setIsFavorite(account.favorites.includes(loadedProduct.id));
    }).catch((error: unknown) => {
      if (active) Alert.alert('Produk tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [productId]));

  if (loading) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator color={COLORS.primary} /></SafeAreaView>;
  }
  if (!product) {
    return <SafeAreaView style={styles.loading}><Text style={styles.unavailable}>Produk tidak ditemukan.</Text></SafeAreaView>;
  }

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite('1');
      setIsFavorite((current) => !current);
    } catch (error) {
      Alert.alert('Favorit perlu akun', error instanceof Error ? error.message : 'Masuk untuk menyimpan produk favorit.');
      router.push('/account-details?section=login' as any);
    }
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={{ uri: product.image ?? IMAGES.productHero }} style={styles.hero} resizeMode="cover">
        <SafeAreaView edges={['top']} style={styles.heroSafe}>
          <Pressable style={styles.roundButton} onPress={safeBack}>
            <AppIcon name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Pressable style={styles.roundButton} onPress={() => void handleToggleFavorite()} accessibilityRole="button" accessibilityLabel={isFavorite ? 'Hapus dari favorit' : 'Simpan ke favorit'}>
            <AppIcon name={isFavorite ? 'heart' : 'heart-outline'} size={22} color="#fff" />
          </Pressable>
        </SafeAreaView>
      </ImageBackground>

      <View style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.nameRow}>
            <View style={styles.nameWrap}>
              <Text style={styles.name}>{product.name}</Text>
              <View style={styles.ratingRow}>
                <AppIcon name="star" size={14} color="#F59E0B" />
                <Text style={styles.rating}>4.8</Text>
                <Text style={styles.reviews}>(120 ulasan)</Text>
              </View>
            </View>
            <Text style={styles.price}>{rupiah(product.price)}</Text>
          </View>

          <Text style={styles.description}>
            {product.description}
          </Text>

          <Text style={styles.sectionTitle}>Varian</Text>
          <View style={styles.variantRow}>
            {variants.map((item) => (
              <Pressable key={item} onPress={() => setVariant(item)} style={[styles.variant, variant === item && styles.variantActive]}>
                <Text style={[styles.variantText, variant === item && styles.variantTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>Jumlah</Text>
            <QuantityControl value={qty} onChange={setQty} />
          </View>

          <View style={styles.merchantCard}>
            <View style={styles.merchantIcon}><AppIcon name="storefront" size={24} color={COLORS.primary} /></View>
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantName}>{product.storeName}</Text>
              <Text style={styles.merchantMeta}>{product.storeAddress}</Text>
            </View>
            <AppIcon name="chevron-forward" size={18} color={COLORS.muted} />
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.total}>{rupiah(product.price * qty)}</Text>
          </View>
          <Pressable
            style={styles.addCart}
            onPress={() => {
              void addCartItem(product.id, qty, variant).then(() => router.push('/(tabs)/cart')).catch((error) => {
                if (error instanceof Error && error.message.includes('Masuk')) {
                  Alert.alert('Masuk diperlukan', error.message, [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Masuk', onPress: () => router.push('/account-details?section=login' as any) },
                  ]);
                  return;
                }
                Alert.alert('Tidak dapat menambahkan produk', error instanceof Error ? error.message : 'Silakan coba lagi.');
              });
            }}
          >
            <AppIcon name="cart" size={19} color="#fff" />
            <Text style={styles.addCartText}>+ Keranjang</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  unavailable: { fontSize: 14, fontWeight: '700', color: COLORS.secondaryText },
  root: { flex: 1, backgroundColor: '#fff' },
  hero: { height: 340 },
  heroSafe: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 2 },
  roundButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#fff', overflow: 'hidden' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 116 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  nameWrap: { flex: 1 },
  name: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  ratingRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  reviews: { fontSize: 11, color: COLORS.secondaryText },
  price: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  description: { marginTop: 18, fontSize: 13, lineHeight: 20, color: COLORS.secondaryText },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  variantRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  variantActive: { backgroundColor: COLORS.orange50, borderColor: COLORS.primary },
  variantText: { fontSize: 12, fontWeight: '700', color: COLORS.secondaryText },
  variantTextActive: { color: COLORS.primary },
  quantitySection: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  merchantCard: { marginTop: 24, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center' },
  merchantIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  merchantInfo: { flex: 1, marginLeft: 10 },
  merchantName: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  merchantMeta: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 10, color: COLORS.secondaryText },
  total: { marginTop: 2, fontSize: 18, fontWeight: '900', color: COLORS.text },
  addCart: { height: 50, minWidth: 164, borderRadius: 15, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  addCartText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
