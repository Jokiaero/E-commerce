import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { deliveryCoordinate, getNextMerchantStatus, type DriverTracking } from '@/lib/deliveryTracking';

export const LEGACY_ORDER_STATUSES = ['pending', 'accepted', 'processing', 'shipped', 'completed', 'rejected'] as const;
export const ORDER_STATUS_SEQUENCE = [
  'pending_payment',
  'confirmed',
  'merchant_accepted',
  'preparing',
  'ready_for_pickup',
  'driver_assigned',
  'driver_going_to_merchant',
  'driver_arrived_merchant',
  'picked_up',
  'driver_going_to_customer',
  'driver_arrived',
  'delivered',
  'completed',
  'cancelled',
  'payment_failed',
] as const;

export type LegacyOrderStatus = (typeof LEGACY_ORDER_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUS_SEQUENCE)[number] | LegacyOrderStatus;
export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed';

export type ShopOrder = {
  id: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  subtotal: number;
  shippingFee: number;
  serviceFee: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentProvider: string | null;
  paymentChannel: string | null;
  paymentReference: string | null;
  voucherCode: string;
  createdAt: string;
  driver: DriverTracking | null;
  deliveryProofPath: string | null;
  codCollectedAmount: number | null;
  items: { name: string; quantity: number; unitPrice: number; variant: string }[];
};

export type DriverQueueOrder = {
  id: string;
  status: OrderStatus;
  storeName: string;
  createdAt: string;
  total: number;
  paymentMethod: string;
};

type OrderRecord = {
  id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  subtotal: number;
  shipping_fee: number;
  service_fee: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: PaymentStatus;
  payment_provider?: string | null;
  payment_channel?: string | null;
  payment_reference?: string | null;
  voucher_code: string | null;
  created_at: string;
  driver_id?: string | null;
  driver_name?: string;
  driver_phone?: string;
  driver_vehicle?: string;
  driver_latitude?: number | null;
  driver_longitude?: number | null;
  driver_accuracy?: number | null;
  driver_location_at?: string | null;
  delivery_proof_path?: string | null;
  cod_collected_amount?: number | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  order_items: { product_name: string; quantity: number; unit_price: number; variant: string }[];
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Menunggu pembayaran',
  confirmed: 'Pesanan dikonfirmasi',
  merchant_accepted: 'Merchant menerima pesanan',
  preparing: 'Makanan sedang disiapkan',
  ready_for_pickup: 'Siap diambil driver',
  driver_assigned: 'Driver ditugaskan',
  driver_going_to_merchant: 'Driver menuju merchant',
  driver_arrived_merchant: 'Driver sampai di merchant',
  picked_up: 'Pesanan diambil driver',
  driver_going_to_customer: 'Driver menuju lokasi Anda',
  driver_arrived: 'Driver tiba di lokasi',
  delivered: 'Pesanan diterima',
  completed: 'Pesanan selesai',
  cancelled: 'Pesanan dibatalkan',
  payment_failed: 'Pembayaran gagal',
  pending: 'Menunggu konfirmasi',
  accepted: 'Diterima penjual',
  processing: 'Sedang diproses',
  shipped: 'Sedang dikirim',
  rejected: 'Pesanan ditolak',
};

export const ORDER_TIMELINE = [
  'pending_payment',
  'confirmed',
  'merchant_accepted',
  'preparing',
  'ready_for_pickup',
  'driver_assigned',
  'driver_going_to_merchant',
  'driver_arrived_merchant',
  'picked_up',
  'driver_going_to_customer',
  'driver_arrived',
  'delivered',
  'completed',
] as const;

export function normalizeOrderStatus(status: string | null | undefined): OrderStatus {
  const normalized = (status ?? '').trim();
  switch (normalized) {
    case 'accepted':
      return 'merchant_accepted';
    case 'processing':
      return 'preparing';
    case 'shipped':
      return 'driver_going_to_customer';
    case 'rejected':
      return 'cancelled';
    case 'pending':
      return 'confirmed';
    default:
      return (normalized as OrderStatus) || 'pending_payment';
  }
}

export function calculateOrderSummary(input: {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discountAmount: number;
}) {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const deliveryFee = Math.max(0, Number(input.deliveryFee) || 0);
  const serviceFee = Math.max(0, Number(input.serviceFee) || 0);
  const discountAmount = Math.min(Math.max(0, Number(input.discountAmount) || 0), subtotal);
  const total = subtotal + deliveryFee + serviceFee - discountAmount;
  return { subtotal, deliveryFee, serviceFee, discountAmount, total: Math.max(0, total) };
}

export function getNextOrderStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_TIMELINE.indexOf(normalizeOrderStatus(status) as (typeof ORDER_TIMELINE)[number]);
  if (index === -1 || index >= ORDER_TIMELINE.length - 1) return null;
  return ORDER_TIMELINE[index + 1];
}

