import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

export type CartItem = {
  id: string;
  productId: string;
  storeId: string;
  name: string;
  merchant: string;
  price: number;
  image: string | null;
  variant: string;
  quantity: number;
  isAvailable: boolean;
};

type CartRecord = {
  product_id: string;
  variant: string;
  quantity: number;
  products: {
    id: string;
    store_id: string;
    name: string;
    price: number;
    image_url: string | null;
    is_available: boolean;
    stores: { name: string } | null;
  } | null;
};

async function currentUserId(required: boolean): Promise<string | null> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id ?? null;
  if (!userId && required) throw new Error('Masuk ke akun terlebih dahulu untuk menggunakan keranjang.');
  return userId;
}

export async function loadCartItems(): Promise<CartItem[]> {
  const userId = await currentUserId(false);
  if (!userId) return [];
  const { data, error } = await supabase
    .from('cart_items')
    .select('product_id, variant, quantity, products(id, store_id, name, price, image_url, is_available, stores(name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as CartRecord[]).map((row) => ({
    id: `${row.product_id}:${row.variant}`,
    productId: row.product_id,
    storeId: row.products?.store_id ?? '',
    name: row.products?.name ?? 'Produk tidak tersedia',
    merchant: row.products?.stores?.name ?? 'UMKM',
    price: Number(row.products?.price ?? 0),
    image: row.products?.image_url ?? null,
    variant: row.variant,
    quantity: row.quantity,
    isAvailable: row.products?.is_available ?? false,
  }));
}

export async function addCartItem(productId: string, quantity: number, variant = ''): Promise<void> {
  const userId = await currentUserId(true);
  const { data: existing, error: readError } = await supabase
    .from('cart_items')
    .select('quantity')
    .eq('user_id', userId!)
    .eq('product_id', productId)
    .eq('variant', variant)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await supabase.from('cart_items').upsert({
    user_id: userId!,
    product_id: productId,
    variant,
    quantity: (existing?.quantity ?? 0) + quantity,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,product_id,variant' });
  if (error) throw error;
}

export async function updateCartItemQuantity(productId: string, variant: string, quantity: number): Promise<void> {
  const userId = await currentUserId(true);
  const { error } = await supabase.from('cart_items').update({
    quantity,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId!).eq('product_id', productId).eq('variant', variant);
  if (error) throw error;
}

export async function removeCartItem(productId: string, variant: string): Promise<void> {
  const userId = await currentUserId(true);
  const { error } = await supabase.from('cart_items').delete()
    .eq('user_id', userId!).eq('product_id', productId).eq('variant', variant);
  if (error) throw error;
}

export async function checkoutCart(input: {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: 'bank' | 'wallet' | 'cod';
  shippingFee: number;
  serviceFee?: number;
  discountAmount?: number;
  voucherCode?: string;
}): Promise<string[]> {
  await currentUserId(true);
  const { data, error } = await supabase.rpc('checkout_cart', {
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_delivery_address: input.deliveryAddress,
    p_payment_method: input.paymentMethod,
    p_shipping_fee: input.shippingFee,
    p_service_fee: Number(input.serviceFee ?? 0),
    p_discount_amount: Number(input.discountAmount ?? 0),
    p_voucher_code: (input.voucherCode ?? '').trim(),
  });
  if (error) throw error;
  return ((data ?? []) as { order_id: string }[]).map((row) => row.order_id);
}