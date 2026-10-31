import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS } from '@/constants/theme';
import { loadSellerStore, updateSellerStoreImage, uploadStorePhoto, type Store } from '@/lib/catalogStorage';

export default function SellerStoreProfileScreen() {
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void loadSellerStore().then((loadedStore) => {
      if (active) setStore(loadedStore);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Profil toko tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const chooseStorePhoto = async () => {
    setPhotoError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize !== undefined && asset.fileSize > 5 * 1024 * 1024) {
        setPhotoError('Ukuran foto maksimal 5 MB. Pilih foto lain.');
        return;
      }
      setUploadingPhoto(true);
      const imageUrl = await uploadStorePhoto(asset);
      await updateSellerStoreImage(imageUrl);
      setStore((current) => current ? { ...current, imageUrl } : current);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Foto toko tidak dapat disimpan. Coba lagi.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/seller')} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Kembali ke Pusat Penjual">
          <AppIcon name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Profil Toko</Text>
        {store ? <Pressable onPress={() => router.push('/seller/register?edit=true' as any)} style={styles.editButton} accessibilityRole="button" accessibilityLabel="Edit profil toko">
          <AppIcon name="create-outline" size={19} color={COLORS.primary} />
        </Pressable> : <View style={styles.editButton} />}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator style={styles.loader} color={COLORS.primary} /> : store ? <>
          <View style={styles.identity}>
            <Pressable onPress={() => void chooseStorePhoto()} disabled={uploadingPhoto} style={styles.storeImageButton} accessibilityRole="button" accessibilityLabel={store.imageUrl ? 'Ganti foto toko' : 'Tambah foto toko'}>
              {store.imageUrl ? <Image source={{ uri: store.imageUrl }} style={styles.storeImage} /> : <View style={styles.storeIcon}><AppIcon name="storefront" size={29} color="#fff" /></View>}
              <View style={styles.photoEditBadge}><AppIcon name="create-outline" size={13} color="#fff" /></View>
            </Pressable>
            <View style={styles.identityCopy}>
              <Text style={styles.storeName}>{store.name}</Text>
              <View style={styles.statusRow}><View style={[styles.statusDot, !store.isOpen && styles.statusDotClosed]} /><Text style={[styles.status, !store.isOpen && styles.statusClosed]}>{store.isOpen ? 'Menerima pesanan' : 'Toko sementara tutup'}</Text></View>
              <Pressable onPress={() => void chooseStorePhoto()} disabled={uploadingPhoto} style={styles.photoAction}>
                {uploadingPhoto ? <ActivityIndicator size="small" color={COLORS.primary} /> : <AppIcon name="add" size={14} color={COLORS.primary} />}
                <Text style={styles.photoActionText}>{uploadingPhoto ? 'Mengunggah foto...' : store.imageUrl ? 'Ganti foto toko' : 'Tambah foto toko'}</Text>
              </Pressable>
            </View>
          </View>
          {photoError !== '' && <Text style={styles.photoError}>{photoError}</Text>}

          <Text style={styles.sectionTitle}>Informasi Outlet</Text>
          <View style={styles.details}>
            <DetailRow label="Pemilik" value={store.ownerName || '-'} />
            <DetailRow label="Jenis toko" value={store.storeType || '-'} />
            <DetailRow label="Kategori" value={store.merchantCategory || '-'} />
            <DetailRow label="Email kontak" value={store.contactEmail || 'Belum diisi'} />
            <DetailRow label="Alamat outlet" value={store.address || 'Belum diisi'} />
            <DetailRow label="QRIS" value={store.hasQris ? 'Tersedia' : 'Belum tersedia'} last />
          </View>

          {store.latitude !== null && store.longitude !== null && <View style={styles.locationPanel}>
            <View style={styles.locationIcon}><AppIcon name="location" size={19} color={COLORS.primary} /></View>
            <View style={styles.locationCopy}>
              <Text style={styles.locationTitle}>Titik lokasi tersimpan</Text>
              <Text style={styles.coordinates}>{store.latitude.toFixed(5)}, {store.longitude.toFixed(5)}</Text>
            </View>
          </View>}

          <Pressable style={styles.primaryButton} onPress={() => router.push('/seller/register?edit=true' as any)}>
            <AppIcon name="create-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>Edit Profil Toko</Text>
          </Pressable>
        </> : <View style={styles.empty}>
          <View style={styles.emptyIcon}><AppIcon name="storefront" size={30} color={COLORS.primary} /></View>
          <Text style={styles.emptyTitle}>Toko belum terdaftar</Text>
          <Text style={styles.emptyText}>Daftarkan informasi outlet dan titik lokasinya untuk mulai mengelola toko.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/seller/register')}>
            <AppIcon name="add" size={18} color="#fff" />
            <Text style={styles.primaryText}>Daftarkan Toko</Text>
          </Pressable>
        </View>}
      </ScrollView>
      <SellerBottomNav active="store" />
    </SafeAreaView>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, last && styles.lastDetailRow]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  editButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, padding: 17, paddingBottom: 28 },
  identity: { minHeight: 102, flexDirection: 'row', alignItems: 'center', gap: 13 },
  storeIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  storeImageButton: { width: 62, height: 62, position: 'relative' },
  storeImage: { width: 62, height: 62, borderRadius: 17, backgroundColor: '#F4F4F4' },
  photoEditBadge: { position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1 },
  storeName: { fontSize: 19, fontWeight: '900', color: COLORS.text },
  statusRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  statusDotClosed: { backgroundColor: COLORS.muted },
  status: { fontSize: 11, fontWeight: '700', color: COLORS.success },
  statusClosed: { color: COLORS.muted },
  photoAction: { alignSelf: 'flex-start', minHeight: 25, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  photoActionText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  photoError: { marginTop: 2, marginBottom: 7, fontSize: 10, lineHeight: 15, color: COLORS.danger },
  sectionTitle: { marginTop: 19, marginBottom: 9, fontSize: 13, fontWeight: '900', color: COLORS.text },
  details: { paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
  detailRow: { minHeight: 52, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', justifyContent: 'center', gap: 4 },
  lastDetailRow: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 10, color: COLORS.secondaryText },
  detailValue: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  locationPanel: { minHeight: 62, marginTop: 12, padding: 11, borderRadius: 11, backgroundColor: COLORS.orange50, flexDirection: 'row', alignItems: 'center', gap: 9 },
  locationIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1 },
  locationTitle: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  coordinates: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText, fontVariant: ['tabular-nums'] },
  primaryButton: { minHeight: 47, marginTop: 17, paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  loader: { marginTop: 40 },
  empty: { flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 16, fontSize: 16, fontWeight: '900', color: COLORS.text },
  emptyText: { maxWidth: 280, marginTop: 7, fontSize: 12, lineHeight: 18, color: COLORS.secondaryText, textAlign: 'center' },
});