export const VOUCHERS = [
  { code: 'FOOD10', type: 'percent', value: 10, minSubtotal: 30000, expiresAt: '2099-12-31' },
  { code: 'RASA15', type: 'percent', value: 15, minSubtotal: 50000, expiresAt: '2099-12-31' },
] as const;

export function validateVoucher(code: string, subtotal: number) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const voucher = VOUCHERS.find((item) => item.code === trimmed);
  if (!voucher) return null;
  if (subtotal < voucher.minSubtotal) return null;
  const discount = Math.min(Math.round(subtotal * (voucher.value / 100)), subtotal);
  return { code: voucher.code, discount, minSubtotal: voucher.minSubtotal };
}

async function requireUserId(): Promise<string> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Masuk terlebih dahulu untuk mengakses pesanan.');
  return data.session.user.id;
}

function mapOrder(order: OrderRecord): ShopOrder {
  const status = normalizeOrderStatus(order.status);
  return {
    id: order.id,
    status,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    deliveryAddress: order.delivery_address,
    subtotal: Number(order.subtotal ?? 0),
    shippingFee: Number(order.shipping_fee ?? 0),
    serviceFee: Number(order.service_fee ?? 0),
    discountAmount: Number(order.discount_amount ?? 0),
    total: Number(order.total_amount ?? 0),
    paymentMethod: order.payment_method ?? 'bank',
    paymentStatus: order.payment_status ?? 'pending',
    paymentProvider: order.payment_provider ?? null,
    paymentChannel: order.payment_channel ?? null,
    paymentReference: order.payment_reference ?? null,
    voucherCode: order.voucher_code ?? '',
    createdAt: order.created_at,
    driver: order.driver_id ? {
      driverId: order.driver_id,
      name: order.driver_name || 'Driver RasaLokal',
      phone: order.driver_phone ?? '',
      vehicle: order.driver_vehicle ?? '',
      coordinate: deliveryCoordinate(order.driver_latitude, order.driver_longitude),
      accuracy: order.driver_accuracy ?? null,
      recordedAt: order.driver_location_at ?? null,
      pickup: deliveryCoordinate(order.pickup_latitude, order.pickup_longitude),
      destination: deliveryCoordinate(order.delivery_latitude, order.delivery_longitude),
    } : null,
    deliveryProofPath: order.delivery_proof_path ?? null,
    codCollectedAmount: order.cod_collected_amount === null || order.cod_collected_amount === undefined
      ? null : Number(order.cod_collected_amount),
    items: (order.order_items ?? []).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      variant: item.variant,
    })),
  };
}

export async function loadSellerOrders(): Promise<ShopOrder[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(product_name, quantity, unit_price, variant)')
    .eq('store_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRecord[]).map(mapOrder);
}

export async function loadBuyerOrders(): Promise<ShopOrder[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(product_name, quantity, unit_price, variant)')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRecord[]).map(mapOrder);
}

export async function updateSellerOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await requireUserId();
  const normalized = normalizeOrderStatus(status);
  if (!['merchant_accepted', 'preparing', 'ready_for_pickup'].includes(normalized)) {
    throw new Error('Penjual hanya dapat memperbarui persiapan pesanan. Pengiriman mengikuti driver.');
  }
  const { error } = await supabase.rpc('update_merchant_order_status', { p_order_id: orderId, p_status: normalized });
  if (error) throw error;
}

export { getNextMerchantStatus };

export async function loadDriverOrders(): Promise<ShopOrder[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from('orders')
    .select('*, order_items(product_name, quantity, unit_price, variant)')
    .eq('driver_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRecord[]).map(mapOrder);
}

export async function loadDriverOrderQueue(): Promise<DriverQueueOrder[]> {
  await requireUserId();
  const { data, error } = await supabase.rpc('list_driver_order_queue');
  if (error) throw new Error(error.code === 'PGRST202'
    ? 'Antrean tugas driver belum tersedia. Terapkan migrasi antrean driver terbaru.'
    : error.message);
  return ((data ?? []) as {
    order_id: string;
    order_status: string;
    store_name: string;
    created_at: string;
    total_amount: number;
    payment_method: string;
  }[]).map((row) => ({
    id: row.order_id,
    status: normalizeOrderStatus(row.order_status),
    storeName: row.store_name,
    createdAt: row.created_at,
    total: Number(row.total_amount),
    paymentMethod: row.payment_method,
  }));
}

export function observeDriverOrderQueue(
  onData: (orders: DriverQueueOrder[]) => void,
  onError: (error: unknown) => void,
): () => void {
  let active = true;
  let loading = false;
  let reloadRequested = false;
  const refresh = async () => {
    if (!active) return;
    if (loading) { reloadRequested = true; return; }
    loading = true;
    try {
      const orders = await loadDriverOrderQueue();
      if (active) onData(orders);
    } catch (error) {
      if (active) onError(error);
    } finally {
      loading = false;
      if (reloadRequested && active) { reloadRequested = false; void refresh(); }
    }
  };
  void refresh();
  const timer = setInterval(() => { void refresh(); }, 5000);
  return () => { active = false; clearInterval(timer); };
}

export async function claimDriverOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_driver_order', { p_order_id: orderId });
  if (error) throw new Error(error.code === 'PGRST202'
    ? 'Fitur mengambil tugas belum tersedia. Terapkan migrasi antrean driver terbaru.'
    : error.message);
}

