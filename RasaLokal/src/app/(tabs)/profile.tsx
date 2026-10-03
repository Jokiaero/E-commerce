import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Akun</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><AppIcon name="person" size={34} color={COLORS.primary} /></View>
          <View><Text style={styles.name}>Pengguna RasaLokal</Text><Text style={styles.phone}>+62 812 3456 7890</Text></View>
        </View>
        <Pressable style={styles.sellerMenu} onPress={() => router.push('/seller' as any)}>
          <View style={styles.sellerIcon}><AppIcon name="storefront" size={22} color="#fff" /></View>
          <View style={styles.sellerCopy}>
            <Text style={styles.sellerTitle}>Pusat Penjual</Text>
            <Text style={styles.sellerSubtitle}>Kelola UMKM dan pesananmu</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={COLORS.primary} />
        </Pressable>
        {['Alamat Saya', 'Metode Pembayaran', 'Favorit', 'Bantuan', 'Tentang RasaLokal'].map((item, index) => (
          <View key={item} style={styles.menu}>
            <AppIcon name={['location-outline','card-outline','heart-outline','help-circle-outline','information-circle-outline'][index] as any} size={21} color={COLORS.primary} />
            <Text style={styles.menuText}>{item}</Text>
            <AppIcon name="chevron-forward" size={18} color={COLORS.muted} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  profileCard: { marginTop: 18, borderRadius: 18, backgroundColor: COLORS.orange50, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  phone: { fontSize: 11, color: COLORS.secondaryText, marginTop: 4 },
  sellerMenu: { marginTop: 16, borderRadius: 16, padding: 13, backgroundColor: COLORS.orange50, flexDirection: 'row', alignItems: 'center' },
  sellerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sellerCopy: { flex: 1, marginLeft: 11 },
  sellerTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  sellerSubtitle: { marginTop: 2, fontSize: 10, color: COLORS.secondaryText },
  menu: { height: 56, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },
});
