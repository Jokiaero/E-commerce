import type { ProductCategory } from '@/constants/data';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { uploadUserImage } from '@/lib/imageStorage';
import type { ImagePickerAsset } from 'expo-image-picker';

export type ProductVariant = { name: string; price: number; stock: number };

export type ProductDetails = {
  sku: string | null;
  promoPrice: number | null;
  stock: number;
  unit: string;
  weight: number | null;
  variants: ProductVariant[];
};

export type Store = {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  storeType: string;
  merchantCategory: string;
  contactEmail: string;
  imageUrl: string | null;
  hasQris: boolean;
  latitude: number | null;
  longitude: number | null;
  isOpen: boolean;
};

export type CatalogProduct = {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  category: ProductCategory;
  isAvailable: boolean;
  storeName: string;
  storeAddress: string;
  details: ProductDetails;
};

type ProductRecord = {
  id: string;
  store_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: ProductCategory;
  is_available: boolean;
  stores: { name: string; address: string } | null;
  product_details: ProductDetails | null;
};

function mapProduct(product: ProductRecord): CatalogProduct {
  return {
    id: product.id,
    storeId: product.store_id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    image: product.image_url,
    category: product.category,
    isAvailable: product.is_available,
    storeName: product.stores?.name ?? 'UMKM',
    storeAddress: product.stores?.address ?? '',
    details: {
      sku: product.product_details?.sku ?? null,
      promoPrice: product.product_details?.promoPrice ?? null,
      stock: product.product_details?.stock ?? 0,
      unit: product.product_details?.unit ?? 'pcs',
      weight: product.product_details?.weight ?? null,
      variants: product.product_details?.variants ?? [],
    },
  };
}

async function requireUserId(): Promise<string> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Masuk ke akun terlebih dahulu.');
  return data.session.user.id;
}

export async function loadPublicProducts(): Promise<CatalogProduct[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('products')
    .select('id, store_id, name, description, price, image_url, category, is_available, product_details, stores(name, address)')
    .eq('is_available', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ProductRecord[]).map(mapProduct);
}

export async function loadProduct(productId: string): Promise<CatalogProduct> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('products')
    .select('id, store_id, name, description, price, image_url, category, is_available, product_details, stores(name, address)')
    .eq('id', productId)
    .single();
  if (error) throw error;
  return mapProduct(data as unknown as ProductRecord);
}

export async function loadSellerProducts(): Promise<CatalogProduct[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('products')
    .select('id, store_id, name, description, price, image_url, category, is_available, product_details, stores(name, address)')
    .eq('store_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ProductRecord[]).map(mapProduct);
}

export async function loadSellerStore(): Promise<Store | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from('stores').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    ownerName: data.owner_name,
    address: data.address,
    storeType: data.store_type,
    merchantCategory: data.merchant_category,
    contactEmail: data.contact_email ?? '',
    imageUrl: data.image_url ?? null,
    hasQris: data.has_qris,
    latitude: data.latitude,
    longitude: data.longitude,
    isOpen: data.is_open,
  };
}

export async function saveSellerStore(store: Omit<Store, 'id'>): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('stores').upsert({
    id: userId,
    name: store.name,
    owner_name: store.ownerName,
    address: store.address,
    store_type: store.storeType,
    merchant_category: store.merchantCategory,
    contact_email: store.contactEmail || null,
    image_url: store.imageUrl,
    has_qris: store.hasQris,
    latitude: store.latitude,
    longitude: store.longitude,
    is_open: store.isOpen,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function saveProduct(
  product: Pick<CatalogProduct, 'name' | 'description' | 'price' | 'image' | 'category' | 'isAvailable'> & { details?: ProductDetails },
  productId?: string,
): Promise<void> {
  const userId = await requireUserId();
  const values = {
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    image_url: product.image,
    is_available: product.isAvailable,
    product_details: product.details ?? { sku: null, promoPrice: null, stock: 0, unit: 'pcs', weight: null, variants: [] },
    updated_at: new Date().toISOString(),
  };
  const result = productId
    ? await supabase.from('products').update(values).eq('id', productId).eq('store_id', userId)
    : await supabase.from('products').insert({ ...values, store_id: userId });
  if (result.error) throw result.error;
}

async function uploadImage(asset: ImagePickerAsset, bucket: string): Promise<string> {
  const path = await uploadUserImage(asset, bucket);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function uploadProductPhoto(asset: ImagePickerAsset): Promise<string> {
  return uploadImage(asset, 'product-images');
}

export function uploadStorePhoto(asset: ImagePickerAsset): Promise<string> {
  return uploadImage(asset, 'store-images');
}

export async function updateSellerStoreImage(imageUrl: string | null): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('stores').update({ image_url: imageUrl }).eq('id', userId);
  if (error) throw error;
}

export async function setProductAvailability(productId: string, isAvailable: boolean): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('products').update({ is_available: isAvailable }).eq('id', productId).eq('store_id', userId);
  if (error) throw error;
}

export async function deleteProduct(productId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('products').delete().eq('id', productId).eq('store_id', userId);
  if (error) throw error;
}

export async function loadPublicStores(): Promise<Store[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('stores').select('id, name, owner_name, address, store_type, merchant_category, contact_email, image_url, has_qris, latitude, longitude, is_open').order('created_at');
  if (error) throw error;
  return (data ?? []).map((store) => ({
    id: store.id,
    name: store.name,
    ownerName: store.owner_name,
    address: store.address,
    storeType: store.store_type,
    merchantCategory: store.merchant_category,
    contactEmail: store.contact_email ?? '',
    imageUrl: store.image_url ?? null,
    hasQris: store.has_qris,
    latitude: store.latitude,
    longitude: store.longitude,
    isOpen: store.is_open,
  }));
}