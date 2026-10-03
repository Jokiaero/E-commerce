import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import { AppIcon } from '@/components/AppIcon';
import LocationMap from '@/components/LocationMap';
import type { LocationCoordinate } from '@/components/LocationMap.types';
import { COLORS } from '@/constants/theme';
import { EMPTY_ACCOUNT, loadAccountData, saveAccountAddress, type AccountData } from '@/lib/accountStorage';

const PALembang: LocationCoordinate = { latitude: -2.9761, longitude: 104.7754 };
const DEFAULT_REGION: Region = { ...PALembang, latitudeDelta: 0.012, longitudeDelta: 0.012 };
const LOCATION_SUGGESTIONS = [
  { title: 'Apotek Bintang Farma', address: 'Jalan S. Prawira Simpang V, Sukabangun, Palembang', type: 'Apotek' },
  { title: 'Kioku Corp', address: 'Jalan S. Prawiro No. 3, Sukabangun, Palembang', type: 'Toko' },
  { title: 'Masjid At Taqwa', address: 'Jalan H. Sanusi Gang Lorong Bilal, Sukabangun, Palembang', type: 'Tempat ibadah' },
  { title: 'Jalan S. Prawiro Gang Lorong Bilal I', address: 'Sukabangun, Palembang, Sumatera Selatan', type: 'Jalan' },
  { title: 'CV. Nalandra Putra Sriwijaya', address: 'Jalan S. Prawiro No. 1, Lebong Siarang, Palembang', type: 'Kantor' },
];

