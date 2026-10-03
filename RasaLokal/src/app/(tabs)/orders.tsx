import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useRouter } from 'expo-router';
import { COLORS, SHADOW } from '@/constants/theme';

export default function OrdersScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Pesanan Saya</Text>
        <Pressable style={styles.card} onPress={() => router.push('/tracking')}>
          <View style={styles.icon}><AppIcon name="bag-check" size={24} color={COLORS.primary} /></View>
          <View style={styles.info}>
            <Text style={styles.orderNo}>Pesanan #RL-10241</Text>
            <Text style={styles.status}>Sedang diproses</Text>
            <Text style={styles.detail}>4 produk - Rp 82.000</Text>
          </View>
          <AppIcon name="chevron-forward" size={20} color={COLORS.muted} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text, marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 17, padding: 14, ...SHADOW },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12 },
  orderNo: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  status: { marginTop: 3, fontSize: 11, fontWeight: '800', color: COLORS.primary },
  detail: { marginTop: 5, fontSize: 10, color: COLORS.secondaryText },
});
