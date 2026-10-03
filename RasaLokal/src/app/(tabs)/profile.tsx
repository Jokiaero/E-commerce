import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import { EMPTY_ACCOUNT, loadAccountData, type AccountData } from '@/lib/accountStorage';
import { supabase } from '@/lib/supabase';

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

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadAccountData().then((data) => {
      if (active) setAccount(data);
    }).catch((error: unknown) => {
      if (active) Alert.alert('Akun tidak dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi Supabase.');
    });
    return () => { active = false; };
  }, []));

  const openSection = (section: string) => router.push({ pathname: '/account-details', params: { section } } as any);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      Alert.alert('Tidak dapat keluar', error.message);
      return;
    }
    setAccount(EMPTY_ACCOUNT);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Akun</Text>
        <Pressable style={styles.profileCard} onPress={() => openSection('login')} accessibilityRole="button">
          <View style={styles.avatar}><AppIcon name="person" size={34} color={COLORS.primary} /></View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{account.profile?.name ?? 'Masuk / Daftar'}</Text>
            <Text style={styles.phone}>{account.profile?.phone ?? 'Masuk untuk mengelola akunmu'}</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable>
        <Pressable style={styles.sellerMenu} onPress={() => router.push('/seller' as any)}>
          <View style={styles.sellerIcon}><AppIcon name="storefront" size={22} color="#fff" /></View>
          <View style={styles.sellerCopy}>
            <Text style={styles.sellerTitle}>Pusat Penjual</Text>
            <Text style={styles.sellerSubtitle}>Kelola UMKM dan pesananmu</Text>
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
        {account.profile && <Pressable style={styles.signOut} onPress={() => void signOut()}><Text style={styles.signOutText}>Keluar dari akun</Text></Pressable>}
      </ScrollView>
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
  sellerMenu: { marginTop: 14, borderRadius: 14, padding: 13, backgroundColor: COLORS.orange50, flexDirection: 'row', alignItems: 'center' },
  sellerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sellerCopy: { flex: 1, marginLeft: 11 },
  sellerTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  sellerSubtitle: { marginTop: 2, fontSize: 10, color: COLORS.secondaryText },
  menuList: { marginTop: 16 },
  menu: { minHeight: 64, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, paddingVertical: 8 },
  menuText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  menuSummary: { fontSize: 10, color: COLORS.secondaryText, marginTop: 3 },
  signOut: { minHeight: 46, marginTop: 18, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontSize: 12, color: COLORS.danger, fontWeight: '800' },
});
