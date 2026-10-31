import type { ImagePickerAsset } from 'expo-image-picker';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const PROOF_BUCKET = 'order-delivery-proofs';

export async function uploadDriverDeliveryProof(orderId: string, asset: ImagePickerAsset): Promise<string> {
  assertSupabaseConfigured();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error('Masuk terlebih dahulu untuk mengunggah bukti pengantaran.');

  const file = asset.file ?? await (await fetch(asset.uri)).blob();
  if (file.size > MAX_PROOF_SIZE) throw new Error('Ukuran foto bukti maksimal 5 MB.');

  const path = `${user.id}/${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error: uploadError } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, {
    contentType: asset.mimeType ?? file.type ?? 'image/jpeg',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: proofError } = await supabase.rpc('record_driver_delivery_proof', {
    p_order_id: orderId,
    p_storage_path: path,
  });
  if (proofError) throw new Error(proofError.code === 'PGRST202'
    ? 'Layanan bukti pengantaran belum tersedia. Minta admin menerapkan migrasi database terbaru.'
    : proofError.message);
  return path;
}

export async function getDriverDeliveryProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
