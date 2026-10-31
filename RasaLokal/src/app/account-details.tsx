import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '@/components/AppIcon';
import { useSafeBack } from '@/hooks/useSafeBack';
import { COLORS } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { EMPTY_ACCOUNT, loadAccountData, loadAccountDeletionStatus, PAYMENT_OPTIONS, saveAccountAddress, saveAccountProfile, savePaymentMethod, submitAccountDeletionRequest, toggleFavorite as toggleFavoriteInDatabase, uploadAccountPhoto, type AccountData, type PaymentMethod } from '@/lib/accountStorage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { loadPublicProducts } from '@/lib/catalogStorage';

const TITLES: Record<string, string> = {
  login: 'Masuk / Daftar',
  security: 'Akun & Keamanan',
  address: 'Alamat Saya',
  payment: 'Metode Pembayaran',
  favorites: 'Favorit',
  help: 'Pusat Bantuan',
  about: 'Tentang RasaLokal',
};

export default function AccountDetailsScreen() {
  const router = useRouter();
  const safeBack = useSafeBack('/(tabs)/profile');
  const params = useLocalSearchParams<{ section?: string | string[]; authMode?: string | string[]; returnTo?: string | string[] }>();
  const rawSection = Array.isArray(params.section) ? params.section[0] : params.section;
  const requestedAuthMode = Array.isArray(params.authMode) ? params.authMode[0] : params.authMode;
  const requestedReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const driverAuthentication = requestedReturnTo === '/driver-register';
  const section = rawSection && TITLES[rawSection] ? rawSection : 'login';
  const [account, setAccount] = useState<AccountData>(EMPTY_ACCOUNT);
  const [catalogProducts, setCatalogProducts] = useState<Awaited<ReturnType<typeof loadPublicProducts>>>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('Rumah');
  const [recipient, setRecipient] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>(requestedAuthMode === 'signUp' ? 'signUp' : 'signIn');
  const [authMessage, setAuthMessage] = useState('');
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [securityField, setSecurityField] = useState<'username' | 'phone' | null>(null);
  const [securityValue, setSecurityValue] = useState('');
  const [savingSecurityField, setSavingSecurityField] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [deletionStatus, setDeletionStatus] = useState<'pending' | 'processing' | null>(null);
  const [submittingDeletion, setSubmittingDeletion] = useState(false);
  const needsLogin = ['security', 'address', 'payment', 'favorites'].includes(section) && !account.profile;

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadingAccount(true);
    void Promise.all([loadAccountData(), loadPublicProducts()]).then(([data, loadedProducts]) => {
      if (!active) return;
      setAccount(data);
      setCatalogProducts(loadedProducts);
      setName(data.profile?.name ?? '');
      setPhone(data.profile?.phone ?? '');
      setLabel(data.address?.label ?? 'Rumah');
      setRecipient(data.address?.recipient ?? '');
      setAddressPhone(data.address?.phone ?? data.profile?.phone ?? '');
      setAddressDetails(data.address?.details ?? '');
      setPaymentMethod(data.paymentMethod);
      if (section === 'security' && data.profile) {
        void loadAccountDeletionStatus().then((status) => {
          if (active) setDeletionStatus(status);
        }).catch((error: unknown) => {
          if (active) Alert.alert('Status permintaan tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
        });
      } else {
        setDeletionStatus(null);
      }
    }).catch((error: unknown) => {
      if (active) Alert.alert('Data akun tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    }).finally(() => {
      if (active) setLoadingAccount(false);
    });
    return () => { active = false; };
  }, [section]));

  const showError = (title: string, error: unknown) => {
    Alert.alert(title, error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.');
  };

  const handleAuthentication = async () => {
    if (submitting) return;
    setAuthMessage('');
    if (!isSupabaseConfigured) {
      setAuthMessage('Layanan akun belum tersedia. Coba lagi nanti.');
      Alert.alert('Supabase belum terhubung', 'Tutup Expo, buka terminal di folder RasaLokal, lalu jalankan npx expo start -c.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setAuthMessage('Isi email dan kata sandi.');
      Alert.alert('Data belum lengkap', 'Isi email dan kata sandi.');
      return;
    }
    if (authMode === 'signUp' && (!name.trim() || phone.replace(/\D/g, '').length < 8)) {
      setAuthMessage('Isi nama dan nomor telepon yang valid.');
      Alert.alert('Data belum lengkap', 'Isi nama dan nomor telepon yang valid.');
      return;
    }

    setSubmitting(true);
    setAuthMessage('');
    try {
      if (authMode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { full_name: name.trim(), phone: phone.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMode('signIn');
          setPassword('');
          setAuthMessage('Akun berhasil dibuat. Periksa email untuk konfirmasi, lalu masuk kembali.');
          return;
        }
        await saveAccountProfile({ name: name.trim(), phone: phone.trim() });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        const currentAccount = await loadAccountData();
        if (!currentAccount.profile) {
          const metadata = data.user.user_metadata;
          await saveAccountProfile({
            name: typeof metadata.full_name === 'string' ? metadata.full_name : cleanEmail.split('@')[0],
            phone: typeof metadata.phone === 'string' ? metadata.phone : '',
          });
        }
      }
      Alert.alert('Berhasil', authMode === 'signUp' ? 'Akun berhasil dibuat.' : 'Anda berhasil masuk.');
      if (driverAuthentication) router.replace('/driver-register');
      else safeBack();
    } catch (error) {
      setAuthMessage(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Tidak dapat masuk atau membuat akun. Coba lagi.');
      showError(authMode === 'signUp' ? 'Pendaftaran gagal' : 'Login gagal', error);
    } finally {
      setSubmitting(false);
    }
  };

  const saveProfile = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || cleanPhone.replace(/\D/g, '').length < 8) {
      Alert.alert('Periksa data', 'Isi nama dan nomor telepon yang valid.');
      return;
    }
    try {
      await saveAccountProfile({ name: cleanName, phone: cleanPhone });
      Alert.alert('Tersimpan', 'Profil berhasil diperbarui.');
      safeBack();
    } catch (error) {
      showError('Profil tidak dapat disimpan', error);
    }
  };

  const saveAddress = async () => {
    if (!label.trim() || !recipient.trim() || addressPhone.replace(/\D/g, '').length < 8 || !addressDetails.trim()) {
      Alert.alert('Periksa alamat', 'Lengkapi label, penerima, nomor telepon, dan alamat.');
      return;
    }
    try {
      await saveAccountAddress({
        label: label.trim(),
        recipient: recipient.trim(),
        phone: addressPhone.trim(),
        details: addressDetails.trim(),
        latitude: addressDetails.trim() === account.address?.details ? account.address.latitude : null,
        longitude: addressDetails.trim() === account.address?.details ? account.address.longitude : null,
      });
      Alert.alert('Tersimpan', 'Alamat pengiriman berhasil disimpan.');
      safeBack();
    } catch (error) {
      showError('Alamat tidak dapat disimpan', error);
    }
  };

  const savePayment = async () => {
    try {
      await savePaymentMethod(paymentMethod);
      Alert.alert('Tersimpan', 'Metode pembayaran utama berhasil disimpan.');
      safeBack();
    } catch (error) {
      showError('Metode pembayaran tidak dapat disimpan', error);
    }
  };

  const toggleFavorite = async (productId: string) => {
    try {
      await toggleFavoriteInDatabase(productId);
      setAccount((current) => ({
        ...current,
        favorites: current.favorites.includes(productId)
          ? current.favorites.filter((id) => id !== productId)
          : [...current.favorites, productId],
      }));
    } catch (error) {
      showError('Favorit tidak dapat diperbarui', error);
    }
  };

  const openSecurityEditor = (field: 'username' | 'phone') => {
    if (!account.profile) return;
    setSecurityValue(field === 'username' ? account.profile.name : account.profile.phone);
    setSecurityField(field);
  };

  const saveSecurityField = async () => {
    if (!account.profile || !securityField) return;
    const value = securityValue.trim();
    const nextName = securityField === 'username' ? value : account.profile.name;
    const nextPhone = securityField === 'phone' ? value : account.profile.phone;
    if (!nextName || nextPhone.replace(/\D/g, '').length < 8) {
      Alert.alert('Periksa data', securityField === 'username' ? 'Username wajib diisi.' : 'Masukkan nomor handphone yang valid.');
      return;
    }
    setSavingSecurityField(true);
    try {
      await saveAccountProfile({ name: nextName, phone: nextPhone });
      setAccount((current) => current.profile
        ? { ...current, profile: { ...current.profile, name: nextName, phone: nextPhone } }
        : current);
      setSecurityField(null);
      Alert.alert('Tersimpan', 'Profil berhasil diperbarui.');
    } catch (error) {
      showError('Perubahan tidak dapat disimpan', error);
    } finally {
      setSavingSecurityField(false);
    }
  };

  const chooseAvatar = async () => {
    setAvatarError('');
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
        setAvatarError('Ukuran foto maksimal 5 MB. Pilih foto lain.');
        return;
      }
      setUploadingAvatar(true);
      const avatarUrl = await uploadAccountPhoto(asset);
      setAccount((current) => current.profile
        ? { ...current, profile: { ...current.profile, avatarUrl } }
        : current);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Foto profil tidak dapat disimpan. Coba lagi.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submitDeletion = async () => {
    setSubmittingDeletion(true);
    try {
      const created = await submitAccountDeletionRequest();
      setDeletionStatus('pending');
      Alert.alert(created ? 'Permintaan terkirim' : 'Permintaan sudah tercatat', 'Akun tetap aktif sampai permintaan penghapusan ditinjau dan diproses.');
    } catch (error) {
      showError('Permintaan tidak dapat dikirim', error);
    } finally {
      setSubmittingDeletion(false);
    }
  };

  const requestDeletion = () => {
    if (deletionStatus) {
      Alert.alert('Permintaan sedang diproses', 'Kami akan meninjau permintaan penghapusan akunmu.');
      return;
    }
    Alert.alert('Ajukan penghapusan akun?', 'Permintaan akan ditinjau. Akunmu tidak langsung dihapus.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ajukan', style: 'destructive', onPress: () => void submitDeletion() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={safeBack} accessibilityRole="button" accessibilityLabel="Kembali">
          <AppIcon name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{section === 'login' && driverAuthentication ? 'Akun Driver' : TITLES[section]}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loadingAccount && <ActivityIndicator style={styles.loader} size="large" color={COLORS.primary} />}

        {!loadingAccount && !needsLogin && section === 'security' && (
          <>
            <View style={styles.securityRows}>
              <Pressable style={styles.securityPhotoRow} onPress={() => void chooseAvatar()} disabled={uploadingAvatar} accessibilityRole="button" accessibilityLabel="Ubah foto profil">
                <Text style={styles.securityLabel}>Foto</Text>
                <View style={styles.securityPhotoRight}>
                  {uploadingAvatar ? <ActivityIndicator size="small" color={COLORS.primary} /> : account.profile?.avatarUrl
                    ? <Image source={{ uri: account.profile.avatarUrl }} style={styles.securityAvatar} />
                    : <View style={styles.securityAvatarPlaceholder}><AppIcon name="person" size={20} color={COLORS.muted} /></View>}
                  <AppIcon name="chevron-forward" size={16} color={COLORS.muted} />
                </View>
              </Pressable>
              {avatarError !== '' && <Text style={styles.securityError}>{avatarError}</Text>}
              <Pressable style={styles.securityInfoRow} onPress={() => openSecurityEditor('username')} accessibilityRole="button" accessibilityState={{ expanded: securityField === 'username' }}>
                <Text style={styles.securityLabel}>Username</Text>
                <Text style={styles.securityValue} numberOfLines={1}>{account.profile?.name}</Text>
                <AppIcon name={securityField === 'username' ? 'chevron-down' : 'chevron-forward'} size={16} color={COLORS.muted} />
              </Pressable>
              {securityField === 'username' && <SecurityFieldEditor label="Username" value={securityValue} onChangeText={setSecurityValue} onCancel={() => setSecurityField(null)} onSave={() => void saveSecurityField()} saving={savingSecurityField} />}
              <Pressable style={styles.securityInfoRow} onPress={() => openSecurityEditor('phone')} accessibilityRole="button" accessibilityState={{ expanded: securityField === 'phone' }}>
                <Text style={styles.securityLabel}>No. Handphone</Text>
                <Text style={styles.securityValue} numberOfLines={1}>{account.profile?.phone || 'Belum ditambahkan'}</Text>
                <AppIcon name={securityField === 'phone' ? 'chevron-down' : 'chevron-forward'} size={16} color={COLORS.muted} />
              </Pressable>
              {securityField === 'phone' && <SecurityFieldEditor label="No. Handphone" value={securityValue} onChangeText={setSecurityValue} onCancel={() => setSecurityField(null)} onSave={() => void saveSecurityField()} saving={savingSecurityField} phone />}
            </View>
            <View style={styles.securityDeletionCard}>
              <Pressable style={styles.securityDeletionRow} onPress={requestDeletion} disabled={submittingDeletion} accessibilityRole="button">
                <Text style={styles.securityDeletionTitle}>Ajukan Penghapusan Akun</Text>
                <Text style={styles.securityDeletionSubtitle}>{submittingDeletion ? 'Mengirim permintaan...' : deletionStatus ? 'Permintaan sedang diproses' : 'Akun tetap aktif sampai permintaan ditinjau'}</Text>
                {submittingDeletion ? <ActivityIndicator size="small" color={COLORS.primary} /> : <AppIcon name="chevron-forward" size={16} color={COLORS.muted} />}
              </Pressable>
            </View>
          </>
        )}

        {!loadingAccount && section === 'login' && (
          <>
            <View style={styles.intro}>
              <View style={styles.introIcon}><AppIcon name="person" size={25} color={COLORS.primary} /></View>
              <Text style={styles.heading}>{account.profile ? 'Profil saya' : authMode === 'signIn' ? driverAuthentication ? 'Masuk akun driver' : 'Masuk ke RasaLokal' : driverAuthentication ? 'Buat akun driver' : 'Buat akun RasaLokal'}</Text>
              <Text style={styles.body}>{account.profile ? 'Perbarui informasi profil yang tersimpan di akunmu.' : driverAuthentication ? authMode === 'signUp' ? 'Buat akun, lalu lengkapi data kendaraan untuk ditinjau admin.' : 'Masuk untuk melanjutkan ke Pusat Driver.' : authMode === 'signUp' ? 'Lengkapi data berikut untuk membuat akun baru.' : 'Gunakan email dan kata sandi untuk masuk ke akun.'}</Text>
            </View>
            {account.profile ? (
              <>
                <Field label="Nama lengkap" value={name} onChangeText={setName} placeholder="Nama kamu" />
                <Field label="Nomor telepon" value={phone} onChangeText={setPhone} placeholder="Contoh: 081234567890" keyboardType="phone-pad" />
                <SaveButton title="Simpan perubahan" onPress={() => void saveProfile()} />
              </>
            ) : (
              <>
                {authMode === 'signUp' && (
                  <>
                    <Field label="Nama lengkap" value={name} onChangeText={setName} placeholder="Nama kamu" />
                    <Field label="Nomor telepon" value={phone} onChangeText={setPhone} placeholder="Contoh: 081234567890" keyboardType="phone-pad" />
                  </>
                )}
                <Field label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" autoCapitalize="none" />
                <Field label="Kata sandi" value={password} onChangeText={setPassword} placeholder="Kata sandi akun" secureTextEntry autoCapitalize="none" />
                {authMode === 'signIn' && <Pressable style={styles.authSwitch} onPress={() => router.push({ pathname: '/reset-password', params: { email: email.trim() } })} disabled={submitting} accessibilityRole="button">
                  <Text style={styles.authSwitchText}>Lupa kata sandi?</Text>
                </Pressable>}
                {!!authMessage && <Text style={styles.authMessage}>{authMessage}</Text>}
                <SaveButton
                  title={submitting ? 'Memproses...' : authMode === 'signIn' ? 'Masuk' : 'Buat akun'}
                  onPress={() => void handleAuthentication()}
                  disabled={submitting}
                />
                <Pressable style={styles.authSwitch} onPress={() => {
                  setAuthMode((current) => current === 'signIn' ? 'signUp' : 'signIn');
                  setAuthMessage('');
                }}>
                  <Text style={styles.authSwitchText}>{authMode === 'signIn' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {!loadingAccount && needsLogin && (
          <View style={styles.loginGate}>
            <View style={styles.introIcon}><AppIcon name="person" size={25} color={COLORS.primary} /></View>
            <Text style={styles.heading}>Masuk untuk melanjutkan</Text>
            <Text style={styles.body}>{section === 'security' ? 'Masuk untuk mengelola profil dan keamanan akunmu.' : 'Alamat, pembayaran, dan favorit disimpan untuk akunmu.'}</Text>
            <SaveButton title="Masuk / Daftar" onPress={() => router.replace({ pathname: '/account-details', params: { section: 'login' } } as any)} />
          </View>
        )}

        {!loadingAccount && !needsLogin && section === 'address' && (
          <>
            <Text style={styles.body}>Alamat ini akan digunakan sebagai tujuan pengiriman di checkout.</Text>
            <Field label="Label alamat" value={label} onChangeText={setLabel} placeholder="Rumah, Kantor" />
            <Field label="Nama penerima" value={recipient} onChangeText={setRecipient} placeholder="Nama penerima" />
            <Field label="Nomor telepon" value={addressPhone} onChangeText={setAddressPhone} placeholder="Nomor yang bisa dihubungi" keyboardType="phone-pad" />
            <Field label="Alamat lengkap" value={addressDetails} onChangeText={setAddressDetails} placeholder="Jalan, nomor rumah, kelurahan, kecamatan, kota" multiline />
            <SaveButton title="Simpan alamat" onPress={() => void saveAddress()} />
          </>
        )}

        {!loadingAccount && !needsLogin && section === 'payment' && (
          <>
            <Text style={styles.body}>Pilih metode pembayaran default. Transfer bank dan e-wallet hanya simulasi untuk tugas kampus, bukan transaksi sungguhan. Bayar di tempat dibayarkan langsung ke driver saat pesanan diterima.</Text>
            <View style={styles.options}>
              {PAYMENT_OPTIONS.map((option) => {
                const active = paymentMethod === option.id;
                return (
                  <Pressable key={option.id} style={[styles.paymentOption, active && styles.paymentOptionActive]} onPress={() => setPaymentMethod(option.id)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
                    <View style={styles.paymentIcon}><AppIcon name={option.icon} size={20} color={COLORS.primary} /></View>
                    <View style={styles.paymentCopy}>
                      <Text style={styles.optionTitle}>{option.name}</Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </View>
                    <AppIcon name={active ? 'radio-button-on' : 'radio-button-off'} size={21} color={active ? COLORS.primary : COLORS.muted} />
                  </Pressable>
                );
              })}
            </View>
            <SaveButton title="Simpan metode" onPress={() => void savePayment()} />
          </>
        )}

        {!loadingAccount && !needsLogin && section === 'favorites' && (
          <>
            <Text style={styles.body}>Pilih ikon hati untuk menyimpan atau menghapus produk favorit.</Text>
            {catalogProducts.map((product) => {
              const active = account.favorites.includes(product.id);
              return (
                <View key={product.id} style={styles.productRow}>
                  {product.image ? <Image source={{ uri: product.image }} style={styles.productImage} /> : <View style={[styles.productImage, { backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' }]}><AppIcon name="restaurant" size={22} color={COLORS.muted} /></View>}
                  <View style={styles.productCopy}>
                    <Text style={styles.optionTitle}>{product.name}</Text>
                    <Text style={styles.optionDescription}>{product.storeName}</Text>
                    <Text style={styles.productPrice}>{rupiah(product.price)}</Text>
                  </View>
                  <Pressable style={styles.heartButton} onPress={() => void toggleFavorite(product.id)} accessibilityRole="button" accessibilityLabel={active ? `Hapus ${product.name} dari favorit` : `Simpan ${product.name} ke favorit`}>
                    <AppIcon name={active ? 'heart' : 'heart-outline'} size={21} color={active ? COLORS.primary : COLORS.muted} />
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {section === 'help' && <HelpContent openFaq={openFaq} setOpenFaq={setOpenFaq} />}

        {section === 'about' && (
          <View style={styles.aboutBlock}>
            <View style={styles.aboutMark}><AppIcon name="storefront" size={34} color={COLORS.primary} /></View>
            <Text style={styles.heading}>RasaLokal</Text>
            <Text style={styles.body}>RasaLokal menghubungkan pecinta kuliner dengan produk dan UMKM lokal, dimulai dari cita rasa Palembang.</Text>
            <View style={styles.aboutInfo}><Text style={styles.aboutLabel}>Versi aplikasi</Text><Text style={styles.aboutValue}>1.0.0</Text></View>
            <View style={styles.aboutInfo}><Text style={styles.aboutLabel}>Fokus</Text><Text style={styles.aboutValue}>Kuliner lokal dan UMKM</Text></View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, secureTextEntry, autoCapitalize }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function SaveButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[styles.saveButton, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled} accessibilityRole="button"><Text style={styles.saveButtonText}>{title}</Text></Pressable>;
}

function SecurityFieldEditor({ label, value, onChangeText, onCancel, onSave, saving, phone }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  phone?: boolean;
}) {
  return (
    <View style={styles.securityEditor}>
      <Field label={label} value={value} onChangeText={onChangeText} placeholder={phone ? 'Contoh: 081234567890' : 'Nama pengguna'} keyboardType={phone ? 'phone-pad' : 'default'} />
      <View style={styles.securityEditActions}>
        <Pressable style={styles.securityCancelButton} onPress={onCancel} disabled={saving}>
          <Text style={styles.securityCancelText}>Batal</Text>
        </Pressable>
        <Pressable style={[styles.securitySaveButton, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Simpan</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function HelpContent({ openFaq, setOpenFaq }: { openFaq: number | null; setOpenFaq: (index: number | null) => void }) {
  const faqs = [
    { question: 'Bagaimana cara memilih metode pembayaran?', answer: 'Buka Akun > Metode Pembayaran, pilih opsi, lalu simpan. Pilihan akan tampil di checkout.' },
    { question: 'Bagaimana cara mengubah alamat pengiriman?', answer: 'Buka Akun > Alamat Saya. Lengkapi atau perbarui alamat, lalu simpan sebelum checkout.' },
    { question: 'Bagaimana cara menyimpan produk favorit?', answer: 'Buka Akun > Favorit dan tekan ikon hati pada produk yang ingin disimpan.' },
    { question: 'Apakah pembayaran sudah diproses di aplikasi?', answer: 'Belum. Metode pembayaran saat ini hanya simulasi dan belum terhubung ke penyedia pembayaran.' },
  ];

  return (
    <>
      <Text style={styles.heading}>Pertanyaan umum</Text>
      <Text style={[styles.body, styles.helpIntro]}>Pilih pertanyaan untuk melihat jawabannya.</Text>
      {faqs.map((faq, index) => {
        const expanded = openFaq === index;
        return (
          <Pressable key={faq.question} style={styles.faq} onPress={() => setOpenFaq(expanded ? null : index)} accessibilityRole="button" accessibilityState={{ expanded }}>
            <View style={styles.faqQuestionRow}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <AppIcon name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={COLORS.muted} />
            </View>
            {expanded && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.text },
  headerSpacer: { width: 24 },
  content: { padding: 18, paddingBottom: 36 },
  loader: { marginTop: 48 },
  securityRows: { paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#fff' },
  securityPhotoRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1EFEF' },
  securityPhotoRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  securityAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F2F2F2' },
  securityAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  securityInfoRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#F1EFEF' },
  securityLabel: { flex: 1, fontSize: 11, color: COLORS.text },
  securityValue: { maxWidth: '48%', fontSize: 11, color: COLORS.secondaryText },
  securityError: { paddingVertical: 8, fontSize: 10, lineHeight: 15, color: COLORS.danger },
  securityEditor: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1EFEF' },
  securityEditActions: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  securityCancelButton: { minHeight: 38, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  securityCancelText: { fontSize: 11, fontWeight: '700', color: COLORS.secondaryText },
  securitySaveButton: { minWidth: 88, minHeight: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  securityDeletionCard: { marginTop: 11, paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#fff' },
  securityDeletionRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 9 },
  securityDeletionTitle: { flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.text },
  securityDeletionSubtitle: { maxWidth: '40%', fontSize: 9, textAlign: 'right', color: COLORS.secondaryText },
  intro: { alignItems: 'center', paddingVertical: 16, marginBottom: 8 },
  introIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '900', color: COLORS.text },
  body: { fontSize: 12, lineHeight: 19, color: COLORS.secondaryText },
  field: { marginTop: 15 },
  fieldLabel: { marginBottom: 7, fontSize: 12, fontWeight: '800', color: COLORS.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 13, color: COLORS.text, fontSize: 13, backgroundColor: '#fff' },
  multilineInput: { minHeight: 112, paddingTop: 12 },
  saveButton: { minHeight: 50, marginTop: 22, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  authMessage: { marginTop: 13, padding: 12, borderRadius: 10, backgroundColor: COLORS.orange50, fontSize: 12, lineHeight: 18, color: COLORS.text },
  authSwitch: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  authSwitchText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  loginGate: { alignItems: 'center', paddingTop: 36 },
  options: { marginTop: 14 },
  paymentOption: { minHeight: 78, marginBottom: 9, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  paymentOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.orange50 },
  paymentIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  paymentCopy: { flex: 1 },
  optionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  optionDescription: { marginTop: 4, fontSize: 10, lineHeight: 15, color: COLORS.secondaryText },
  productRow: { minHeight: 86, marginTop: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 10 },
  productImage: { width: 64, height: 64, borderRadius: 10, backgroundColor: COLORS.orange50 },
  productCopy: { flex: 1 },
  productPrice: { marginTop: 5, fontSize: 12, fontWeight: '900', color: COLORS.primary },
  heartButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  aboutBlock: { alignItems: 'center', paddingTop: 30 },
  aboutMark: { width: 72, height: 72, borderRadius: 22, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  aboutBlockBody: { textAlign: 'center' },
  aboutInfo: { width: '100%', minHeight: 54, marginTop: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  aboutLabel: { fontSize: 12, color: COLORS.secondaryText },
  aboutValue: { fontSize: 12, fontWeight: '800', color: COLORS.text, textAlign: 'right' },
  helpIntro: { marginTop: 6, marginBottom: 10 },
  faq: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQuestion: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '800', color: COLORS.text },
  faqAnswer: { marginTop: 10, paddingRight: 20, fontSize: 12, lineHeight: 19, color: COLORS.secondaryText },
});
