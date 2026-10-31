import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import type { DriverAccess } from '@/lib/driverRegistration';

export function DriverAccountGate({ access, onRefresh }: { access: DriverAccess; onRefresh?: () => void }) {
  const router = useRouter();
  if (access.kind === 'active') return null;
  const openAuthentication = (authMode: 'signIn' | 'signUp') => router.push({ pathname: '/account-details', params: { section: 'login', authMode, returnTo: '/driver-register' } });
  return <View style={styles.card}>
    <Text style={styles.title}>{access.kind === 'guest' ? 'Belum punya akun driver?' : access.kind === 'pending' ? 'Menunggu aktivasi admin' : 'Daftar sebagai driver'}</Text>
    <Text style={styles.body}>{access.kind === 'guest'
      ? 'Buat akun, lalu lengkapi data driver dan kendaraan untuk ditinjau admin.'
      : access.kind === 'pending' ? 'Data pendaftaranmu sudah tersimpan. Akun dapat menerima tugas setelah diaktifkan admin.'
        : 'Lengkapi nama, nomor telepon, dan kendaraanmu untuk mendaftar sebagai driver RasaLokal.'}</Text>
    {access.kind === 'pending' && <View style={styles.details}>
      <Text style={styles.title}>{access.driver.name}</Text>
      <Text style={styles.body}>{access.driver.phone}</Text>
      <Text style={styles.body}>{access.driver.vehicle}</Text>
    </View>}
    {access.kind === 'guest' ? <>
      <Pressable style={styles.button} onPress={() => openAuthentication('signUp')} accessibilityRole="button"><Text style={styles.buttonText}>Daftar akun driver</Text></Pressable>
      <Pressable style={styles.secondary} onPress={() => openAuthentication('signIn')} accessibilityRole="button"><Text style={styles.secondaryText}>Masuk akun driver</Text></Pressable>
    </> : access.kind === 'unregistered'
      ? <Pressable style={styles.button} onPress={() => router.push('/driver-register')} accessibilityRole="button"><Text style={styles.buttonText}>Lengkapi pendaftaran driver</Text></Pressable>
      : onRefresh && <Pressable style={styles.button} onPress={onRefresh} accessibilityRole="button"><Text style={styles.buttonText}>Periksa status aktivasi</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 16, gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  body: { fontSize: 12, lineHeight: 19, color: COLORS.secondaryText },
  details: { padding: 12, gap: 6, borderRadius: 10, backgroundColor: COLORS.orange50 },
  button: { minHeight: 46, padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  buttonText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
});
