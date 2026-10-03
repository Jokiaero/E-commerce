import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';

export default function SellerProductFormScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [saved, setSaved] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.title}>Tambah Produk</Text><View style={styles.backButton} /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nama produk</Text><TextInput value={name} onChangeText={setName} placeholder="Contoh: Pempek Kapal Selam" placeholderTextColor={COLORS.muted} style={styles.input} />
        <Text style={styles.label}>Harga</Text><TextInput value={price} onChangeText={setPrice} placeholder="Contoh: 25000" placeholderTextColor={COLORS.muted} keyboardType="numeric" style={styles.input} />
        <Text style={styles.label}>Kategori</Text><View style={styles.categoryRow}>{['Makanan', 'Minuman', 'Camilan', 'Oleh-oleh'].map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categoryActive]}><Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text></Pressable>)}</View>
        {saved && <View style={styles.success}><AppIcon name="checkmark-circle-outline" size={18} color={COLORS.success} /><Text style={styles.successText}>Produk berhasil disimpan</Text></View>}
        <Pressable onPress={() => setSaved(true)} style={styles.saveButton}><Text style={styles.saveText}>Simpan Produk</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 17, fontWeight: '900', color: COLORS.text }, backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' }, content: { padding: 18, paddingTop: 8, paddingBottom: 32 }, label: { marginTop: 18, marginBottom: 7, fontSize: 12, fontWeight: '800', color: COLORS.text }, input: { height: 48, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, fontSize: 13, color: COLORS.text }, categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#F5F5F5' }, categoryActive: { backgroundColor: COLORS.primary }, categoryText: { fontSize: 11, fontWeight: '800', color: COLORS.secondaryText }, categoryTextActive: { color: '#fff' }, success: { marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: '#ECFDF3', flexDirection: 'row', alignItems: 'center', gap: 7 }, successText: { fontSize: 11, fontWeight: '700', color: COLORS.success }, saveButton: { height: 50, marginTop: 22, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, saveText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