async function loadParticipantOrder(orderId: string): Promise<ShopOrder[]> {
  await requireUserId();
  const { data, error } = await supabase.from('orders')
    .select('*, order_items(product_name, quantity, unit_price, variant)').eq('id', orderId).maybeSingle();
  if (error) throw error;
  return data ? [mapOrder(data as unknown as OrderRecord)] : [];
}

// Realtime and fallback reads never manufacture or advance an order status.
export function observeOrders(scope: 'buyer' | 'seller' | 'driver', onData: (orders: ShopOrder[]) => void, onError: (error: unknown) => void, orderId?: string): () => void {
  let active = true;
  let loading = false;
  let reloadRequested = false;
  let channel: ReturnType<typeof supabase.channel> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const refresh = async () => {
    if (!active) return;
    if (loading) { reloadRequested = true; return; }
    loading = true;
    try {
      const orders = orderId ? await loadParticipantOrder(orderId)
        : scope === 'buyer' ? await loadBuyerOrders() : scope === 'seller' ? await loadSellerOrders() : await loadDriverOrders();
      if (active) onData(orders);
    } catch (error) {
      if (active) onError(error);
    } finally {
      loading = false;
      if (reloadRequested && active) { reloadRequested = false; void refresh(); }
    }
  };
  void requireUserId().then((userId) => {
    if (!active) return;
    const filter = orderId ? `id=eq.${orderId}` : `${scope === 'buyer' ? 'buyer_id' : scope === 'seller' ? 'store_id' : 'driver_id'}=eq.${userId}`;
    channel = supabase.channel(`orders:${scope}:${orderId ?? userId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, () => { void refresh(); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh(); });
    timer = setInterval(() => { void refresh(); }, 15000);
    void refresh();
  }).catch((error: unknown) => { if (active) onError(error); });
  return () => { active = false; if (timer) clearInterval(timer); if (channel) void supabase.removeChannel(channel); };
}

export async function publishDriverLocation(orderId: string, location: { latitude: number; longitude: number; accuracy: number | null; recordedAt: string }): Promise<void> {
  if (!deliveryCoordinate(location.latitude, location.longitude) || location.accuracy === null || !Number.isFinite(location.accuracy) || location.accuracy < 0 || location.accuracy > 50) {
    throw new Error('Menunggu lokasi GPS yang lebih akurat (maksimal 50 meter).');
  }
  const { error } = await supabase.rpc('record_driver_location', {
    p_order_id: orderId, p_latitude: location.latitude, p_longitude: location.longitude,
    p_accuracy: location.accuracy, p_recorded_at: location.recordedAt,
  });
  if (error) throw new Error(error.code === 'PGRST202' ? 'Layanan driver belum tersedia. Hubungi admin.' : error.message);
}

export async function recordDriverHandover(orderId: string, event: 'picked_up' | 'delivered'): Promise<void> {
  const { error } = await supabase.rpc('record_driver_handover', { p_order_id: orderId, p_event: event });
  if (error) throw new Error(error.code === 'PGRST202' ? 'Layanan driver belum tersedia. Hubungi admin.' : error.message);
}

export async function recordDriverCodCollection(orderId: string, amount: number): Promise<void> {
  const { error } = await supabase.rpc('record_driver_cod_collection', {
    p_order_id: orderId,
    p_amount: amount,
  });
  if (error) throw new Error(error.code === 'PGRST202'
    ? 'Layanan konfirmasi COD belum tersedia. Minta admin menerapkan migrasi database terbaru.'
    : error.message);
}

export async function completeSimulatedPayment(orderIds: string[], channel: string): Promise<void> {
  const { error } = await supabase.rpc('complete_simulated_payment', {
    p_order_ids: orderIds,
    p_channel: channel,
  });
  if (error) throw new Error(error.code === 'PGRST202'
    ? 'Layanan simulasi pembayaran belum tersedia. Terapkan migrasi simulasi pembayaran.'
    : error.message);
}
