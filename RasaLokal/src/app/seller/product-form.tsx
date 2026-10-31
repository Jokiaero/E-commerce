import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ProductCategory } from '@/constants/data';
import { AppIcon } from '@/components/AppIcon';
import { useSafeBack } from '@/hooks/useSafeBack';
import { COLORS } from '@/constants/theme';
import { loadSellerProducts, loadSellerStore, saveProduct, uploadProductPhoto } from '@/lib/catalogStorage';
import type { ProductVariant } from '@/lib/catalogStorage';

const PHOTO_LIMIT = 5 * 1024 * 1024;
const UNITS = ['pcs', 'porsi', 'botol', 'bungkus', 'box', 'kg', 'gram', 'liter'];
const CATEGORIES: ProductCategory[] = ['Makanan', 'Minuman', 'Camilan', 'Oleh-oleh'];

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export default function SellerProductFormScreen() {
  const router = useRouter();
  const safeBack = useSafeBack('/seller/products');
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [category, setCategory] = useState<ProductCategory>('Makanan');
  const [photoAsset, setPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useFocusEffect(useCallback(() => {
    if (!productId) return;
    let active = true;
    void loadSellerProducts().then((products) => {
      const product = products.find((item) => item.id === productId);
      if (!active) return;
      if (!product) {
        Alert.alert('Produk tidak ditemukan', 'Produk ini tidak ada di toko Anda.');
        router.replace('/seller');
        return;
      }
      setName(product.name);
      setDescription(product.description);
      setPrice(String(product.price));
      setStock(String(product.details.stock));
      setUnit(product.details.unit);
      setCategory(product.category);
      setImageUrl(product.image);
      setSku(product.details.sku ?? '');
      setPromoPrice(product.details.promoPrice ? String(product.details.promoPrice) : '');
      setWeight(product.details.weight ? String(product.details.weight) : '');
      setVariants(product.details.variants);
      setIsAvailable(product.isAvailable);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Data produk tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    });
    return () => { active = false; };
  }, [productId, router]));

  const numericPrice = Number(price);
  const numericStock = Number(stock);
  const numericPromoPrice = Number(promoPrice);
  const numericWeight = Number(weight);
  const priceValid = price !== '' && Number.isFinite(numericPrice) && numericPrice > 0;
  const stockValid = stock !== '' && Number.isInteger(numericStock) && numericStock >= 0;
  const promoValid = promoPrice === '' || (Number.isFinite(numericPromoPrice) && numericPromoPrice > 0 && numericPromoPrice < numericPrice);
  const weightValid = weight === '' || (Number.isFinite(numericWeight) && numericWeight > 0);
  const variantsValid = variants.every((variant) => Boolean(variant.name.trim()) && variant.price > 0 && variant.stock >= 0);
  const formValid = Boolean(name.trim() && description.trim() && priceValid && stockValid && promoValid && weightValid && variantsValid);

  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }));
  const fieldError = (field: string, invalid: boolean, message: string) => touched[field] && invalid ? <Text style={styles.errorText}>{message}</Text> : null;

  const pickPhoto = async () => {
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
      if (asset.fileSize !== undefined && asset.fileSize > PHOTO_LIMIT) {
        setPhotoError('Ukuran foto maksimal 5 MB. Pilih foto lain.');
        return;
      }
      setPhotoAsset(asset);
      setImageUrl(null);
    } catch {
      setPhotoError('Foto tidak dapat dibuka. Coba pilih foto lain.');
    }
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: string) => {
    setVariants((current) => current.map((variant, itemIndex) => {
      if (itemIndex !== index) return variant;
      if (field === 'name') return { ...variant, name: value };
      return { ...variant, [field]: value === '' ? 0 : Number(digitsOnly(value)) };
    }));
  };

  const submit = async () => {
    setTouched({ name: true, description: true, price: true, stock: true, promoPrice: true, weight: true });
    setFormError('');
    if (!formValid) return;

    setSaving(true);
    try {
      const store = await loadSellerStore();
      if (!store) {
        setFormError('Lengkapi profil toko sebelum menyimpan produk.');
        return;
      }
      let savedImage = imageUrl;
      if (photoAsset) {
        setUploadingPhoto(true);
        savedImage = await uploadProductPhoto(photoAsset);
        setUploadingPhoto(false);
      }
      await saveProduct({
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        category,
        image: savedImage,
        isAvailable,
        details: {
          sku: sku.trim() || null,
          promoPrice: promoPrice ? numericPromoPrice : null,
          stock: numericStock,
          unit,
          weight: weight ? numericWeight : null,
          variants,
        },
      }, productId);
      router.replace('/seller');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Produk tidak dapat disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  const previewUri = photoAsset?.uri ?? imageUrl;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={safeBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Kembali">
            <AppIcon name="chevron-back" size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{productId ? 'Edit Produk' : 'Tambah Produk'}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={styles.photoHeading}>
              <View><Text style={styles.sectionTitle}>Foto Produk</Text><Text style={styles.sectionHint}>Maksimal 5 MB untuk satu foto</Text></View>
            </View>
            {previewUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: previewUri }} style={styles.photoPreview} />
                <View style={styles.mainPhotoTag}><Text style={styles.mainPhotoText}>Foto utama produk</Text></View>
                <Pressable
                  onPress={() => { setPhotoAsset(null); setImageUrl(null); }}
                  style={styles.removePhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus foto produk"
                >
                  <AppIcon name="trash" size={17} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => void pickPhoto()} style={styles.photoPicker} accessibilityRole="button" accessibilityLabel="Tambah foto produk">
                <View style={styles.photoAddIcon}><AppIcon name="add" size={22} color={COLORS.primary} /></View>
                <Text style={styles.photoPickerTitle}>Tambah Foto</Text>
                <Text style={styles.photoPickerHint}>Foto utama produk · Opsional</Text>
              </Pressable>
            )}
            {previewUri && <Pressable onPress={() => void pickPhoto()} style={styles.changePhoto}><AppIcon name="add" size={16} color={COLORS.primary} /><Text style={styles.changePhotoText}>Ganti Foto</Text></Pressable>}
            {photoError !== '' && <Text style={styles.errorText}>{photoError}</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informasi utama</Text>
            <Text style={styles.label}>Nama Produk</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              onBlur={() => markTouched('name')}
              placeholder="Contoh: Pempek Kapal Selam"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, touched.name && !name.trim() && styles.inputError]}
              maxLength={80}
              returnKeyType="next"
            />
            {fieldError('name', !name.trim(), 'Nama produk wajib diisi')}

            <Text style={styles.label}>Deskripsi</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              onBlur={() => markTouched('description')}
              placeholder="Jelaskan bahan, isi, atau keunggulan produk..."
              placeholderTextColor={COLORS.muted}
              style={[styles.input, styles.descriptionInput, touched.description && !description.trim() && styles.inputError]}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            {fieldError('description', !description.trim(), 'Deskripsi wajib diisi')}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Harga dan stok</Text>
            <Text style={styles.label}>Harga</Text>
            <View style={[styles.currencyInput, touched.price && !priceValid && styles.inputError]}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                value={price}
                onChangeText={(value) => setPrice(digitsOnly(value))}
                onBlur={() => markTouched('price')}
                placeholder="25.000"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
                style={styles.currencyField}
              />
            </View>
            {fieldError('price', !priceValid, 'Harga harus lebih dari 0')}

            <View style={styles.stockRow}>
              <View style={styles.stockField}>
                <Text style={styles.label}>Stok</Text>
                <TextInput
                  value={stock}
                  onChangeText={(value) => setStock(digitsOnly(value))}
                  onBlur={() => markTouched('stock')}
                  placeholder="50"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                  style={[styles.input, touched.stock && !stockValid && styles.inputError]}
                />
                {fieldError('stock', !stockValid, stock === '' ? 'Stok wajib diisi' : 'Stok tidak boleh negatif')}
              </View>
              <View style={styles.unitField}>
                <Text style={styles.label}>Satuan</Text>
                <Pressable onPress={() => setUnitPickerOpen(true)} style={styles.selectInput} accessibilityRole="button" accessibilityLabel={`Satuan ${unit}`}>
                  <Text style={styles.selectText}>{unit}</Text><AppIcon name="chevron-down" size={17} color={COLORS.muted} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kategori</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((item) => {
                const active = category === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setCategory(item)}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Pressable
              onPress={() => setSettingsOpen((open) => !open)}
              style={styles.settingsToggle}
              accessibilityRole="button"
              accessibilityState={{ expanded: settingsOpen }}
            >
              <Text style={styles.settingsTitle}>Pengaturan lainnya</Text>
              <AppIcon name="chevron-down" size={19} color={COLORS.secondaryText} style={settingsOpen ? styles.chevronOpen : undefined} />
            </Pressable>
            {settingsOpen && <View style={styles.settingsContent}>
              <Text style={styles.label}>SKU / Kode Produk <Text style={styles.optional}>(opsional)</Text></Text>
              <TextInput value={sku} onChangeText={setSku} placeholder="Contoh: PMK-001" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="characters" />

              <Text style={styles.label}>Harga Promo <Text style={styles.optional}>(opsional)</Text></Text>
              <View style={[styles.currencyInput, touched.promoPrice && !promoValid && styles.inputError]}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput value={promoPrice} onChangeText={(value) => setPromoPrice(digitsOnly(value))} onBlur={() => markTouched('promoPrice')} placeholder="20.000" placeholderTextColor={COLORS.muted} keyboardType="number-pad" style={styles.currencyField} />
              </View>
              {fieldError('promoPrice', !promoValid, 'Harga promo harus lebih dari 0 dan di bawah harga normal')}

              <View style={styles.variantHeading}>
                <View><Text style={styles.labelTight}>Varian Produk</Text><Text style={styles.sectionHint}>Tambahkan ukuran atau pilihan lainnya</Text></View>
                <Pressable
                  onPress={() => setVariants((current) => [...current, { name: '', price: numericPrice || 0, stock: 0 }])}
                  style={styles.addVariantButton}
                  accessibilityRole="button"
                  accessibilityLabel="Tambah varian"
                >
                  <AppIcon name="add" size={16} color={COLORS.primary} /><Text style={styles.addVariantText}>Tambah Varian</Text>
                </Pressable>
              </View>
              {variants.map((variant, index) => (
                <View key={`variant-${index}`} style={styles.variantCard}>
                  <View style={styles.variantTop}><Text style={styles.variantLabel}>Varian {index + 1}</Text><Pressable onPress={() => setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))} accessibilityRole="button" accessibilityLabel={`Hapus varian ${index + 1}`}><AppIcon name="trash" size={17} color={COLORS.danger} /></Pressable></View>
                  <TextInput value={variant.name} onChangeText={(value) => updateVariant(index, 'name', value)} placeholder="Nama varian, mis. Small" placeholderTextColor={COLORS.muted} style={styles.input} />
                  <View style={styles.variantValues}>
                    <View style={styles.variantValue}><Text style={styles.miniLabel}>Harga</Text><TextInput value={variant.price ? String(variant.price) : ''} onChangeText={(value) => updateVariant(index, 'price', value)} placeholder="10.000" placeholderTextColor={COLORS.muted} keyboardType="number-pad" style={styles.input} /></View>
                    <View style={styles.variantValue}><Text style={styles.miniLabel}>Stok</Text><TextInput value={String(variant.stock)} onChangeText={(value) => updateVariant(index, 'stock', value)} placeholder="20" placeholderTextColor={COLORS.muted} keyboardType="number-pad" style={styles.input} /></View>
                  </View>
                </View>
              ))}

              <Text style={styles.label}>Berat Produk <Text style={styles.optional}>(opsional)</Text></Text>
              <View style={[styles.weightInput, touched.weight && !weightValid && styles.inputError]}>
                <TextInput value={weight} onChangeText={(value) => setWeight(value.replace(/[^\d.]/g, ''))} onBlur={() => markTouched('weight')} placeholder="250" placeholderTextColor={COLORS.muted} keyboardType="decimal-pad" style={styles.weightField} />
                <Text style={styles.weightUnit}>gram</Text>
              </View>
              {fieldError('weight', !weightValid, 'Berat harus lebih dari 0')}

              <View style={styles.availabilityRow}>
                <View><Text style={styles.availabilityTitle}>Status Produk</Text><Text style={styles.sectionHint}>Produk aktif dapat dilihat pembeli</Text></View>
                <View style={styles.activeControl}><Text style={styles.activeText}>{isAvailable ? 'Aktif' : 'Nonaktif'}</Text><Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ false: '#E5E5E5', true: '#FDBA74' }} thumbColor={isAvailable ? COLORS.primary : '#fff'} /></View>
              </View>
            </View>}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {formError !== '' && <Text style={styles.formError}>{formError}</Text>}
          <Pressable onPress={() => void submit()} disabled={!formValid || saving} style={[styles.saveButton, (!formValid || saving) && styles.saveButtonDisabled]} accessibilityRole="button">
            {saving && <ActivityIndicator size="small" color="#fff" />}
            <Text style={styles.saveText}>{uploadingPhoto ? 'Mengunggah foto...' : saving ? 'Menyimpan...' : 'Simpan Produk'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={unitPickerOpen} transparent animationType="fade" onRequestClose={() => setUnitPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUnitPickerOpen(false)}>
          <View style={styles.unitSheet}>
            <Text style={styles.unitSheetTitle}>Pilih Satuan</Text>
            {UNITS.map((item) => (
              <Pressable key={item} onPress={() => { setUnit(item); setUnitPickerOpen(false); }} style={styles.unitOption}>
                <Text style={[styles.unitOptionText, item === unit && styles.unitOptionTextActive]}>{item}</Text>
                {item === unit && <AppIcon name="checkbox" size={18} color={COLORS.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  keyboard: { flex: 1 },
  header: { height: 62, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: COLORS.text },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 22 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  sectionHint: { marginTop: 4, fontSize: 10, color: COLORS.secondaryText },
  photoHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  photoPicker: { height: 148, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E4E4E4', borderRadius: 16, backgroundColor: '#FCFCFC', alignItems: 'center', justifyContent: 'center' },
  photoAddIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  photoPickerTitle: { marginTop: 8, fontSize: 12, fontWeight: '900', color: COLORS.primary },
  photoPickerHint: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText },
  photoPreviewWrap: { height: 178, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  photoPreview: { width: '100%', height: '100%' },
  mainPhotoTag: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.94)' },
  mainPhotoText: { fontSize: 10, fontWeight: '800', color: COLORS.text },
  removePhoto: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  changePhoto: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9, paddingVertical: 4 },
  changePhotoText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  label: { marginTop: 15, marginBottom: 7, fontSize: 11, fontWeight: '800', color: COLORS.text },
  labelTight: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  optional: { fontSize: 10, fontWeight: '500', color: COLORS.secondaryText },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', fontSize: 12, color: COLORS.text },
  inputError: { borderColor: COLORS.danger },
  descriptionInput: { height: 88, paddingTop: 11, textAlignVertical: 'top' },
  errorText: { marginTop: 5, fontSize: 10, color: COLORS.danger },
  currencyInput: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
  currencyPrefix: { fontSize: 12, fontWeight: '800', color: COLORS.secondaryText },
  currencyField: { flex: 1, height: 46, marginLeft: 9, fontSize: 13, fontWeight: '700', color: COLORS.text },
  stockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stockField: { flex: 1.15 },
  unitField: { flex: 0.85 },
  selectInput: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
  selectText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  categoryChip: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center' },
  categoryChipActive: { backgroundColor: COLORS.primary },
  categoryText: { fontSize: 10, fontWeight: '800', color: COLORS.secondaryText },
  categoryTextActive: { color: '#fff' },
  settingsSection: { marginTop: -2, borderTopWidth: 1, borderTopColor: COLORS.border, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsToggle: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  settingsContent: { paddingBottom: 18 },
  variantHeading: { marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  addVariantButton: { minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.orange50, borderRadius: 10 },
  addVariantText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  variantCard: { padding: 11, marginTop: 8, gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, backgroundColor: '#FCFCFC' },
  variantTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  variantLabel: { fontSize: 10, fontWeight: '800', color: COLORS.secondaryText },
  variantValues: { flexDirection: 'row', gap: 9 },
  variantValue: { flex: 1 },
  miniLabel: { marginBottom: 5, fontSize: 9, fontWeight: '700', color: COLORS.secondaryText },
  weightInput: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
  weightField: { flex: 1, height: 44, fontSize: 12, color: COLORS.text },
  weightUnit: { fontSize: 11, color: COLORS.secondaryText },
  availabilityRow: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availabilityTitle: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  activeControl: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  formError: { marginTop: 16, padding: 11, borderRadius: 10, backgroundColor: '#FFF1EB', fontSize: 11, lineHeight: 16, color: COLORS.danger },
  footer: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#F2F2F2', backgroundColor: '#fff' },
  saveButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: COLORS.primary },
  saveButtonDisabled: { backgroundColor: '#D6D6D6' },
  saveText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' },
  unitSheet: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#fff' },
  unitSheetTitle: { marginBottom: 8, fontSize: 15, fontWeight: '900', color: COLORS.text },
  unitOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F3F3' },
  unitOptionText: { fontSize: 12, color: COLORS.text },
  unitOptionTextActive: { fontWeight: '900', color: COLORS.primary },
});
