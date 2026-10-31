import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import LocationMap from '@/components/LocationMap';
import type { LocationCoordinate } from '@/components/LocationMap.types';
import { loadAccountData } from '@/lib/accountStorage';
import { loadSellerStore, saveSellerStore, type Store } from '@/lib/catalogStorage';

const PALEMBANG: LocationCoordinate = { latitude: -2.9761, longitude: 104.7754 };
const DEFAULT_REGION: Region = { ...PALEMBANG, latitudeDelta: 0.018, longitudeDelta: 0.018 };
const STORE_TYPES = ['Makanan & Minuman', 'Toko Kelontong', 'Kue & Roti', 'Lainnya'];
const MERCHANT_CATEGORIES = ['Makanan Tradisional', 'Makanan Berat', 'Minuman', 'Camilan', 'Oleh-oleh'];
const STEPS = ['Informasi Outlet', 'Alamat Outlet', 'Kategori Merchant'];

export default function SellerRegistrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string | string[] }>();
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const editMode = editParam === 'true';
  const [loadedStore, setLoadedStore] = useState<Store | null>(null);
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [storeType, setStoreType] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [areaAddress, setAreaAddress] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [merchantCategory, setMerchantCategory] = useState('');
  const [hasQris, setHasQris] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [coordinate, setCoordinate] = useState<LocationCoordinate>(PALEMBANG);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([loadSellerStore(), loadAccountData()]).then(([store, account]) => {
      if (!active) return;
      setLoadedStore(store);
      if (store && !editMode) {
        router.replace('/seller/store-profile');
        return;
      }
      if (!store) {
        if (account.profile?.name) setOwnerName(account.profile.name);
        return;
      }
      setStoreName(store.name);
      setOwnerName(store.ownerName || account.profile?.name || '');
      setStoreType(store.storeType);
      setContactEmail(store.contactEmail);
      const [savedStreet, ...savedArea] = store.address.split(',');
      setStreetAddress(savedStreet.trim());
      setAreaAddress(savedArea.join(',').trim());
      setMerchantCategory(store.merchantCategory);
      setHasQris(store.hasQris);
      setIsOpen(store.isOpen);
      if (typeof store.latitude === 'number' && typeof store.longitude === 'number') {
        const savedCoordinate = { latitude: store.latitude, longitude: store.longitude };
        setCoordinate(savedCoordinate);
        setRegion((current) => ({ ...current, ...savedCoordinate }));
        setHasSelectedLocation(true);
      }
    }).catch((error: unknown) => {
      if (active) Alert.alert('Profil toko tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    });
    return () => { active = false; };
  }, [editMode, router]));

  const updateMapLocation = async (next: LocationCoordinate) => {
    setCoordinate(next);
    setRegion((current) => ({ ...current, ...next }));
    setHasSelectedLocation(true);
    try {
      if (Platform.OS === 'android') {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          const requested = await Location.requestForegroundPermissionsAsync();
          if (!requested.granted) return;
        }
      }
      const [place] = await Location.reverseGeocodeAsync(next);
      if (!place) return;
      const area = [place.region, place.city, place.subregion, place.district, place.postalCode]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(', ');
      const street = [place.streetNumber, place.street].filter((part): part is string => Boolean(part?.trim())).join(' ');
      if (area) setAreaAddress(area);
      if (street) setStreetAddress(street);
    } catch {
      return;
    }
  };

  const locateCurrentDevice = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Izin lokasi diperlukan', 'Izinkan akses lokasi agar titik outlet sesuai posisi perangkat.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await updateMapLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    } catch (error) {
      Alert.alert('Lokasi tidak tersedia', error instanceof Error ? error.message : 'Periksa pengaturan lokasi perangkat.');
    } finally {
      setLocating(false);
    }
  };

  const validateStep = () => {
    if (step === 0) {
      if (!storeName.trim() || !storeType) {
        Alert.alert('Informasi belum lengkap', 'Isi nama outlet dan pilih jenis toko.');
        return false;
      }
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
        Alert.alert('Email tidak valid', 'Periksa kembali alamat email atau kosongkan jika tidak ada.');
        return false;
      }
    }
    if (step === 1) {
      if (!areaAddress.trim() || !streetAddress.trim()) {
        Alert.alert('Alamat belum lengkap', 'Isi wilayah dan nama jalan outlet.');
        return false;
      }
      if (!hasSelectedLocation) {
        Alert.alert('Tentukan titik outlet', 'Geser pin di peta atau gunakan lokasi perangkat.');
        return false;
      }
    }
    if (step === 2 && (!merchantCategory || !termsAccepted)) {
      Alert.alert('Belum dapat dikirim', 'Pilih kategori merchant dan setujui syarat pendaftaran.');
      return;
    }
    return true;
  };

  const nextStep = () => {
    Keyboard.dismiss();
    if (!validateStep()) return;
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    void submit();
  };

  const submit = async () => {
    setSaving(true);
    try {
      await saveSellerStore({
        name: storeName.trim(),
        ownerName: ownerName.trim() || storeName.trim(),
        address: `${streetAddress.trim()}, ${areaAddress.trim()}`,
        storeType,
        merchantCategory,
        contactEmail: contactEmail.trim(),
        imageUrl: loadedStore?.imageUrl ?? null,
        hasQris,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        isOpen,
      });
      Alert.alert('Pendaftaran terkirim', 'Profil toko dan titik outlet berhasil disimpan.');
      router.replace('/seller');
    } catch (error) {
      Alert.alert('Pendaftaran tidak dapat disimpan', error instanceof Error ? error.message : 'Pastikan migrasi lokasi merchant sudah dijalankan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => step > 0 ? setStep((current) => current - 1) : router.replace('/seller')} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Kembali ke Pusat Penjual">
          <AppIcon name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>{loadedStore && editMode ? 'Edit Profil Toko' : 'Pendaftaran Merchant'}</Text>
        <Pressable onPress={() => Alert.alert('Pendaftaran Merchant', 'Lengkapi informasi outlet, tentukan titik peta, lalu kirim pendaftaran.')} style={styles.helpButton} accessibilityRole="button" accessibilityLabel="Bantuan">
          <AppIcon name="help-circle-outline" size={20} color={COLORS.secondaryText} />
        </Pressable>
      </View>
      <View style={styles.progressRow}>{STEPS.map((label, index) => <View key={label} style={[styles.progressTrack, index <= step && styles.progressActive]} />)}</View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 0 && <>
          <Text style={styles.sectionTitle}>Informasi Outlet</Text>
          <TextInput value={storeName} onChangeText={setStoreName} style={styles.input} placeholder="Nama Outlet" placeholderTextColor={COLORS.muted} />
          <Text style={styles.hint}>Nama toko yang akan ditampilkan kepada pembeli.</Text>
          <Text style={styles.label}>Jenis Toko</Text>
          <View style={styles.choiceList}>{STORE_TYPES.map((type) => <Pressable key={type} onPress={() => setStoreType(type)} style={[styles.choice, storeType === type && styles.choiceActive]}><Text style={[styles.choiceText, storeType === type && styles.choiceTextActive]}>{type}</Text><AppIcon name={storeType === type ? 'radio-button-on' : 'radio-button-off'} size={19} color={storeType === type ? COLORS.primary : COLORS.muted} /></Pressable>)}</View>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Informasi Kontak (Opsional)</Text>
          <TextInput value={contactEmail} onChangeText={setContactEmail} style={styles.input} placeholder="Alamat Email" placeholderTextColor={COLORS.muted} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.hint}>Email digunakan untuk menerima informasi terkait toko.</Text>
        </>}

        {step === 1 && <>
          <Text style={styles.sectionTitle}>Alamat Outlet</Text>
          <Text style={styles.description}>Pilih titik outlet dengan menggeser pin atau gunakan lokasi perangkat agar alamat lebih akurat.</Text>
          <TextInput value={areaAddress} onChangeText={setAreaAddress} style={styles.input} placeholder="Provinsi, Kota, Kecamatan, Kode Pos" placeholderTextColor={COLORS.muted} />
          <TextInput value={streetAddress} onChangeText={setStreetAddress} style={styles.input} placeholder="Jalan dan nomor outlet" placeholderTextColor={COLORS.muted} />
          <View style={styles.mapHeader}>
            <Text style={styles.label}>Titik lokasi outlet</Text>
            <Pressable style={styles.locationButton} onPress={() => void locateCurrentDevice()} disabled={locating}>
              {locating ? <ActivityIndicator size="small" color={COLORS.primary} /> : <AppIcon name="location" size={16} color={COLORS.primary} />}
              <Text style={styles.locationButtonText}>Lokasi saya</Text>
            </Pressable>
          </View>
          <View style={styles.mapWrap}>
            <LocationMap coordinate={coordinate} region={region} onCoordinateChange={(next) => void updateMapLocation(next)} onRegionChange={setRegion} />
            <View style={styles.coordinateTag}><AppIcon name="location" size={13} color={COLORS.primary} /><Text style={styles.coordinateText}>{coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}</Text></View>
          </View>
          <Text style={styles.hint}>{hasSelectedLocation ? 'Titik lokasi outlet sudah dipilih.' : 'Ketuk peta, geser pin, atau pilih lokasi perangkat.'}</Text>
        </>}

        {step === 2 && <>
          <Text style={styles.sectionTitle}>Kategori Merchant</Text>
          <Text style={styles.label}>Kategori usaha</Text>
          <View style={styles.choiceList}>{MERCHANT_CATEGORIES.map((category) => <Pressable key={category} onPress={() => setMerchantCategory(category)} style={[styles.choice, merchantCategory === category && styles.choiceActive]}><Text style={[styles.choiceText, merchantCategory === category && styles.choiceTextActive]}>{category}</Text><AppIcon name={merchantCategory === category ? 'radio-button-on' : 'radio-button-off'} size={19} color={merchantCategory === category ? COLORS.primary : COLORS.muted} /></Pressable>)}</View>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Apakah outlet Anda sudah memiliki QRIS?</Text>
          <View style={styles.qrisRow}>{[true, false].map((value) => <Pressable key={String(value)} onPress={() => setHasQris(value)} style={styles.qrisOption}><AppIcon name={hasQris === value ? 'radio-button-on' : 'radio-button-off'} size={19} color={hasQris === value ? COLORS.primary : COLORS.muted} /><Text style={styles.choiceText}>{value ? 'Ya' : 'Tidak'}</Text></Pressable>)}</View>
          <View style={styles.openRow}><View><Text style={styles.openTitle}>Status outlet</Text><Text style={styles.openSubtitle}>{isOpen ? 'Menerima pesanan' : 'Sementara tutup'}</Text></View><Switch value={isOpen} onValueChange={setIsOpen} trackColor={{ false: '#E5E5E5', true: '#FDBA74' }} thumbColor={isOpen ? COLORS.primary : '#fff'} /></View>
          <Pressable style={styles.termsRow} onPress={() => setTermsAccepted((current) => !current)} accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }}>
            <AppIcon name={termsAccepted ? 'checkbox' : 'checkbox-outline'} size={20} color={termsAccepted ? COLORS.primary : COLORS.muted} />
            <Text style={styles.termsText}>Saya menyetujui informasi pendaftaran toko ini benar dan dapat ditampilkan kepada pembeli.</Text>
          </Pressable>
        </>}
      </ScrollView>
      <View style={styles.footer}>
        {step > 0 && <Pressable style={styles.previousButton} onPress={() => setStep((current) => current - 1)}><Text style={styles.previousText}>Sebelumnya</Text></Pressable>}
        <Pressable onPress={nextStep} disabled={saving} style={[styles.nextButton, step > 0 && styles.nextButtonFlex, saving && styles.buttonDisabled]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{step === STEPS.length - 1 ? 'Kirim' : 'Selanjutnya'}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1EFEF' },
  header: { height: 58, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  backButton: { width: 36, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  helpButton: { width: 36, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  progressRow: { height: 22, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#fff' },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E9E5E5' },
  progressActive: { backgroundColor: COLORS.primary },
  content: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 17, paddingBottom: 28, backgroundColor: '#fff' },
  sectionTitle: { marginBottom: 12, fontSize: 13, fontWeight: '800', color: COLORS.text },
  description: { marginTop: -5, marginBottom: 14, fontSize: 11, lineHeight: 17, color: COLORS.secondaryText },
  label: { marginTop: 17, marginBottom: 8, fontSize: 12, fontWeight: '700', color: COLORS.text },
  input: { minHeight: 48, marginBottom: 10, paddingHorizontal: 13, borderRadius: 3, backgroundColor: '#FAF8F8', fontSize: 12, color: COLORS.text },
  hint: { marginTop: 1, fontSize: 10, lineHeight: 15, color: COLORS.secondaryText },
  choiceList: { gap: 7 },
  choice: { minHeight: 46, paddingHorizontal: 12, borderRadius: 3, backgroundColor: '#FAF8F8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceActive: { borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.orange50 },
  choiceText: { fontSize: 12, color: COLORS.text },
  choiceTextActive: { color: COLORS.primary, fontWeight: '800' },
  divider: { height: 1, marginVertical: 19, backgroundColor: '#EEEAEA' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 8, backgroundColor: COLORS.orange50, flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationButtonText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  mapWrap: { height: 230, marginTop: 3, position: 'relative', overflow: 'hidden', backgroundColor: '#E9EFEA' },
  coordinateTag: { position: 'absolute', left: 9, bottom: 9, minHeight: 28, paddingHorizontal: 8, borderRadius: 7, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 4 },
  coordinateText: { fontSize: 9, color: COLORS.secondaryText, fontVariant: ['tabular-nums'] },
  qrisRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 26 },
  qrisOption: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  openRow: { minHeight: 54, marginTop: 10, paddingHorizontal: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEEAEA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openTitle: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  openSubtitle: { marginTop: 2, fontSize: 10, color: COLORS.secondaryText },
  termsRow: { minHeight: 56, marginTop: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  termsText: { flex: 1, fontSize: 10, lineHeight: 15, color: COLORS.secondaryText },
  footer: { minHeight: 76, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff' },
  previousButton: { minWidth: 108, height: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  previousText: { fontSize: 12, fontWeight: '800', color: COLORS.secondaryText },
  nextButton: { height: 46, paddingHorizontal: 26, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  nextButtonFlex: { flex: 1 },
  buttonDisabled: { opacity: 0.6 },
  saveText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
