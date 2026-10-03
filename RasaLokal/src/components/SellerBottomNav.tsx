import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';

type SellerTab = 'home' | 'products' | 'orders' | 'more';

const tabs: Array<{ key: SellerTab; label: string; icon: string; route: string }> = [
  { key: 'home', label: 'Beranda', icon: 'home', route: '/seller' },
  { key: 'products', label: 'Produk', icon: 'restaurant', route: '/seller/products' },
  { key: 'orders', label: 'Pesanan', icon: 'receipt', route: '/seller/orders' },
  { key: 'more', label: 'Lainnya', icon: 'person', route: '/seller/register' },
];

export function SellerBottomNav({ active }: { active: SellerTab }) {
  const router = useRouter();

  return (
    <View style={styles.nav}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: isActive }} onPress={() => router.replace(tab.route as any)} style={styles.item}>
            <AppIcon name={tab.icon} size={20} color={isActive ? COLORS.primary : COLORS.muted} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { height: 68, borderTopWidth: 1, borderTopColor: '#EEEEEE', backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 7 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  labelActive: { color: COLORS.primary },
});
