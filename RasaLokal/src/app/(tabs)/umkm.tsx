import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useRouter } from 'expo-router';
import { COLORS, SHADOW } from '@/constants/theme';
import { merchants } from '@/constants/data';

const filters = ['Semua', 'Pempek', 'Makanan Berat', 'Camilan'];

export default function UmkmScreen() {
  const router = useRouter();
  const [active, setActive] = useState('Semua');
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Daftar UMKM</Text>
        <View style={styles.searchBox}>
          <AppIcon name="search" size={18} color={COLORS.muted} />
          <TextInput placeholder="Cari UMKM lokal..." placeholderTextColor="#AAA" style={styles.input} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => (
            <Pressable key={f} onPress={() => setActive(f)} style={[styles.filter, active === f && styles.filterActive]}>
              <Text style={[styles.filterText, active === f && styles.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.list}>
          {merchants.map((m) => (
            <Pressable key={m.id} style={styles.card} onPress={() => router.push('/product')}>
              <Image source={{ uri: m.image }} style={styles.image} />
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{m.name}</Text>
                  <AppIcon name="heart-outline" size={20} color={COLORS.muted} />
                </View>
                <Text style={styles.city}>{m.city}</Text>
                <View style={styles.metaRow}>
                  <AppIcon name="star" size={13} color="#F59E0B" />
                  <Text style={styles.rating}>{m.rating}</Text>
                  <Text style={styles.reviews}>({m.reviews})</Text>
                  <Text style={styles.dot}>.</Text>
                  <AppIcon name="location-outline" size={12} color={COLORS.secondaryText} />
                  <Text style={styles.distance}>{m.distance}</Text>
                </View>
                <View style={styles.chip}><Text style={styles.chipText}>Buka sekarang</Text></View>
              </View>
            </Pressable>
          ))}
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
  image: { width: 102, height: 102, borderRadius: 13 },
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
});
