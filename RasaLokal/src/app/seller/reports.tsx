import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { SellerBottomNav } from '@/components/SellerBottomNav';
import { COLORS } from '@/constants/theme';
import { rupiah } from '@/constants/data';

const periods = ['Hari ini', '7 hari', '30 hari'];
const salesByPeriod: Record<string, number> = { 'Hari ini': 425000, '7 hari': 2745000, '30 hari': 11250000 };

export default function SellerReportsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('Hari ini');
  const sales = salesByPeriod[period];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><AppIcon name="chevron-back" size={22} color={COLORS.text} /></Pressable><Text style={styles.title}>Laporan UMKM</Text><View style={styles.backButton} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.periodRow}>{periods.map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={[styles.period, period === item && styles.periodActive]}><Text style={[styles.periodText, period === item && styles.periodTextActive]}>{item}</Text></Pressable>)}</View>
        <View style={styles.salesCard}><Text style={styles.salesLabel}>Total penjualan</Text><Text style={styles.salesValue}>{rupiah(sales)}</Text><Text style={styles.salesNote}>Periode {period.toLowerCase()}</Text></View>
        <View style={styles.summaryRow}><View style={styles.summaryCard}><Text style={styles.summaryLabel}>Pesanan selesai</Text><Text style={styles.summaryValue}>{period === 'Hari ini' ? '12' : period === '7 hari' ? '81' : '326'}</Text></View><View style={styles.summaryCard}><Text style={styles.summaryLabel}>Rata-rata transaksi</Text><Text style={styles.summaryValue}>{rupiah(period === 'Hari ini' ? 35417 : period === '7 hari' ? 33889 : 34509)}</Text></View></View>
        <Text style={styles.sectionTitle}>Penjualan per hari</Text>
        <View style={styles.chartCard}>
          <View style={styles.bars}>{[42, 68, 51, 82, 60, 74, 94].map((height, index) => <View key={index} style={styles.barWrap}><View style={[styles.bar, { height: `${height}%` }]} /><Text style={styles.day}>{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][index]}</Text></View>)}</View>
        </View>
        <Text style={styles.sectionTitle}>Produk terlaris</Text>
        {['Kapal Selam', 'Tekwan Kuah', 'Pempek Kulit'].map((name, index) => <View key={name} style={styles.rankRow}><Text style={styles.rank}>{index + 1}</Text><Text style={styles.productName}>{name}</Text><Text style={styles.sold}>{[36, 24, 19][index]} terjual</Text></View>)}
      </ScrollView>
      <SellerBottomNav active="more" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 17, fontWeight: '900', color: COLORS.text }, backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center' }, content: { padding: 18, paddingTop: 0, paddingBottom: 30 }, periodRow: { flexDirection: 'row', gap: 8 }, period: { flex: 1, height: 36, borderRadius: 11, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' }, periodActive: { backgroundColor: COLORS.primary }, periodText: { fontSize: 11, fontWeight: '800', color: COLORS.secondaryText }, periodTextActive: { color: '#fff' }, salesCard: { marginTop: 16, borderRadius: 18, backgroundColor: COLORS.orange50, padding: 18 }, salesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.secondaryText }, salesValue: { marginTop: 7, fontSize: 26, fontWeight: '900', color: COLORS.text }, salesNote: { marginTop: 4, fontSize: 10, color: COLORS.secondaryText }, summaryRow: { marginTop: 11, flexDirection: 'row', gap: 11 }, summaryCard: { flex: 1, minHeight: 82, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border }, summaryLabel: { fontSize: 10, lineHeight: 14, color: COLORS.secondaryText }, summaryValue: { marginTop: 7, fontSize: 15, fontWeight: '900', color: COLORS.text }, sectionTitle: { marginTop: 24, fontSize: 15, fontWeight: '900', color: COLORS.text }, chartCard: { marginTop: 10, height: 190, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border }, bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, barWrap: { width: 28, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }, bar: { width: 18, minHeight: 12, borderRadius: 8, backgroundColor: COLORS.primary }, day: { marginTop: 8, fontSize: 9, color: COLORS.secondaryText }, rankRow: { marginTop: 10, height: 56, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center' }, rank: { width: 27, fontSize: 13, fontWeight: '900', color: COLORS.primary }, productName: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.text }, sold: { fontSize: 10, color: COLORS.secondaryText },
});
