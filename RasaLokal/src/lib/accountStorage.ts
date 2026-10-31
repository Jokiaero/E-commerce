import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ImagePickerAsset } from 'expo-image-picker';
import { uploadUserImage } from '@/lib/imageStorage';

export type PaymentMethod = 'bank' | 'wallet' | 'cod';

export type AccountAddress = {
  label: string;
  recipient: string;
  phone: string;
  details: string;
  latitude: number | null;
  longitude: number | null;
};

export type AccountData = {
  profile: { name: string; phone: string; avatarUrl: string | null } | null;
  address: AccountAddress | null;
  paymentMethod: PaymentMethod;
  favorites: string[];
};

export const PAYMENT_OPTIONS: readonly {
  id: PaymentMethod;
  icon: string;
  name: string;
  description: string;
}[] = [
  { id: 'bank', icon: 'business-outline', name: 'Transfer Bank', description: 'Pilih bank virtual demo saat checkout.' },
  { id: 'wallet', icon: 'wallet-outline', name: 'E-Wallet', description: 'Pilih e-wallet demo saat checkout.' },
  { id: 'cod', icon: 'cash-outline', name: 'Bayar di Tempat', description: 'Bayar langsung saat pesanan diterima.' },
];

export const EMPTY_ACCOUNT: AccountData = {
  profile: null,
  address: null,
  paymentMethod: 'bank',
  favorites: [],
};

async function requireUserId(): Promise<string> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Masuk terlebih dahulu untuk menyimpan data akun.');
  return data.session.user.id;
}

export async function loadAccountData(): Promise<AccountData> {
  if (!isSupabaseConfigured) return { ...EMPTY_ACCOUNT, favorites: [] };
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return { ...EMPTY_ACCOUNT, favorites: [] };

  const [profileResult, addressResult, favoritesResult] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, payment_method, avatar_path').eq('id', user.id).maybeSingle(),
    supabase.from('addresses').select('label, recipient, phone, details, latitude, longitude').eq('user_id', user.id).limit(1).maybeSingle(),
    supabase.from('favorites').select('product_id').eq('user_id', user.id),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (addressResult.error) throw addressResult.error;
  if (favoritesResult.error) throw favoritesResult.error;

  const profile = profileResult.data;
  const address = addressResult.data;
  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data: signedImage } = await supabase.storage.from('profile-images').createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = signedImage?.signedUrl ?? null;
  }
  return {
    profile: profile ? { name: profile.full_name, phone: profile.phone, avatarUrl } : null,
    address: address ? {
      label: address.label,
      recipient: address.recipient,
      phone: address.phone,
      details: address.details,
      latitude: address.latitude,
      longitude: address.longitude,
    } : null,
    paymentMethod: PAYMENT_OPTIONS.some((option) => option.id === profile?.payment_method)
      ? profile?.payment_method as PaymentMethod
      : 'bank',
    favorites: (favoritesResult.data ?? []).map((favorite) => favorite.product_id),
  };
}

export async function saveAccountProfile(profile: { name: string; phone: string }): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: profile.name,
    phone: profile.phone,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function saveAccountAddress(address: AccountAddress): Promise<void> {
  const userId = await requireUserId();
  const { data: existingAddress, error: readError } = await supabase
    .from('addresses')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (readError) throw readError;

  const result = existingAddress
    ? await supabase.from('addresses').update(address).eq('id', existingAddress.id).eq('user_id', userId)
    : await supabase.from('addresses').insert({ ...address, user_id: userId });

  if (result.error) throw result.error;
}

export async function savePaymentMethod(paymentMethod: PaymentMethod): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    payment_method: paymentMethod,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function toggleFavorite(productId: string): Promise<void> {
  const userId = await requireUserId();
  const { data: existingFavorite, error: readError } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (readError) throw readError;

  const result = existingFavorite
    ? await supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', productId)
    : await supabase.from('favorites').insert({ user_id: userId, product_id: productId });

  if (result.error) throw result.error;
}

export async function uploadAccountPhoto(asset: ImagePickerAsset): Promise<string> {
  const userId = await requireUserId();
  const avatarPath = await uploadUserImage(asset, 'profile-images');
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    avatar_path: avatarPath,
  }, { onConflict: 'id' });
  if (error) throw error;

  const { data, error: urlError } = await supabase.storage.from('profile-images').createSignedUrl(avatarPath, 3600);
  if (urlError) throw urlError;
  return data.signedUrl;
}

export async function loadAccountDeletionStatus(): Promise<'pending' | 'processing' | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .maybeSingle();
  if (error) throw error;
  return data?.status === 'processing' ? 'processing' : data ? 'pending' : null;
}

export async function submitAccountDeletionRequest(): Promise<boolean> {
  const userId = await requireUserId();
  const { data: existingRequest, error: readError } = await supabase
    .from('account_deletion_requests')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .maybeSingle();
  if (readError) throw readError;
  if (existingRequest) return false;

  const { error } = await supabase.from('account_deletion_requests').insert({ user_id: userId });
  if (error?.code === '23505') return false;
  if (error) throw error;
  return true;
}