import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';

export default function SellerRegistrationScreen() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('Pempek Sari');
  const [ownerName, setOwnerName] = useState('Sari Wulandari');
  const [address, setAddress] = useState('Jl. Sudirman No. 18, Palembang');
  const [isOpen, setIsOpen] = useState(true);
  const [saved, setSaved] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.title}>Profil UMKM</Text><View style={styles.backButton} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.iconBox}><AppIcon name="storefront" size={32} color="#fff" /></View>
        <Text style={styles.heading}>Informasi usaha</Text><Text style={styles.description}>Pastikan data toko mudah dikenali oleh pembeli.</Text>
        <Text style={styles.label}>Nama UMKM</Text><TextInput value={storeName} onChangeText={setStoreName} style={styles.input} placeholder="Nama UMKM" placeholderTextColor={COLORS.muted} />
        <Text style={styles.label}>Nama pemilik</Text><TextInput value={ownerName} onChangeText={setOwnerName} style={styles.input} placeholder="Nama pemilik" placeholderTextColor={COLORS.muted} />
        <Text style={styles.label}>Alamat usaha</Text><TextInput value={address} onChangeText={setAddress} style={[styles.input, styles.addressInput]} multiline placeholder="Alamat usaha" placeholderTextColor={COLORS.muted} />
        <View style={styles.openRow}><View><Text style={styles.openTitle}>Status toko</Text><Text style={styles.openSubtitle}>{isOpen ? 'Toko menerima pesanan' : 'Toko sementara tutup'}</Text></View><Switch value={isOpen} onValueChange={setIsOpen} trackColor={{ false: '#E5E5E5', true: '#FDBA74' }} thumbColor={isOpen ? COLORS.primary : '#fff'} /></View>
        {saved && <View style={styles.success}><AppIcon name="checkmark-circle-outline" size={18} color={COLORS.success} /><Text style={styles.successText}>Profil UMKM berhasil disimpan</Text></View>}
        <Pressable onPress={() => setSaved(true)} style={styles.saveButton}><Text style={styles.saveText}>Simpan Perubahan</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 17, fontWeight: '900', color: COLORS.text }, backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' }, content: { padding: 18, paddingTop: 8, paddingBottom: 32 }, iconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, heading: { marginTop: 18, fontSize: 20, fontWeight: '900', color: COLORS.text }, description: { marginTop: 5, fontSize: 12, lineHeight: 18, color: COLORS.secondaryText }, label: { marginTop: 19, marginBottom: 7, fontSize: 12, fontWeight: '800', color: COLORS.text }, input: { minHeight: 47, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, fontSize: 13, color: COLORS.text, backgroundColor: '#fff' }, addressInput: { height: 82, paddingTop: 12, textAlignVertical: 'top' }, openRow: { marginTop: 22, padding: 14, borderRadius: 15, backgroundColor: '#F7F7F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, openTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text }, openSubtitle: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText }, success: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#ECFDF3', flexDirection: 'row', alignItems: 'center', gap: 7 }, successText: { fontSize: 11, fontWeight: '700', color: COLORS.success }, saveButton: { height: 50, marginTop: 18, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, saveText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
