import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS, SHADOW } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { TopHeader } from '@/components/TopHeader';
import { EMPTY_ACCOUNT, loadAccountData, PAYMENT_OPTIONS, savePaymentMethod, type AccountData, type PaymentMethod } from '@/lib/accountStorage';

const deliveryOptions = [
  { id: 'regular', name: 'Reguler (1-2 hari)', price: 10000 },
  { id: 'instant', name: 'Instant (hari ini)', price: 15000 },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const [delivery, setDelivery] = useState('regular');
  const [account, setAccount] = useState<AccountData>(EMPTY_ACCOUNT);
  const shipping = deliveryOptions.find((d) => d.id === delivery)?.price ?? 10000;
  const subtotal = 72000;

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadAccountData().then((data) => {
      if (active) setAccount(data);
    });
    return () => { active = false; };
  }, []));

  const selectPayment = async (paymentMethod: PaymentMethod) => {
    try {
      await savePaymentMethod(paymentMethod);
      setAccount((current) => ({ ...current, paymentMethod }));
    } catch (error) {
      Alert.alert('Tidak dapat menyimpan', error instanceof Error ? error.message : 'Masuk untuk menyimpan metode pembayaran.');
      router.push('/account-details?section=login' as any);
    }
  };

  const address = account.address;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopHeader title="Checkout" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Alamat Pengiriman</Text>
        <Pressable style={styles.card} onPress={() => router.push('/account-details?section=address' as any)} accessibilityRole="button">
          <View style={styles.cardIcon}><AppIcon name="location" size={22} color={COLORS.primary} /></View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{address?.label ?? 'Alamat pengiriman'}</Text>
            <Text style={styles.cardText}>{address ? `${address.recipient} · ${address.details}` : 'Belum ada alamat. Ketuk untuk menambahkan.'}</Text>
            {address && <Text style={styles.cardText}>{address.phone}</Text>}
          </View>
          <AppIcon name="create-outline" size={20} color={COLORS.primary} />
        </Pressable>
        <Pressable style={styles.addAddress} onPress={() => router.push('/account-details?section=address' as any)}><AppIcon name="add-circle-outline" size={18} color={COLORS.primary} /><Text style={styles.addAddressText}>{address ? 'Ubah Alamat' : 'Tambah Alamat Baru'}</Text></Pressable>

        <Text style={styles.sectionTitle}>Metode Pengiriman</Text>
        <View style={styles.cardGroup}>
          {deliveryOptions.map((item) => {
            const active = delivery === item.id;
            return (
              <Pressable key={item.id} style={styles.optionRow} onPress={() => setDelivery(item.id)}>
                <AppIcon name={active ? 'radio-button-on' : 'radio-button-off'} size={21} color={active ? COLORS.primary : COLORS.muted} />
                <Text style={styles.optionName}>{item.name}</Text>
                <Text style={styles.optionPrice}>{rupiah(item.price)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
        <View style={styles.cardGroup}>
          {PAYMENT_OPTIONS.map((item) => {
            const active = account.paymentMethod === item.id;
            return (
              <Pressable key={item.id} style={styles.optionRow} onPress={() => void selectPayment(item.id)}>
                <View style={styles.paymentIcon}><AppIcon name={item.icon} size={18} color={COLORS.primary} /></View>
                <Text style={styles.optionName}>{item.name}</Text>
                <AppIcon name={active ? 'radio-button-on' : 'radio-button-off'} size={21} color={active ? COLORS.primary : COLORS.muted} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summaryCard}>
          <SummaryRow label="Subtotal" value={rupiah(subtotal)} />
          <SummaryRow label="Ongkir" value={rupiah(shipping)} />
          <View style={styles.divider} />
          <SummaryRow label="Total Pembayaran" value={rupiah(subtotal + shipping)} bold />
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <View><Text style={styles.totalLabel}>Total Pembayaran</Text><Text style={styles.total}>{rupiah(subtotal + shipping)}</Text></View>
        <Pressable style={styles.payButton} onPress={() => router.replace('/tracking')}><Text style={styles.payText}>Bayar Sekarang</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, bold && styles.bold]}>{label}</Text><Text style={[styles.summaryValue, bold && styles.totalOrange]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  sectionTitle: { marginTop: 15, marginBottom: 9, fontSize: 13, fontWeight: '900', color: COLORS.text },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, ...SHADOW },
  cardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  cardText: { fontSize: 10, lineHeight: 15, color: COLORS.secondaryText, marginTop: 2 },
  addAddress: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  addAddressText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  cardGroup: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...SHADOW },
  optionRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#F1F1F1' },
  optionName: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text },
  optionPrice: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  paymentIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { marginTop: 18, backgroundColor: '#fff', borderRadius: 16, padding: 14, ...SHADOW },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  summaryLabel: { fontSize: 12, color: COLORS.secondaryText },
  summaryValue: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  bold: { fontWeight: '900', color: COLORS.text },
  totalOrange: { color: COLORS.primary, fontSize: 15 },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginVertical: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingHorizontal: 18, paddingTop: 11, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 9, color: COLORS.secondaryText },
  total: { marginTop: 2, fontSize: 17, fontWeight: '900', color: COLORS.text },
  payButton: { height: 48, minWidth: 155, backgroundColor: COLORS.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  payText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