function formatAddress(address: Location.LocationGeocodedAddress | undefined, coordinate: LocationCoordinate): string {
  if (!address) return `Titik peta ${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
  const parts = [address.name, address.street, address.streetNumber, address.district, address.city, address.region]
    .filter((part): part is string => Boolean(part?.trim()));
  return [...new Set(parts)].join(', ') || `Titik peta ${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
}

export default function LocationScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountData>(EMPTY_ACCOUNT);
  const [coordinate, setCoordinate] = useState<LocationCoordinate>(PALembang);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [addressText, setAddressText] = useState('Palembang, Sumatera Selatan');
  const [search, setSearch] = useState('');
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadAccountData().then((data) => {
      if (!active) return;
      setAccount(data);
      const savedAddress = data.address;
      if (savedAddress?.details) {
        setAddressText(savedAddress.details);
        setSearch(savedAddress.details);
        if (typeof savedAddress.latitude === 'number' && typeof savedAddress.longitude === 'number') {
          const savedCoordinate = { latitude: savedAddress.latitude, longitude: savedAddress.longitude };
          setCoordinate(savedCoordinate);
          setRegion((current) => ({ ...current, ...savedCoordinate }));
        } else {
          void (async () => {
            try {
              if (Platform.OS === 'android' && !(await Location.getForegroundPermissionsAsync()).granted) return;
              const [geocoded] = await Location.geocodeAsync(savedAddress.details);
              if (!active || !geocoded) return;
              const savedCoordinate = { latitude: geocoded.latitude, longitude: geocoded.longitude };
              setCoordinate(savedCoordinate);
              setRegion((current) => ({ ...current, ...savedCoordinate }));
            } catch {
              return;
            }
          })();
        }
      }
    }).catch((error: unknown) => {
      if (active) Alert.alert('Alamat tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi.');
    });
    return () => { active = false; };
  }, []));

  const applyGeocodedPoint = async (next: LocationCoordinate) => {
    setCoordinate(next);
    setRegion((current) => ({ ...current, ...next }));
    try {
      const [address] = await Location.reverseGeocodeAsync(next);
      setAddressText(formatAddress(address, next));
    } catch {
      setAddressText(`Titik peta ${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}`);
    }
  };

  const handleSearch = async () => {
    const query = search.trim();
    if (!query) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      if (Platform.OS === 'android') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Izin lokasi diperlukan', 'Izinkan akses lokasi untuk mencari alamat di peta.');
          return;
        }
      }
      const [result] = await Location.geocodeAsync(`${query}, Palembang, Indonesia`);
      if (!result) {
        Alert.alert('Lokasi tidak ditemukan', 'Coba masukkan nama jalan, tempat, atau kecamatan.');
        return;
      }
      await applyGeocodedPoint(result);
      setSuggestionsVisible(false);
    } catch (error) {
      Alert.alert('Pencarian gagal', error instanceof Error ? error.message : 'Periksa koneksi dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const goToCurrentLocation = async () => {
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Izin lokasi diperlukan', 'Aktifkan izin lokasi untuk menggunakan posisi perangkat.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      await applyGeocodedPoint(next);
      setSearch('Lokasi saya');
      setSuggestionsVisible(false);
    } catch (error) {
      Alert.alert('Lokasi tidak tersedia', error instanceof Error ? error.message : 'Pastikan layanan lokasi aktif.');
    } finally {
      setLoading(false);
    }
  };

  const openGoogleMaps = async () => {
    const query = `${coordinate.latitude},${coordinate.longitude}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Google Maps tidak dapat dibuka', 'Coba buka tautan dari browser perangkat.');
    }
  };

  const confirmLocation = async () => {
    setSaving(true);
    try {
      await saveAccountAddress({
        label: account.address?.label ?? 'Rumah',
        recipient: account.address?.recipient ?? account.profile?.name ?? 'Penerima',
        phone: account.address?.phone ?? account.profile?.phone ?? '',
        details: addressText,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
      Alert.alert('Lokasi tersimpan', 'Alamat ini akan digunakan sebagai alamat pengiriman.', [
        { text: 'Selesai', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Lokasi belum tersimpan', error instanceof Error ? error.message : 'Masuk ke akun untuk menyimpan alamat.');
    } finally {
      setSaving(false);
    }
  };

  const savedAddress = account.address?.details;
  const searchTerm = search.trim().toLocaleLowerCase('id-ID');
  const visibleSuggestions = LOCATION_SUGGESTIONS.filter((suggestion) =>
    !searchTerm || `${suggestion.title} ${suggestion.address} ${suggestion.type}`.toLocaleLowerCase('id-ID').includes(searchTerm),
  );

  const selectSuggestion = async (suggestion: (typeof LOCATION_SUGGESTIONS)[number]) => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      if (Platform.OS === 'android') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Izin lokasi diperlukan', 'Izinkan akses lokasi untuk mencari alamat di peta.');
          return;
        }
      }
      const [result] = await Location.geocodeAsync(`${suggestion.address}, Indonesia`);
      if (!result) {
        Alert.alert('Lokasi tidak ditemukan', 'Coba pilih alamat lain atau geser pin pada peta.');
        return;
      }
      const next = { latitude: result.latitude, longitude: result.longitude };
      setCoordinate(next);
      setRegion((current) => ({ ...current, ...next }));
      setAddressText(`${suggestion.title}, ${suggestion.address}`);
      setSearch(suggestion.title);
      setSuggestionsVisible(false);
    } catch (error) {
      Alert.alert('Lokasi tidak dapat dicari', error instanceof Error ? error.message : 'Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Kembali">
          <AppIcon name="chevron-back" size={23} color={COLORS.primary} />
        </Pressable>
        <View style={styles.searchBox}>
          <AppIcon name="search" size={17} color={COLORS.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => {
              setSuggestionsVisible(true);
              if (search === addressText) setSearch('');
            }}
            onSubmitEditing={() => void handleSearch()}
            returnKeyType="search"
            placeholder="Cari jalan atau tempat"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
          <Pressable onPress={() => void handleSearch()} accessibilityRole="button" accessibilityLabel="Cari lokasi">
            <AppIcon name="arrow-forward" size={18} color={COLORS.primary} />
          </Pressable>
        </View>
        <Pressable style={styles.mapsButton} onPress={() => void openGoogleMaps()} accessibilityRole="button" accessibilityLabel="Buka di Google Maps">
          <AppIcon name="location-outline" size={20} color={COLORS.primary} />
        </Pressable>
      </View>

      <View style={styles.notice}>
        <AppIcon name="information-circle-outline" size={17} color={COLORS.primary} />
        <Text style={styles.noticeText}>Geser peta atau pin untuk menentukan alamat pengiriman.</Text>
      </View>

      <View style={styles.mapWrap}>
        <LocationMap
          coordinate={coordinate}
          region={region}
          onCoordinateChange={(next) => void applyGeocodedPoint(next)}
          onRegionChange={setRegion}
        />
        <Pressable style={styles.currentButton} onPress={() => void goToCurrentLocation()} accessibilityRole="button" accessibilityLabel="Gunakan lokasi saat ini">
          {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <AppIcon name="location" size={21} color={COLORS.primary} />}
        </Pressable>
        <View style={styles.coordinateTag}>
          <AppIcon name="location" size={14} color={COLORS.primary} />
          <Text style={styles.coordinateText}>{coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}</Text>
        </View>
      </View>

      <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent} keyboardShouldPersistTaps="handled">
        {suggestionsVisible ? (
          <View>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{searchTerm ? 'Hasil pencarian' : 'Rekomendasi alamat'}</Text>
                <Text style={styles.sectionSubtitle}>Contoh lokasi sekitar Palembang</Text>
              </View>
              <Pressable onPress={() => setSuggestionsVisible(false)} accessibilityRole="button" accessibilityLabel="Tutup rekomendasi">
                <AppIcon name="chevron-down" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            {visibleSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.title}
                style={styles.suggestionRow}
                onPress={() => void selectSuggestion(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={`Pilih ${suggestion.title}, ${suggestion.address}`}
              >
                <View style={styles.suggestionIcon}><AppIcon name="location-outline" size={17} color={COLORS.secondaryText} /></View>
                <View style={styles.addressCopy}>
                  <View style={styles.suggestionTitleRow}>
                    <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                    <Text style={styles.suggestionType}>{suggestion.type}</Text>
                  </View>
                  <Text style={styles.suggestionAddress} numberOfLines={2}>{suggestion.address}</Text>
                </View>
                <AppIcon name="chevron-forward" size={17} color={COLORS.muted} />
              </Pressable>
            ))}
            {visibleSuggestions.length === 0 && <Text style={styles.noSuggestions}>Tidak ada saran. Tekan cari untuk mencari alamat.</Text>}
          </View>
        ) : (
          <>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Lokasi yang dipilih</Text>
            <Text style={styles.sectionSubtitle}>Palembang, Sumatera Selatan</Text>
          </View>
          <Pressable style={styles.googleButton} onPress={() => void openGoogleMaps()} accessibilityRole="button">
            <AppIcon name="arrow-forward" size={15} color={COLORS.primary} />
            <Text style={styles.googleButtonText}>Google Maps</Text>
          </Pressable>
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressIcon}><AppIcon name="location" size={19} color={COLORS.primary} /></View>
          <View style={styles.addressCopy}>
            <Text style={styles.addressLabel}>{account.address?.label ?? 'Alamat baru'}</Text>
            <Text style={styles.addressText}>{addressText}</Text>
            {savedAddress && savedAddress !== addressText && <Text style={styles.previousAddress}>Alamat tersimpan: {savedAddress}</Text>}
          </View>
        </View>

        {savedAddress && (
          <Pressable style={styles.savedAddressRow} onPress={() => {
            setAddressText(savedAddress);
            setSearch(savedAddress);
          }} accessibilityRole="button">
            <AppIcon name="home" size={18} color={COLORS.secondaryText} />
            <View style={styles.addressCopy}>
              <Text style={styles.savedAddressTitle}>Gunakan alamat tersimpan</Text>
              <Text style={styles.savedAddressDescription} numberOfLines={1}>{savedAddress}</Text>
            </View>
            <AppIcon name="chevron-forward" size={17} color={COLORS.muted} />
          </Pressable>
        )}

        <Pressable style={[styles.confirmButton, saving && styles.buttonDisabled]} onPress={() => void confirmLocation()} disabled={saving} accessibilityRole="button">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Konfirmasi Lokasi</Text>}
        </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  back: { width: 30, height: 42, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flex: 1, height: 40, borderRadius: 11, backgroundColor: '#F3F4F5', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 12, color: COLORS.text },
  mapsButton: { width: 35, height: 40, alignItems: 'center', justifyContent: 'center' },
  notice: { minHeight: 38, paddingHorizontal: 15, backgroundColor: '#FFF5E6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, color: '#5A4C39' },
  mapWrap: { height: 310, position: 'relative', backgroundColor: '#E9EFEA' },
  currentButton: { position: 'absolute', right: 14, bottom: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  coordinateTag: { position: 'absolute', left: 12, bottom: 14, minHeight: 31, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 5 },
  coordinateText: { fontSize: 10, color: COLORS.secondaryText, fontVariant: ['tabular-nums'] },
  details: { flex: 1, backgroundColor: '#fff' },
  detailsContent: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 22 },
  sectionHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  sectionSubtitle: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText },
  googleButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.orange100, flexDirection: 'row', alignItems: 'center', gap: 5 },
  googleButtonText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  addressCard: { minHeight: 75, marginTop: 11, padding: 12, borderRadius: 13, backgroundColor: '#FAFAFA', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  addressCopy: { flex: 1 },
  addressLabel: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  addressText: { marginTop: 4, fontSize: 11, lineHeight: 16, color: COLORS.secondaryText },
  previousAddress: { marginTop: 5, fontSize: 10, lineHeight: 14, color: COLORS.muted },
  savedAddressRow: { minHeight: 61, marginTop: 8, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedAddressTitle: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  savedAddressDescription: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText },
  suggestionRow: { minHeight: 67, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  suggestionIcon: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  suggestionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  suggestionTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.text },
  suggestionType: { fontSize: 9, color: COLORS.secondaryText },
  suggestionAddress: { marginTop: 4, fontSize: 10, lineHeight: 15, color: COLORS.secondaryText },
  noSuggestions: { paddingVertical: 22, fontSize: 11, textAlign: 'center', color: COLORS.secondaryText },
  confirmButton: { minHeight: 48, marginTop: 16, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  buttonDisabled: { opacity: 0.65 },
});