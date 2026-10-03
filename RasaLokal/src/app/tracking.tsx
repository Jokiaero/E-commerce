import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { COLORS, SHADOW } from '@/constants/theme';
import { cartItems, IMAGES, rupiah } from '@/constants/data';
import { TopHeader } from '@/components/TopHeader';

const steps = [
  { label: 'Dipesan', time: '12:30', active: true },
  { label: 'Diproses', time: '12:35', active: true },
  { label: 'Dikirim', time: '-', active: false },
  { label: 'Selesai', time: '-', active: false },
];

export default function TrackingScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopHeader title="Detail Pesanan" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}><AppIcon name="checkmark-circle-outline" size={28} color={COLORS.success} /></View>
          <View><Text style={styles.statusTitle}>Pesanan Diproses</Text><Text style={styles.statusText}>Penjual sedang menyiapkan pesanan Anda.</Text></View>
        </View>

        <View style={styles.stepsCard}>
          <View style={styles.stepsRow}>
            {steps.map((step, index) => (
              <View key={step.label} style={styles.stepWrap}>
                <Text style={[styles.stepLabel, step.active && styles.stepActiveText]}>{step.label}</Text>
                <Text style={[styles.stepTime, step.active && styles.stepTimeActive]}>{step.time}</Text>
                <View style={[styles.stepDot, step.active && styles.stepDotActive]} />
                {index < steps.length - 1 ? <View style={[styles.stepLine, steps[index + 1].active && styles.stepLineActive]} /> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.map}>
            <View style={[styles.road, styles.road1]} />
            <View style={[styles.road, styles.road2]} />
            <View style={styles.route} />
            <View style={styles.startPin}><View style={styles.pinCenter} /></View>
            <View style={styles.driverPin}><AppIcon name="bicycle" size={24} color={COLORS.primary} /></View>
            <View style={styles.endPin} />
          </View>
          <View style={styles.driverRow}>
            <Image source={{ uri: IMAGES.driver }} style={styles.driverImage} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>Rudi</Text>
              <Text style={styles.driverText}>Kurir sedang dalam perjalanan</Text>
              <Text style={styles.driverPhone}>+62 812 3456 7890</Text>
            </View>
            <Pressable style={styles.call}><AppIcon name="call" size={17} color="#fff" /></Pressable>
          </View>
        </View>

        <View style={styles.orderCard}>
          <Text style={styles.orderTitle}>Detail Pesanan</Text>
          {cartItems.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Image source={{ uri: item.image }} style={styles.orderImage} />
              <View style={styles.orderInfo}><Text style={styles.orderName}>{item.name}</Text><Text style={styles.orderQty}>x1</Text></View>
              <Text style={styles.orderPrice}>{rupiah(item.price)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total Pembayaran</Text><Text style={styles.total}>{rupiah(82000)}</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { paddingHorizontal: 16, paddingBottom: 26, gap: 12 },
  statusCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, ...SHADOW },
  statusIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EAF8EF', alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  statusText: { marginTop: 3, fontSize: 10, color: COLORS.secondaryText },
  stepsCard: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 16, ...SHADOW },
  stepsRow: { flexDirection: 'row' },
  stepWrap: { flex: 1, alignItems: 'center', position: 'relative' },
  stepLabel: { fontSize: 10, fontWeight: '700', color: COLORS.secondaryText },
  stepActiveText: { color: COLORS.primary },
  stepTime: { marginTop: 2, fontSize: 9, color: COLORS.muted },
  stepTimeActive: { color: COLORS.primary },
  stepDot: { marginTop: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: '#D5D5D5', zIndex: 2 },
  stepDotActive: { backgroundColor: COLORS.primary, borderWidth: 3, borderColor: COLORS.orange100, width: 14, height: 14, borderRadius: 7, marginTop: 5 },
  stepLine: { position: 'absolute', height: 2, backgroundColor: '#E5E5E5', left: '56%', right: '-44%', bottom: 5 },
  stepLineActive: { backgroundColor: COLORS.primary },
  mapCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...SHADOW },
  map: { height: 180, backgroundColor: '#EEF2F3', position: 'relative', overflow: 'hidden' },
  road: { position: 'absolute', backgroundColor: '#DCE3E6', borderRadius: 10 },
  road1: { width: '120%', height: 12, top: 52, left: -30, transform: [{ rotate: '8deg' }] },
  road2: { width: 12, height: '120%', left: 92, top: -20, transform: [{ rotate: '10deg' }] },
  route: { position: 'absolute', left: 63, top: 100, width: 220, height: 3, backgroundColor: COLORS.primary, borderRadius: 3, transform: [{ rotate: '-6deg' }] },
  startPin: { position: 'absolute', left: 52, top: 91, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.success, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pinCenter: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  driverPin: { position: 'absolute', left: '47%', top: 78, width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.orange100, alignItems: 'center', justifyContent: 'center' },
  endPin: { position: 'absolute', right: 53, top: 72, width: 17, height: 17, borderRadius: 9, backgroundColor: COLORS.primary, borderWidth: 3, borderColor: '#fff' },
  driverRow: { padding: 12, flexDirection: 'row', alignItems: 'center' },
  driverImage: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#eee' },
  driverInfo: { flex: 1, marginLeft: 10 },
  driverName: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  driverText: { marginTop: 2, fontSize: 9, color: COLORS.secondaryText },
  driverPhone: { marginTop: 2, fontSize: 9, fontWeight: '600', color: COLORS.muted },
  call: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, ...SHADOW },
  orderTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  orderItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  orderImage: { width: 38, height: 38, borderRadius: 9 },
  orderInfo: { flex: 1, marginLeft: 9 },
  orderName: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  orderQty: { marginTop: 2, fontSize: 9, color: COLORS.muted },
  orderPrice: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginVertical: 9 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  total: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
});
