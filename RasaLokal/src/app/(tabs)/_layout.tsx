import { Tabs } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarStyle: { height: 82, paddingTop: 8, paddingBottom: 20, borderTopColor: '#EEEEEE', backgroundColor: '#FFFFFF' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: ({ color, size }) => <AppIcon name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="umkm" options={{ title: 'UMKM', tabBarIcon: ({ color, size }) => <AppIcon name="storefront" size={size} color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: 'Keranjang', tabBarIcon: ({ color, size }) => <AppIcon name="cart" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Pesanan', tabBarIcon: ({ color, size }) => <AppIcon name="receipt" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Akun', tabBarIcon: ({ color, size }) => <AppIcon name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
