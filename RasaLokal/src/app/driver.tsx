import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '@/components/AppIcon';
import { TopHeader } from '@/components/TopHeader';
import { DriverHub, type DriverTab } from '@/components/DriverHub';
import { DriverAccountGate } from '@/components/DriverAccountGate';
import { DriverOperationalGuide } from '@/components/DriverOperationalGuide';
import { COLORS } from '@/constants/theme';
import { rupiah } from '@/constants/data';
import { watchDriverPosition } from '@/lib/driverGps';
import { getDriverDeliveryProofUrl, uploadDriverDeliveryProof } from '@/lib/driverProofStorage';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { claimDriverOrder, loadDriverOrderQueue, loadDriverOrders, observeDriverOrderQueue, observeOrders, ORDER_STATUS_LABELS, publishDriverLocation, recordDriverCodCollection, recordDriverHandover, type DriverQueueOrder, type ShopOrder } from '@/lib/orderStorage';

export default function DriverScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [queueOrders, setQueueOrders] = useState<DriverQueueOrder[]>([]);
  const [selectedId, setSelectedId] = useState(params.id ?? '');
  const [activeTab, setActiveTab] = useState<DriverTab>('home');
  const [loading, setLoading] = useState(true);
  const [claimingOrderId, setClaimingOrderId] = useState('');
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const { access, loading: loadingAccess, error: accessError, refresh } = useDriverAccess();
  const activeDriverId = access?.kind === 'active' ? access.driver.userId : null;
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingCod, setConfirmingCod] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofImage, setProofImage] = useState<{ orderId: string; uri: string } | null>(null);
  const [savedProofOrderId, setSavedProofOrderId] = useState('');
  const [codConfirmedOrderId, setCodConfirmedOrderId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const sharingOrderId = useRef<string | null>(null);
  const generation = useRef(0);
  const sendingLocation = useRef(false);
  const activeOrders = orders.filter((item) => !['completed', 'cancelled', 'payment_failed', 'rejected'].includes(item.status));
  const order = orders.find((item) => item.id === selectedId) ?? activeOrders[0] ?? orders[0];
  const hasDeliveryProof = Boolean(order && (order.deliveryProofPath || savedProofOrderId === order.id));
  const isCod = order?.paymentMethod.toLowerCase() === 'cod';
  const codCollected = Boolean(order && (order.codCollectedAmount === order.total || codConfirmedOrderId === order.id));

  useEffect(() => {
    let active = true;
    if (!order?.deliveryProofPath) return () => { active = false; };
    void getDriverDeliveryProofUrl(order.deliveryProofPath).then((url) => {
      if (active) setProofImage({ orderId: order.id, uri: url });
    }).catch((proofError: unknown) => {
      if (active) setError(proofError instanceof Error ? proofError.message : 'Bukti pengantaran tersimpan, tetapi belum dapat ditampilkan.');
    });
    return () => { active = false; };
  }, [order?.id, order?.deliveryProofPath]);

  const stopSharing = useCallback(() => {
    generation.current += 1;
    subscription.current?.remove();
    subscription.current = null;
    sharingOrderId.current = null;
    setSharing(false);
    setStarting(false);
  }, []);

  useFocusEffect(useCallback(() => {
    if (loadingAccess || !activeDriverId) {
      setOrders([]);
      setQueueOrders([]);
      setLoading(false);
      setQueueLoading(false);
      setError('');
      setQueueError('');
      stopSharing();
      return;
    }
    setLoading(true);
    setQueueLoading(true);
    const stopObserving = observeOrders('driver', (loaded) => {
      setOrders(loaded);
      setLoading(false);
      if (sharingOrderId.current && !loaded.some((item) => item.id === sharingOrderId.current)) {
        stopSharing();
        setMessage('Tugas pengiriman sudah berakhir. Berbagi lokasi dihentikan.');
      }
    }, () => { setLoading(false); setError('Tugas driver belum dapat dimuat. Periksa koneksi lalu coba lagi.'); });
    const stopObservingQueue = observeDriverOrderQueue((loaded) => {
      setQueueOrders(loaded);
      setQueueLoading(false);
      setQueueError('');
    }, () => {
      setQueueLoading(false);
      setQueueError('Antrean tugas belum dapat dimuat. Periksa koneksi atau terapkan migrasi antrean driver terbaru.');
    });
    return () => { stopObserving(); stopObservingQueue(); stopSharing(); };
  }, [loadingAccess, activeDriverId, stopSharing]));

  const startSharing = async () => {
    if (!order || starting || access?.kind !== 'active') return;
    stopSharing();
    const currentGeneration = generation.current;
    const orderId = order.id;
    setStarting(true);
    setError('');
    setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (generation.current !== currentGeneration) return;
      if (!permission.granted) throw new Error('Izinkan akses lokasi agar perjalananmu dapat dilacak.');
      sharingOrderId.current = orderId;
      const watcher = await watchDriverPosition((position) => {
        if (generation.current !== currentGeneration || sendingLocation.current) return;
        sendingLocation.current = true;
        void publishDriverLocation(orderId, {
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracy: position.coords.accuracy, recordedAt: new Date(position.timestamp).toISOString(),
        }).then(() => { if (generation.current === currentGeneration) setError(''); })
          .catch((locationError: unknown) => { if (generation.current === currentGeneration) setError(locationError instanceof Error ? locationError.message : 'Lokasi belum dapat dikirim.'); })
          .finally(() => { sendingLocation.current = false; });
      }, () => { if (generation.current === currentGeneration) setError('Sinyal GPS tidak tersedia. Periksa izin dan layanan lokasi perangkat.'); });
      if (generation.current !== currentGeneration) { watcher.remove(); return; }
      subscription.current = watcher;
      setSharing(true);
    } catch (locationError) {
      if (generation.current === currentGeneration) {
        sharingOrderId.current = null;
        setError(locationError instanceof Error ? locationError.message : 'Lokasi tidak dapat diaktifkan.');
      }
    } finally {
      if (generation.current === currentGeneration) setStarting(false);
    }
  };

  const confirmHandover = async (event: 'picked_up' | 'delivered') => {
    if (!order || submitting || !sharing) return;
    if (event === 'delivered' && !hasDeliveryProof) {
      setError('Ambil dan unggah foto bukti pengantaran sebelum menyelesaikan tugas.');
      return;
    }
    if (event === 'delivered' && isCod && codConfirmedOrderId !== order.id) {
      setError('Konfirmasikan terlebih dahulu bahwa uang COD sesuai total pesanan sudah diterima.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await recordDriverHandover(order.id, event);
      setMessage(event === 'picked_up' ? 'Pengambilan tercatat. Perjalanan ke pelanggan mengikuti GPS.' : 'Penyerahan tercatat. Pengiriman selesai.');
      if (event === 'delivered') stopSharing();
    } catch (handoverError) {
      setError(handoverError instanceof Error ? handoverError.message : 'Konfirmasi belum dapat disimpan.');
    } finally {
      setSubmitting(false);
    }
  };

  const captureDeliveryProof = async () => {
    if (!order || order.status !== 'driver_arrived' || !sharing || uploadingProof) return;
    setError('');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Izinkan akses kamera untuk mengambil bukti pengantaran.');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize !== undefined && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error('Ukuran foto bukti maksimal 5 MB. Ambil ulang dengan resolusi lebih rendah.');
      }
      setUploadingProof(true);
      await uploadDriverDeliveryProof(order.id, asset);
      setSavedProofOrderId(order.id);
      setProofImage({ orderId: order.id, uri: asset.uri });
      setMessage('Foto bukti pengantaran berhasil diunggah.');
      setError('');
    } catch (proofError) {
      setError(proofError instanceof Error ? proofError.message : 'Foto bukti pengantaran belum dapat diunggah.');
    } finally {
      setUploadingProof(false);
    }
  };

  const confirmCodCollection = async () => {
    if (!order || !isCod || !sharing || confirmingCod || codCollected) return;
    setConfirmingCod(true);
    setError('');
    try {
      await recordDriverCodCollection(order.id, order.total);
      setCodConfirmedOrderId(order.id);
      setMessage(`Penerimaan COD sebesar ${rupiah(order.total)} berhasil dicatat.`);
    } catch (codError) {
      setError(codError instanceof Error ? codError.message : 'Penerimaan COD belum dapat dicatat.');
    } finally {
      setConfirmingCod(false);
    }
  };

  const refreshTasks = async () => {
    setLoading(true);
    setQueueLoading(true);
    try {
      setOrders(await loadDriverOrders());
      setError('');
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Tugas driver belum dapat dimuat.');
    }
    try {
      setQueueOrders(await loadDriverOrderQueue());
      setQueueError('');
    } catch (refreshError) {
      setQueueError(refreshError instanceof Error ? refreshError.message : 'Antrean tugas belum dapat dimuat.');
    } finally {
      setQueueLoading(false);
    }
    setLoading(false);
  };

  const claimQueuedOrder = async (item: DriverQueueOrder) => {
    if (claimingOrderId !== '' || item.status !== 'ready_for_pickup') return;
    setClaimingOrderId(item.id);
    setError('');
    setMessage('');
    try {
      await claimDriverOrder(item.id);
      setQueueOrders((current) => current.filter((queued) => queued.id !== item.id));
      setSelectedId(item.id);
      setMessage('Tugas berhasil diambil. Aktifkan lokasi driver untuk memulai pengantaran.');
      try {
        setOrders(await loadDriverOrders());
      } catch {
        setError('Tugas berhasil diambil, tetapi rincian sedang dimuat ulang. Periksa koneksi.');
      }
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : 'Tugas belum dapat diambil. Coba muat ulang antrean.');
    } finally {
      setClaimingOrderId('');
    }
  };

  const openRoute = async (destination: 'merchant' | 'customer') => {
    if (!order) return;
    const point = destination === 'merchant' ? order.driver?.pickup : order.driver?.destination;
    const destinationValue = point
      ? `${point.latitude},${point.longitude}`
      : destination === 'customer' ? order.deliveryAddress : '';
    if (!destinationValue) {
      setError('Titik lokasi merchant belum tersedia. Hubungi admin untuk memperbarui titik toko.');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationValue)}&travelmode=driving`;
    try {
      await Linking.openURL(url);
      setError('');
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : 'Aplikasi navigasi tidak dapat dibuka.');
    }
  };

  const taskContent = <View style={styles.taskContent}>
      {access?.kind === 'active' && <Text style={styles.note}>Aktifkan lokasi saat menjalankan tugas. GPS hanya dibagikan selama halaman ini aktif.</Text>}
      {(loading || queueLoading || loadingAccess) && <ActivityIndicator color={COLORS.primary} />}
      {accessError !== '' && <Text style={styles.error} accessibilityRole="alert">{accessError}</Text>}
      {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {queueError !== '' && <Text style={styles.error} accessibilityRole="alert">{queueError}</Text>}
      {!loadingAccess && access && access.kind !== 'active' && <DriverAccountGate access={access} onRefresh={() => void refresh()} />}
      {!loadingAccess && !access && <Pressable style={styles.button} onPress={() => void refresh()} accessibilityRole="button"><Text style={styles.buttonText}>Coba lagi</Text></Pressable>}
      {message !== '' && <Text style={styles.note} accessibilityLiveRegion="polite">{message}</Text>}
      <DriverOperationalGuide />
      {!loading && !queueLoading && access?.kind === 'active' && queueOrders.map((item) => <View key={item.id} style={styles.job}>
        <Text style={styles.title}>Tugas tersedia · {item.storeName}</Text>
        <Text style={styles.note}>Pesanan #{item.id.slice(0, 8).toUpperCase()} · {ORDER_STATUS_LABELS[item.status]}</Text>
        <Text style={styles.note}>Total {rupiah(item.total)} · {item.paymentMethod === 'cod' ? 'COD' : 'Pembayaran berhasil'}</Text>
        {item.status === 'ready_for_pickup'
          ? <Pressable style={[styles.button, claimingOrderId !== '' && styles.disabled]} onPress={() => void claimQueuedOrder(item)} disabled={claimingOrderId !== ''} accessibilityRole="button">
            <Text style={styles.buttonText}>{claimingOrderId === item.id ? 'Mengambil tugas...' : 'Ambil tugas'}</Text>
          </Pressable>
          : <Text style={styles.note}>Menunggu merchant menyiapkan pesanan. Tugas dapat diambil saat siap.</Text>}
      </View>)}
      {!loading && access?.kind === 'active' && activeOrders.map((item) => <Pressable key={item.id} style={[styles.job, order?.id === item.id && styles.jobSelected]} accessibilityRole="button" onPress={() => { stopSharing(); setSelectedId(item.id); setError(''); setMessage(''); }}>
        <Text style={styles.title}>Pesanan #{item.id.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.note}>{item.customerName} · {ORDER_STATUS_LABELS[item.status]}</Text>
      </Pressable>)}
      {!loading && access?.kind === 'active' && order && <View style={styles.card}>
        <Text style={styles.title}>{ORDER_STATUS_LABELS[order.status]}</Text>
        <Text style={styles.note}>Pesanan #{order.id.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.note}>Pengambilan: titik merchant dari peta pesanan</Text>
        <Text style={styles.note}>Tujuan: {order.deliveryAddress}</Text>
        <Text style={styles.note}>{order.customerPhone}</Text>
        {['driver_assigned', 'driver_going_to_merchant'].includes(order.status) && <Pressable style={styles.secondaryButton} onPress={() => void openRoute('merchant')} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Navigasi ke merchant</Text></Pressable>}
        {['picked_up', 'driver_going_to_customer'].includes(order.status) && <Pressable style={styles.secondaryButton} onPress={() => void openRoute('customer')} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Navigasi ke pelanggan</Text></Pressable>}
        <Text style={styles.note}>{sharing ? 'Berbagi GPS aktif. Status menuju dan tiba diperbarui dari posisimu.' : 'Aktifkan GPS untuk memperbarui perjalanan secara otomatis.'}</Text>
        <Pressable style={styles.button} onPress={sharing ? stopSharing : () => void startSharing()} disabled={starting} accessibilityRole="button">
          <Text style={styles.buttonText}>{starting ? 'Mengaktifkan GPS...' : sharing ? 'Hentikan berbagi lokasi' : 'Aktifkan lokasi driver'}</Text>
        </Pressable>
        {order.status === 'driver_arrived_merchant' && <Pressable style={[styles.button, (!sharing || submitting) && styles.disabled]} onPress={() => void confirmHandover('picked_up')} disabled={!sharing || submitting} accessibilityRole="button"><Text style={styles.buttonText}>Pesanan sudah saya ambil</Text></Pressable>}
        {order.status === 'driver_arrived' && <>
          <View style={styles.proofCard}>
            <Text style={styles.title}>Bukti pengantaran wajib</Text>
            <Text style={styles.note}>Foto paket saat diterima pembeli atau di lokasi penitipan yang sudah disetujui. Pastikan paket dan penanda lokasi terlihat jelas.</Text>
            {proofImage?.orderId === order.id && <Image source={{ uri: proofImage.uri }} style={styles.proofImage} accessibilityLabel="Foto bukti pengantaran yang sudah diunggah" />}
            <Pressable style={[styles.secondaryButton, (!sharing || uploadingProof) && styles.disabled]} onPress={() => void captureDeliveryProof()} disabled={!sharing || uploadingProof} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>{uploadingProof ? 'Mengunggah foto...' : hasDeliveryProof ? 'Ambil ulang foto bukti' : 'Ambil & unggah foto bukti'}</Text>
            </Pressable>
            {hasDeliveryProof && <Text style={styles.successNote}>Bukti foto tersimpan. Anda dapat melanjutkan setelah pembayaran COD dikonfirmasi, jika berlaku.</Text>}
          </View>
          {isCod && <View style={styles.codCard}>
            <Text style={styles.title}>Pembayaran tunai (COD)</Text>
            <Text style={styles.codAmount}>Tagih {rupiah(order.total)}</Text>
            <Text style={styles.note}>Hitung uang yang diterima dan kembalian. Konfirmasi hanya setelah nominal sesuai dan uang benar-benar diterima.</Text>
            <Pressable style={[styles.codConfirm, (!sharing || confirmingCod || codCollected) && styles.disabled]} onPress={() => void confirmCodCollection()} disabled={!sharing || confirmingCod || codCollected} accessibilityRole="checkbox" accessibilityState={{ checked: codCollected }}>
              <AppIcon name={codCollected ? 'checkbox' : 'checkbox-outline'} size={21} color={COLORS.primary} />
              <Text style={styles.note}>{confirmingCod ? 'Mencatat pembayaran COD...' : codCollected ? `COD ${rupiah(order.total)} sudah tercatat diterima` : `Konfirmasi uang ${rupiah(order.total)} sudah diterima`}</Text>
            </Pressable>
          </View>}
          <Text style={styles.note}>Pastikan pesanan sudah diserahkan{order.paymentMethod === 'cod' ? ' dan pembayaran COD sudah diterima' : ''} sebelum konfirmasi.</Text>
          <Pressable style={[styles.button, (!sharing || submitting || !hasDeliveryProof || (isCod && !codCollected)) && styles.disabled]} onPress={() => void confirmHandover('delivered')} disabled={!sharing || submitting || !hasDeliveryProof || (isCod && !codCollected)} accessibilityRole="button"><Text style={styles.buttonText}>Konfirmasi penyerahan pesanan</Text></Pressable>
        </>}
      </View>}
      {!loading && !queueLoading && access?.kind === 'active' && activeOrders.length === 0 && queueOrders.length === 0 && !queueError && <Text style={styles.note}>Belum ada tugas pengiriman untuk akun ini.</Text>}
    </View>;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    {!loadingAccess && access?.kind === 'active'
      ? <DriverHub
        tab={activeTab}
        queueLoading={queueLoading}
        queueError={queueError}
        queueOrders={queueOrders}
        onTabChange={(tab) => {
          if (tab !== 'tasks') stopSharing();
          setActiveTab(tab);
        }}
        orders={orders}
        selectedOrderId={selectedId}
        driverName={access.driver.name}
        onSelectOrder={(id) => { stopSharing(); setSelectedId(id); setError(''); setMessage(''); }}
        onRefresh={() => void refreshTasks()}
      >{taskContent}</DriverHub>
      : <>
        <TopHeader title="Pusat Driver" />
        <ScrollView contentContainerStyle={styles.content}>
          {(loading || loadingAccess) && <ActivityIndicator color={COLORS.primary} />}
          {accessError !== '' && <Text style={styles.error} accessibilityRole="alert">{accessError}</Text>}
          {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          {!loadingAccess && access && access.kind !== 'active' && <DriverAccountGate access={access} onRefresh={() => void refresh()} />}
          {!loadingAccess && !access && <Pressable style={styles.button} onPress={() => void refresh()} accessibilityRole="button"><Text style={styles.buttonText}>Coba lagi</Text></Pressable>}
        </ScrollView>
      </>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 18, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  taskContent: { gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  note: { fontSize: 12, lineHeight: 19, color: COLORS.secondaryText },
  error: { fontSize: 12, lineHeight: 18, color: COLORS.danger, padding: 12, backgroundColor: COLORS.orange50, borderRadius: 10 },
  title: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  job: { padding: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#fff' },
  jobSelected: { borderColor: COLORS.primary },
  card: { padding: 16, gap: 12, borderRadius: 14, backgroundColor: '#fff' },
  button: { minHeight: 46, padding: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, color: '#fff', fontWeight: '800', textAlign: 'center' },
  secondaryButton: { minHeight: 44, padding: 11, borderRadius: 10, backgroundColor: COLORS.orange50, borderWidth: 1, borderColor: '#F5DBCB', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 12, color: COLORS.primary, fontWeight: '800', textAlign: 'center' },
  proofCard: { padding: 13, gap: 10, borderRadius: 12, backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: COLORS.border },
  proofImage: { width: '100%', height: 190, borderRadius: 10, backgroundColor: COLORS.border },
  successNote: { fontSize: 12, lineHeight: 18, color: '#17834D' },
  codCard: { padding: 13, gap: 9, borderRadius: 12, backgroundColor: '#FFF8EE', borderWidth: 1, borderColor: '#F5DBCB' },
  codAmount: { fontSize: 19, fontWeight: '900', color: COLORS.primary },
  codConfirm: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.5 },
});
