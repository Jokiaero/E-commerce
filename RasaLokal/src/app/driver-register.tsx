import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TopHeader } from '@/components/TopHeader';
import { DriverAccountGate } from '@/components/DriverAccountGate';
import { COLORS } from '@/constants/theme';
import { registerDriverAccount } from '@/lib/driverAccount';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import type { DriverAccess } from '@/lib/driverRegistration';

export default function DriverRegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('Motor');
  const [plateNumber, setPlateNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const onLoaded = useCallback((next: DriverAccess) => {
    if (next.kind === 'unregistered') { setName(next.name); setPhone(next.phone); }
    if (next.kind === 'active') router.replace('/driver');
  }, [router]);
  const { access, setAccess, loading, error, setError, refresh } = useDriverAccess(onLoaded);

  const submit = async () => {
    if (submitting || access?.kind !== 'unregistered') return;
    setSubmitting(true);
    setError('');
    try {
      const next = await registerDriverAccount(access.userId, { name, phone, vehicleType, plateNumber });
      setAccess(next);
      if (next.kind === 'active') router.replace('/driver');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Pendaftaran belum dapat disimpan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <TopHeader title="Pendaftaran Driver" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {loading && <ActivityIndicator color={COLORS.primary} />}
      {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {!loading && access && access.kind !== 'unregistered' && <DriverAccountGate access={access} onRefresh={() => void refresh()} />}
      {!loading && access?.kind === 'unregistered' && <View style={styles.form}>
        <Text style={styles.heading}>Lengkapi data driver</Text>
        <Text style={styles.body}>Admin akan meninjau data ini sebelum akun driver diaktifkan.</Text>
        <Text style={styles.label}>Nama lengkap</Text>
        <TextInput style={styles.input} accessibilityLabel="Nama lengkap driver" value={name} onChangeText={setName} placeholder="Nama sesuai identitas" maxLength={80} autoComplete="name" editable={!submitting} />
        <Text style={styles.label}>Nomor telepon</Text>
        <TextInput style={styles.input} accessibilityLabel="Nomor telepon driver" value={phone} onChangeText={setPhone} placeholder="Contoh: 081234567890" keyboardType="phone-pad" maxLength={24} autoComplete="tel" editable={!submitting} />
        <Text style={styles.label}>Jenis kendaraan</Text>
        <View style={styles.vehicleOptions}>
          {['Motor', 'Mobil'].map((type) => <Pressable key={type} style={[styles.vehicleOption, vehicleType === type && styles.vehicleSelected]} onPress={() => setVehicleType(type)} disabled={submitting} accessibilityRole="radio" accessibilityState={{ checked: vehicleType === type }}><Text style={styles.vehicleText}>{type}</Text></Pressable>)}
        </View>
        <Text style={styles.label}>Nomor polisi</Text>
        <TextInput style={styles.input} accessibilityLabel="Nomor polisi kendaraan" value={plateNumber} onChangeText={setPlateNumber} placeholder="Contoh: BG 1234 AB" maxLength={20} autoCapitalize="characters" autoCorrect={false} editable={!submitting} />
        <Pressable style={[styles.button, submitting && styles.disabled]} onPress={() => void submit()} disabled={submitting} accessibilityRole="button" accessibilityState={{ busy: submitting, disabled: submitting }}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kirim pendaftaran driver</Text>}
        </Pressable>
      </View>}
      {!loading && !access && <Pressable style={styles.button} onPress={() => void refresh()} accessibilityRole="button"><Text style={styles.buttonText}>Coba lagi</Text></Pressable>}
      <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/profile')} disabled={submitting} accessibilityRole="button"><Text style={styles.backText}>Kembali ke Profil</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 18, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  form: { padding: 18, borderRadius: 16, backgroundColor: '#fff' },
  heading: { fontSize: 19, fontWeight: '900', color: COLORS.text },
  body: { marginTop: 8, fontSize: 12, lineHeight: 19, color: COLORS.secondaryText },
  label: { marginTop: 18, marginBottom: 8, fontSize: 12, fontWeight: '800', color: COLORS.text },
  input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#fff', fontSize: 14, color: COLORS.text },
  vehicleOptions: { flexDirection: 'row', gap: 10 },
  vehicleOption: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  vehicleSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.orange50 },
  vehicleText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  button: { marginTop: 22, minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  disabled: { opacity: 0.6 },
  error: { padding: 12, borderRadius: 10, backgroundColor: COLORS.orange50, fontSize: 12, lineHeight: 18, color: COLORS.danger },
  backButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
