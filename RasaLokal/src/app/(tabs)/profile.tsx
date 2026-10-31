import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import { EMPTY_ACCOUNT, loadAccountData, type AccountData } from '@/lib/accountStorage';
import { supabase } from '@/lib/supabase';
import { loadDriverAccess } from '@/lib/driverAccount';
import type { DriverAccess } from '@/lib/driverRegistration';

const menuItems = [
  { title: 'Alamat Saya', icon: 'location-outline', section: 'address', summary: (account: AccountData) => account.address?.label ?? 'Tambah alamat pengiriman' },
  { title: 'Metode Pembayaran', icon: 'card-outline', section: 'payment', summary: (account: AccountData) => account.paymentMethod === 'bank' ? 'Transfer Bank' : account.paymentMethod === 'wallet' ? 'E-Wallet' : 'Bayar di Tempat' },
  { title: 'Favorit', icon: 'heart-outline', section: 'favorites', summary: (account: AccountData) => `${account.favorites.length} produk` },
  { title: 'Bantuan', icon: 'help-circle-outline', section: 'help', summary: () => 'FAQ dan panduan' },
  { title: 'Tentang RasaLokal', icon: 'information-circle-outline', section: 'about', summary: () => 'Kenali RasaLokal' },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountData>(EMPTY_ACCOUNT);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [driverAccess, setDriverAccess] = useState<DriverAccess | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setAccountLoaded(false);
    void loadAccountData().then((data) => {
      if (!active) return;
      setAccount(data);
      setAccountLoaded(true);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Akun tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    });
    void loadDriverAccess().then((access) => { if (active) setDriverAccess(access); })
      .catch(() => { if (active) setDriverAccess(null); });
    return () => { active = false; };
  }, []));

  const openSection = (section: string) => router.push({ pathname: '/account-details', params: { section } } as any);
  const openAuthentication = (authMode: 'signIn' | 'signUp') => router.push({ pathname: '/account-details', params: { section: 'login', authMode } });

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      Alert.alert('Tidak dapat keluar', error.message);
      return;
    }
    setAccount(EMPTY_ACCOUNT);
    setDriverAccess({ kind: 'guest' });
  };

  const openProfileDetails = () => router.push({ pathname: '/account-details', params: { section: account.profile ? 'security' : 'login' } } as any);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Akun</Text>
        <Pressable style={styles.profileCard} onPress={openProfileDetails} accessibilityRole="button" accessibilityLabel="Buka profil pengguna">
          {account.profile?.avatarUrl
            ? <Image source={{ uri: account.profile.avatarUrl }} style={styles.avatar} />
            : <View style={styles.avatar}><AppIcon name="person" size={30} color={COLORS.primary} /></View>}
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{account.profile?.name ?? 'Pengguna RasaLokal'}</Text>
            <Text style={styles.phone}>{account.profile?.phone ?? 'Ketuk untuk masuk atau mengelola akun'}</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={COLORS.primary} />
        </Pressable>

        {accountLoaded && !account.profile && (
          <View style={styles.accountWarning}>
            <View style={styles.warningHeading}>
              <AppIcon name="information-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.warningTitle} accessibilityRole="alert">Belum punya akun?</Text>
            </View>
            <Text style={styles.warningDescription}>Kamu belum masuk. Daftar atau masuk untuk menyimpan alamat, metode pembayaran, dan produk favorit.</Text>
            <View style={styles.warningActions}>
              <Pressable style={styles.registerButton} onPress={() => openAuthentication('signUp')} accessibilityRole="button">
                <Text style={styles.registerButtonText}>Daftar sekarang</Text>
              </Pressable>
              <Pressable style={styles.loginButton} onPress={() => openAuthentication('signIn')} accessibilityRole="button">
                <Text style={styles.loginButtonText}>Masuk</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable style={styles.sellerMenu} onPress={() => router.push('/seller' as any)}>
          <View style={styles.sellerIcon}><AppIcon name="storefront" size={22} color="#fff" /></View>
          <View style={styles.sellerCopy}>
            <Text style={styles.sellerTitle}>Pusat Penjual</Text>
            <Text style={styles.sellerSubtitle}>Kelola UMKM dan pesananmu</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={COLORS.primary} />
        </Pressable>

        <Pressable style={styles.sellerMenu} onPress={() => router.push(driverAccess?.kind === 'active' ? '/driver' : '/driver-register')} accessibilityRole="button" accessibilityLabel="Pusat Driver">
          <View style={styles.sellerIcon}><AppIcon name="bicycle" size={22} color="#fff" /></View>
          <View style={styles.sellerCopy}>
            <Text style={styles.sellerTitle}>Pusat Driver</Text>
            <Text style={styles.sellerSubtitle}>{driverAccess?.kind === 'active' ? 'Lihat tugas dan bagikan lokasi' : driverAccess?.kind === 'pending' ? 'Menunggu aktivasi admin' : 'Daftar dan kelola akun driver'}</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={COLORS.primary} />
        </Pressable>

        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <Pressable key={item.section} style={styles.menu} onPress={() => openSection(item.section)} accessibilityRole="button">
              <View style={styles.menuIcon}><AppIcon name={item.icon} size={20} color={COLORS.primary} /></View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuText}>{item.title}</Text>
                <Text style={styles.menuSummary}>{item.summary(account)}</Text>
              </View>
              <AppIcon name="chevron-forward" size={18} color={COLORS.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {account.profile && <View style={styles.footer}><Pressable style={styles.signOut} onPress={() => void signOut()}><Text style={styles.signOutText}>Keluar dari akun</Text><AppIcon name="arrow-forward" size={16} color={COLORS.secondaryText} /></Pressable></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  profileCard: { marginTop: 18, borderRadius: 16, backgroundColor: COLORS.orange50, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1 },
  name: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  phone: { fontSize: 11, color: COLORS.secondaryText, marginTop: 4 },
  accountWarning: { marginTop: 12, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: COLORS.orange100, backgroundColor: COLORS.orange50 },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.text },
  warningDescription: { marginTop: 8, fontSize: 12, lineHeight: 18, color: COLORS.secondaryText },
  warningActions: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  registerButton: { flexGrow: 1, flexBasis: 120, minHeight: 44, padding: 10, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  registerButtonText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  loginButton: { flexGrow: 1, flexBasis: 120, minHeight: 44, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  loginButtonText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  sellerMenu: { marginTop: 12, borderRadius: 13, padding: 12, backgroundColor: COLORS.orange50, flexDirection: 'row', alignItems: 'center' },
  sellerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sellerCopy: { flex: 1, marginLeft: 11 },
  sellerTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  sellerSubtitle: { marginTop: 2, fontSize: 10, color: COLORS.secondaryText },
  menuList: { marginTop: 16 },
  menu: { minHeight: 64, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, paddingVertical: 8 },
  menuText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  menuSummary: { fontSize: 10, color: COLORS.secondaryText, marginTop: 3 },
  footer: { paddingHorizontal: 18, paddingTop: 8, backgroundColor: '#fff' },
  signOut: { minHeight: 46, marginTop: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  signOutText: { fontSize: 12, color: COLORS.danger, fontWeight: '800' },
});
